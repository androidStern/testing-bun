# Security Findings - Round 2

Discovered during final comprehensive security review on 2024-12-14. These issues were found after implementing the fixes from `high-severity-security-fixes.md`.

---

## CRITICAL Severity

### 1. OAuth `getClient` Leaks Client Secret

**File:** `convex/oauth.ts:398-418`

**Issue:** The `getClient` query returns the full client record including `clientSecret` to ANY caller. This is a public query - anyone can call it with a `clientId` and receive the hashed secret.

```typescript
export const getClient = query({
  args: { clientId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      // ...
      clientSecret: v.string(),  // LEAKED TO CALLER
      // ...
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('oauthClients')
      .withIndex('by_client_id', (q) => q.eq('clientId', args.clientId))
      .first();
  },
});
```

**Impact:** Attackers can enumerate client IDs and retrieve their secret hashes. While hashed, this enables offline brute-force attacks and violates OAuth2 security principles.

**Fix:** Either:
1. Change to `internalQuery` (preferred - only called from server-side token endpoint)
2. Remove `clientSecret` from the return type and only return it when called internally

---

### 2. Resume Functions Have No Authentication

**File:** `convex/resumes.ts:17-51`

**Issue:** Resume CRUD functions use plain `query`/`mutation` with no authentication checks. Any client can read/write any user's resume data.

```typescript
export const get = query({
  args: { id: v.id('resumes') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);  // NO AUTH CHECK
  },
});

export const getByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('resumes')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first();  // NO AUTH CHECK - any caller can read any user's resume
  },
});
```

**Impact:** Complete unauthorized access to all resume data including personal information, work history, education, skills.

**Fix:** Add authentication checks to verify the caller owns the resume:
```typescript
export const getByUserId = query({
  args: {},  // Remove userId arg
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    return await ctx.db
      .query('resumes')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .first();
  },
});
```

---

## HIGH Severity

### 3. Profile Queries Expose User PII

**File:** `convex/profiles.ts:24-44`

**Issue:** Profile queries take `userId` as an argument and return full profile data without verifying the caller is authorized to view it.

```typescript
export const getProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first();  // Returns full profile to any caller
  },
});
```

**Impact:** Any authenticated user (or unauthenticated if no auth check exists) can enumerate user IDs and retrieve their profile data including email, name, and other PII.

**Fix:** Either:
1. Remove `userId` arg and derive from auth context (for "my profile" queries)
2. Add explicit authorization checks for legitimate cross-user access patterns

---

### 4. Referral Stats IDOR Vulnerability

**File:** `convex/referrals.ts:106`

**Issue:** `getReferralStats` takes `userId` as an argument instead of deriving it from authentication context. This is an Insecure Direct Object Reference (IDOR).

```typescript
export const getReferralStats = query({
  args: { userId: v.string() },  // Attacker-controlled
  handler: async (ctx, args) => {
    // Returns referral stats for ANY user ID passed in
  },
});
```

**Impact:** Any caller can view referral statistics for any user by passing their user ID.

**Fix:** Derive userId from auth context:
```typescript
export const getReferralStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');
    // Use identity.subject instead of args.userId
  },
});
```

---

### 5. Slack Signature Timing Attack

**File:** `convex/lib/slack.ts:400`

**Issue:** Slack webhook signature verification uses direct string comparison (`===`) instead of timing-safe comparison.

```typescript
// Current (vulnerable)
return computedSignature === providedSignature;

// Should be
return timingSafeEqual(computedSignature, providedSignature);
```

**Impact:** Timing attacks could allow attackers to forge Slack webhook signatures by measuring response times.

**Fix:** Import and use `timingSafeEqual` from `convex/lib/crypto.ts`:
```typescript
import { timingSafeEqual } from './crypto';
// ...
return timingSafeEqual(computedSignature, providedSignature);
```

---

## MEDIUM Severity

### 6. OAuth Functions Should Be Internal

**File:** `convex/oauth.ts`

**Issue:** 13 OAuth functions are exposed as public `query`/`mutation` when they should only be callable from server-side code (token endpoint, authorize endpoint).

**Functions that should be `internalMutation`:**
- `createAuthorizationCode`
- `markCodeAsUsed`
- `exchangeAuthorizationCode`
- `deleteRefreshToken`
- `rotateRefreshToken`
- `revokeTokensByAuthCode`
- `createAccessToken`
- `createRefreshToken`
- `createClient`

**Functions that should be `internalQuery`:**
- `getAuthorizationCode`
- `getAccessToken`
- `getRefreshToken`
- `getClient`

**Current Mitigation:** These functions require `internalSecret` which is only known to the server. However, defense-in-depth dictates they should not be publicly callable at all.

**Fix:** Change all OAuth functions to use `internalMutation`/`internalQuery` and update callers in `src/routes/oauth/token.tsx` and `src/routes/oauth/authorize.tsx` to use `internal.*` references.

---

## Summary

| Severity | Issue | File | Line |
|----------|-------|------|------|
| CRITICAL | getClient leaks clientSecret | oauth.ts | 398-418 |
| CRITICAL | Resume functions no auth | resumes.ts | 17-51 |
| HIGH | Profile queries expose PII | profiles.ts | 24-44 |
| HIGH | Referral stats IDOR | referrals.ts | 106 |
| HIGH | Slack signature timing attack | lib/slack.ts | 400 |
| MEDIUM | OAuth functions should be internal | oauth.ts | multiple |

---

## Recommended Priority

1. **Immediate:** Fix CRITICAL issues (getClient, resumes)
2. **This Week:** Fix HIGH issues (profiles, referrals, Slack)
3. **Soon:** Convert OAuth functions to internal (defense-in-depth)
