# Circle Profile Two-Way Sync Plan

Bi-directional sync between Circle members and local profiles with "most recent wins" conflict resolution.

## Overview

**Circle → Local** sync triggers:
- `community_member_joined_community` webhook (member.joined)
- Circle's `profile.updated` webhook

**Local → Circle** sync (already exists):
- `profileWebhook.ts` sends profile data on create/update via `auth0/profile-form.submitted` event

**Conflict Resolution**: Compare timestamps, most recent wins

## Sync Fields (All Overlapping)

| Local Field | Circle Field | Notes |
|-------------|--------------|-------|
| firstName | first_name | |
| lastName | last_name | |
| headline | headline | |
| bio | bio | |
| location | location | |
| website | website | |
| instagramUrl | instagram_url | May need field mapping |
| linkedinUrl | linkedin_url | May need field mapping |

## Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         CIRCLE                                    │
│  (member.joined / profile.updated webhooks)                       │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  /webhooks/circle                                                 │
│  Parse event type → dispatch to appropriate Inngest event         │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  Inngest: circle/member.sync                                      │
│  1. Fetch full Circle member details (if not in payload)          │
│  2. Find or create local profile by email                         │
│  3. Merge fields using "most recent wins"                         │
│  4. Store circleMemberId, update circleUpdatedAt                  │
│  5. Verify completeness → send alerts/emails if needed            │
└──────────────────────────────────────────────────────────────────┘
```

## Schema Changes (`convex/schema.ts`)

```typescript
profiles: defineTable({
  // Identity
  workosUserId: v.optional(v.string()),  // Optional for profiles created from Circle first
  email: v.string(),
  circleMemberId: v.optional(v.number()), // Circle's community_member_id

  // Profile fields (synced with Circle)
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  headline: v.optional(v.string()),
  bio: v.optional(v.string()),
  location: v.optional(v.string()),
  website: v.optional(v.string()),
  instagramUrl: v.optional(v.string()),
  linkedinUrl: v.optional(v.string()),
  thingsICanOffer: v.array(v.string()),
  resumeLink: v.optional(v.string()),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),                   // Last local update
  circleUpdatedAt: v.optional(v.number()), // Circle's updated_at (for conflict resolution)

  // Flags
  isStub: v.optional(v.boolean()),         // Profile created from webhook, awaiting user signup
  referralCode: v.optional(v.string()),
})
  .index('by_workos_user_id', ['workosUserId'])
  .index('by_email', ['email'])
  .index('by_circle_member_id', ['circleMemberId'])
  .index('by_referral_code', ['referralCode'])
```

## Files to Modify/Create

### 1. `convex/schema.ts`
- Make `workosUserId` optional
- Add `circleMemberId`, `circleUpdatedAt`, `isStub`
- Add index `by_circle_member_id`

### 2. `convex/lib/circle.ts`
Add function to fetch member details:
```typescript
interface CircleMember {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  website?: string;
  // Custom profile fields stored in profile_fields array
  profile_fields?: Array<{ id: number; value: string }>;
  updated_at: string; // ISO timestamp
}

async function getCircleMemberById(memberId: number): Promise<CircleMember>
```

### 3. `convex/profiles.ts`
Add internal mutations:
- `getByEmailInternal` - for workflow lookup
- `syncFromCircle` - merge Circle data into local profile
- `createFromCircle` - create profile from Circle data (not a stub)

Modify `create` (for WorkOS account linking only, NOT sync):
- After workosUserId check fails, also check by email
- If Circle-created profile found by email: link workosUserId to it
- This handles the case where Circle webhook created profile first, then user signs up via WorkOS
- The existing `profileWebhook.ts` handles the actual Local → Circle sync

### 4. `convex/inngest/client.ts`
Add event type:
```typescript
type CircleMemberSyncEvent = {
  name: 'circle/member.sync';
  data: {
    eventType: 'member_joined' | 'profile_updated';
    communityId: number;
    communityMemberId: number;
    // Optional: Circle may include full member data in webhook
    memberData?: CircleMember;
  };
};
```

### 5. `convex/inngest/circleMemberSync.ts` (new)
Workflow handler:
```
Step 1: fetch-circle-member (if not in payload)
Step 2: lookup-or-create-profile
  - Find by email
  - If not found: create profile from Circle data
  - If found: merge using "most recent wins"
Step 3: link-circle-member-id
Step 4: verify-completeness
  - Check workosUserId present
  - Check required fields (headline, thingsICanOffer)
Step 5: handle-gaps
  - Missing WorkOS → Slack alert + email signup request
  - Incomplete profile → Email reminder
