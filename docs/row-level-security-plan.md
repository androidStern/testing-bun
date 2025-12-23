# Row-Level Security (RLS) Implementation Plan

This document outlines the plan for implementing proper authorization in Convex using Row-Level Security from `convex-helpers`.

## Problem

Several functions accept `workosUserId` as an argument without verifying the authenticated user matches that ID. This allows any caller to read/write any user's data by passing a different `workosUserId`.

**Affected functions:**
- `convex/resumes.ts`: `getByWorkosUserId`, `upsert`
- `convex/referrals.ts`: `getMyReferralStats`

## Solution: Row-Level Security

Instead of manually adding auth checks to every function, we define rules per table and the database wrapper enforces them automatically on every `db.get`, `db.query`, `db.insert`, `db.patch`, `db.delete`.

## Implementation

### Step 1: Create `convex/rls.ts`

```typescript
import {
  customCtx,
  customMutation,
  customQuery,
} from 'convex-helpers/server/customFunctions';
import {
  Rules,
  wrapDatabaseReader,
  wrapDatabaseWriter,
} from 'convex-helpers/server/rowLevelSecurity';
import type { DataModel } from './_generated/dataModel';
import { mutation, query, QueryCtx } from './_generated/server';

// Helper: check if doc has owner field and if it matches current user
function isOwner(userId: string | null, doc: Record<string, unknown>): boolean {
  if (!userId) return false;
  // Convention: any doc with workosUserId is owner-scoped
  if ('workosUserId' in doc) return doc.workosUserId === userId;
  if ('ownerId' in doc) return doc.ownerId === userId;
  return true; // No owner field = public
}

async function rlsRules(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  const userId = identity?.subject ?? null;

  const ownerRule = {
    read: async (_: unknown, doc: Record<string, unknown>) => isOwner(userId, doc),
    insert: async (_: unknown, doc: Record<string, unknown>) => isOwner(userId, doc),
    modify: async (_: unknown, doc: Record<string, unknown>) => isOwner(userId, doc),
  };

  return {
    resumes: ownerRule,
    // Add more owner-scoped tables as needed
  } satisfies Rules<QueryCtx, DataModel>;
}

export const queryWithRLS = customQuery(
  query,
  customCtx(async (ctx) => ({
    db: wrapDatabaseReader(ctx, ctx.db, await rlsRules(ctx)),
  })),
);

export const mutationWithRLS = customMutation(
  mutation,
  customCtx(async (ctx) => ({
    db: wrapDatabaseWriter(ctx, ctx.db, await rlsRules(ctx)),
  })),
);
```

### Step 2: Update `convex/resumes.ts`

Replace `query` and `mutation` imports with RLS versions:

```typescript
// Before
import { action, mutation, query } from './_generated/server';

// After
import { action } from './_generated/server';
import { queryWithRLS, mutationWithRLS } from './rls';

export const getByWorkosUserId = queryWithRLS({
  args: { workosUserId: v.string() },
  handler: async (ctx, args) => {
    // RLS automatically filters - non-owners get null
    return await ctx.db
      .query('resumes')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', args.workosUserId))
      .first();
  },
});

export const upsert = mutationWithRLS({
  // ... existing implementation unchanged
  // RLS automatically blocks unauthorized writes
});
```

### Step 3: Update `convex/referrals.ts`

Same pattern for `getMyReferralStats`.

## Evolution Path

The RLS pattern naturally evolves as authorization needs grow:

### Level 1: Owner-Based (Current Need)
```typescript
read: async (_, doc) => doc.workosUserId === userId
```

### Level 2: RBAC (Roles)
When you need admin overrides, moderators, etc.:

```typescript
type Role = 'user' | 'moderator' | 'admin';
const roleHierarchy: Record<Role, number> = { user: 0, moderator: 1, admin: 2 };

function hasRole(userRole: Role | null, required: Role): boolean {
  if (!userRole) return false;
  return roleHierarchy[userRole] >= roleHierarchy[required];
}

// In rules:
read: async (_, doc) => isOwner(userId, doc) || hasRole(role, 'admin'),
```

### Level 3: ABAC (Attributes)
When RBAC gets messy, add attributes:

```typescript
interface AuthContext {
  userId: string | null;
  role: Role | null;
  teamId: string | null;
  isEmailVerified: boolean;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
}

// In rules:
modify: async (_, doc) =>
  (doc.teamId === auth.teamId && auth.subscriptionTier !== 'free') ||
  hasRole(auth.role, 'admin'),
```

## Summary Table

| Stage | Pattern | When to Use |
|-------|---------|-------------|
| **Owner** | `doc.ownerId === userId` | Single-user data (resumes, settings) |
| **RBAC** | `hasRole(user.role, 'admin')` | Need admin overrides, moderators |
| **ABAC** | `user.tier === 'pro' && doc.teamId === user.teamId` | Multi-tenant, feature gates, complex policies |

## References

- [Row Level Security - Convex Stack](https://stack.convex.dev/row-level-security)
- [Custom Functions as Middleware - Convex Stack](https://stack.convex.dev/custom-functions)
- [Authorization Best Practices - Convex Stack](https://stack.convex.dev/authorization)
- [convex-helpers GitHub](https://github.com/get-convex/convex-helpers)
- [Convex Auth with Role-Based Permissions](https://github.com/get-convex/convex-auth-with-role-based-permissions)