```

### 6. `convex/lib/profileMerge.ts` (new)
Merge utility:
```typescript
interface MergeResult {
  merged: Partial<Profile>;
  conflicts: Array<{ field: string; localValue: any; circleValue: any; winner: 'local' | 'circle' }>;
}

function mergeProfiles(
  local: Profile | null,
  circle: CircleMember,
  localUpdatedAt: number,
  circleUpdatedAt: number
): MergeResult
```

Logic:
- If localUpdatedAt > circleUpdatedAt: local wins for all fields
- If circleUpdatedAt > localUpdatedAt: circle wins for all fields
- Always prefer non-null over null values regardless of timestamp

### 7. `convex/inngestNode.ts`
Add actions:
- `sendCircleMemberSyncEvent`
- `postCircleSyncAlert`

### 8. `convex/http.ts`
Add unified Circle webhook handler:
```typescript
http.route({
  path: '/webhooks/circle',
  method: 'POST',
  handler: async (ctx, request) => {
    const payload = await request.json();

    // Handle different event types
    if (payload.type === 'community_member_joined_community') {
      // Dispatch member.joined
    } else if (payload.type === 'profile_updated' || payload.type === 'community_member_updated') {
      // Dispatch profile.updated
    }

    return new Response('OK', { status: 200 });
  }
});
```

## Handling Missing Data

| Scenario | Action |
|----------|--------|
| No WorkOS account (workosUserId missing) | Slack alert + email user signup link |
| Incomplete profile (missing headline or thingsICanOffer) | Email reminder to complete profile |
| No local profile for Circle member's email | Create full profile from Circle data (not stub) |

## Preventing Drift

**Email is the canonical key** linking WorkOS, Circle, and local profiles.

**Scenario: Circle webhook fires first**
1. Webhook creates/updates profile from Circle data with circleMemberId
2. Profile has no workosUserId yet (isStub: true if minimal data)
3. User later signs up via WorkOS
4. Modified `profiles.create` finds existing profile by email
5. Links workosUserId, merges any additional data from form

**Scenario: WorkOS signup first**
1. User signs up, `profileWebhook.ts` sends `auth0/profile-form.submitted` to Inngest (existing flow)
2. User joins Circle community
3. `member.joined` webhook looks up by email, finds existing profile
4. Links circleMemberId to existing profile, merges any new Circle data

**Ongoing sync**
- Local update → `profileWebhook.ts` already sends `auth0/profile-form.submitted` (no changes needed)
- Circle update → `profile.updated` webhook pulls to local (new)
- Conflict resolution: most recent timestamp wins

## Implementation Order

1. Schema changes
2. Circle API function (`getCircleMemberById`)
3. Profile merge utility (`profileMerge.ts`)
4. Profile mutations (getByEmailInternal, syncFromCircle, createFromCircle)
5. Modify `profiles.create` for email-based stub detection
6. Inngest event schema
7. Inngest workflow handler
8. Register handler
9. Node.js actions (event sender, Slack alert)
10. HTTP webhook endpoint

## Testing Checklist

- [ ] Circle member joins → profile created with Circle data
- [ ] Circle member joins with existing local profile → circleMemberId linked
- [ ] Circle profile updated → local profile updated (if Circle is newer)
- [ ] Local profile updated → no change to local (handled by existing webhook)
- [ ] User signs up via WorkOS after Circle webhook → profiles merged correctly
- [ ] Missing WorkOS → Slack alert sent
- [ ] Incomplete profile → email reminder sent

## Context

### Webhook Payload Example (member.joined)
```json
{
  "body": {
    "type": "community_member_joined_community",
    "data": {
      "community_id": 393781,
      "community_member_id": 43391391
    }
  }
}
```

### Existing Profile Schema
Current profile fields (from `convex/schema.ts` lines 12-34):
- workosUserId (required → will become optional)
- email
- firstName, lastName
- thingsICanOffer (array)
- headline, bio
- resumeLink, location, website
- instagramUrl, linkedinUrl
- createdAt, updatedAt
- referralCode

### Existing Inngest Events
Event naming follows pattern: `namespace/entity.action`
- `job/submitted`
- `slack/approval.clicked`
- `application/submitted`
- `employer/approved`
- `employer/account-created`

New event will be: `circle/member.sync`

### Related Files
- `convex/profileWebhook.ts` - Existing Local → Circle sync (sends `auth0/profile-form.submitted`)
- `convex/lib/circle.ts` - Existing Circle API for posting jobs
- `convex/inngest/client.ts` - Event schemas
- `convex/http.ts` - HTTP routes (add `/webhooks/circle`)
- `src/routes/oauth/userinfo.tsx` - What we currently send to Circle via OAuth
