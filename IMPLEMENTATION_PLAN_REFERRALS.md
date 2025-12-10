# Referral Attribution System — Implementation Plan

## Overview

This plan implements a cookie-first referral tracking system that integrates with the existing TanStack Start + Convex + WorkOS + Circle SSO architecture.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           REFERRAL ENTRY POINTS                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   PATH A: Referral Link → Circle                                                │
│   ────────────────────────────────                                              │
│   1. User clicks: yoursite.com/join/ABC123                                      │
│   2. /join/$code route:                                                          │
│      • Sets pending_referral cookie (24h, httpOnly, lax)                        │
│      • Redirects to Circle: mycommunity.circle.so?invite_code=DEFAULT           │
│   3. Circle shows "Continue with Recovery Jobs" SSO button                      │
│   4. Circle redirects → /oauth/authorize (existing route)                       │
│   5. Existing OAuth flow proceeds (see PATH C)                                  │
│                                                                                  │
│   PATH B: Direct Signup (no Circle)                                             │
│   ──────────────────────────────────                                            │
│   1. User visits yoursite.com (may have pending_referral cookie from prior)     │
│   2. Clicks Sign Up → WorkOS                                                    │
│   3. WorkOS callback → / (home)                                                 │
│   4. Home page shows ProfileForm                                                │
│   5. ProfileForm reads pending_referral cookie, passes to create mutation       │
│                                                                                  │
│   PATH C: Circle OAuth Flow (existing, modified)                                │
│   ──────────────────────────────────────────────                                │
│   1. /oauth/authorize                                                           │
│      • Reads pending_referral cookie                                            │
│      • Adds referralCode to OAuthSessionData                                    │
│      • Sets oauth_session cookie (encrypted)                                    │
│      • Redirects to WorkOS signup                                               │
│   2. /callback (WorkOS handler, unchanged)                                      │
│   3. /oauth/callback                                                            │
│      • Decrypts oauth_session (now contains referralCode)                       │
│      • If no profile → redirect to /oauth/profile?ref=CODE                      │
│      • If has profile → generate auth code → redirect to Circle                 │
│   4. /oauth/profile                                                             │
│      • Receives ref from query params                                           │
│      • Passes to ProfileForm                                                    │
│   5. ProfileForm submission                                                     │
│      • Calls api.profiles.create with referredByCode                            │
│   6. /oauth/complete                                                            │
│      • Clears pending_referral cookie                                           │
│      • Redirects to Circle with auth code                                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Implementation

### Phase 1: Database Schema Changes

#### 1.1 Update `convex/schema.ts`

Add `referralCode` field to `profiles` table and create new `referrals` table:

```typescript
// convex/schema.ts

profiles: defineTable({
  // ... existing fields ...
  workosUserId: v.string(),
  email: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  thingsICanOffer: v.array(v.string()),
  headline: v.optional(v.string()),
  bio: v.optional(v.string()),
  resumeLink: v.optional(v.string()),
  location: v.optional(v.string()),
  website: v.optional(v.string()),
  instagramUrl: v.optional(v.string()),
  linkedinUrl: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),

  // NEW: Unique referral code for this user
  referralCode: v.string(),
})
  .index('by_workos_user_id', ['workosUserId'])
  .index('by_email', ['email'])
  // NEW: Index for looking up users by their referral code
  .index('by_referral_code', ['referralCode']),

// NEW TABLE: Track referral relationships
referrals: defineTable({
  referrerProfileId: v.id('profiles'),  // The user who referred
  referredProfileId: v.id('profiles'),  // The user who was referred
  createdAt: v.number(),
  rewardTier: v.optional(v.string()),   // "tshirt", "hoodie", etc.
  rewardFulfilledAt: v.optional(v.number()),
})
  .index('by_referrer', ['referrerProfileId'])
  .index('by_referred', ['referredProfileId']),
```

**Migration Note**: Existing profiles need `referralCode` backfilled. Create a migration mutation.

---

### Phase 2: Convex Functions

#### 2.1 Create `convex/referrals.ts`

```typescript
// convex/referrals.ts
import { v } from 'convex/values';
import { mutation, query, internalMutation } from './_generated/server';

// Characters that aren't easily confused (no 0/O, 1/I/l)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// Generate a unique referral code (used during profile creation)
export const generateUniqueCode = internalMutation({
  args: {},
  handler: async (ctx) => {
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = generateReferralCode();
      const existing = await ctx.db
        .query('profiles')
        .withIndex('by_referral_code', (q) => q.eq('referralCode', code))
        .first();

      if (!existing) return code;
      attempts++;
    } while (attempts < maxAttempts);

    // Fallback: append timestamp suffix
    return `${generateReferralCode()}${Date.now().toString(36).slice(-2).toUpperCase()}`;
  },
});

// Record a referral (called after profile creation)
export const recordReferral = internalMutation({
  args: {
    referrerCode: v.string(),
    referredProfileId: v.id('profiles'),
  },
  handler: async (ctx, { referrerCode, referredProfileId }) => {
    // Find the referrer by their code
    const referrer = await ctx.db
      .query('profiles')
      .withIndex('by_referral_code', (q) => q.eq('referralCode', referrerCode))
      .first();

    if (!referrer) {
      console.log(`Referral code ${referrerCode} not found, skipping attribution`);
      return null;
    }

    // Prevent self-referral
    if (referrer._id === referredProfileId) {
      console.log('Self-referral attempted, skipping');
      return null;
    }

    // Check if referral already exists (prevent duplicates)
    const existingReferral = await ctx.db
      .query('referrals')
      .withIndex('by_referred', (q) => q.eq('referredProfileId', referredProfileId))
      .first();

    if (existingReferral) {
      console.log('Referral already exists for this user, skipping');
      return existingReferral._id;
    }

    // Create the referral record
    const referralId = await ctx.db.insert('referrals', {
      referrerProfileId: referrer._id,
      referredProfileId,
      createdAt: Date.now(),
    });

    console.log(`Recorded referral: ${referrer._id} referred ${referredProfileId}`);
    return referralId;
  },
});

// Get profile by referral code (for validation)
export const getProfileByReferralCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_referral_code', (q) => q.eq('referralCode', code))
      .first();

    if (!profile) return null;

    return {
      firstName: profile.firstName,
      referralCode: profile.referralCode,
    };
  },
});

// Get current user's referral stats
export const getMyReferralStats = query({
  args: { workosUserId: v.string() },
  handler: async (ctx, { workosUserId }) => {
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', workosUserId))
      .first();

    if (!profile) return null;

    const referrals = await ctx.db
      .query('referrals')
      .withIndex('by_referrer', (q) => q.eq('referrerProfileId', profile._id))
      .collect();

    return {
      code: profile.referralCode,
      totalReferrals: referrals.length,
      pendingRewards: referrals.filter((r) => !r.rewardFulfilledAt).length,
    };
  },
});

// Admin: Get users eligible for rewards
export const getRewardQueue = query({
  args: { minReferrals: v.number() },
  handler: async (ctx, { minReferrals }) => {
    const allReferrals = await ctx.db.query('referrals').collect();

    // Group by referrer
    const referrerCounts = new Map<string, { total: number; unfulfilled: number }>();

    for (const r of allReferrals) {
      const key = r.referrerProfileId;
      const current = referrerCounts.get(key) || { total: 0, unfulfilled: 0 };
      current.total++;
      if (!r.rewardFulfilledAt) current.unfulfilled++;
      referrerCounts.set(key, current);
    }

    const eligible = [];
    for (const [profileId, counts] of referrerCounts) {
      if (counts.total >= minReferrals && counts.unfulfilled > 0) {
        const profile = await ctx.db.get(profileId as any);
        if (profile) {
          eligible.push({
            profile,
            totalReferrals: counts.total,
            pendingRewards: counts.unfulfilled,
          });
        }
      }
    }

    return eligible.sort((a, b) => b.totalReferrals - a.totalReferrals);
  },
});

// Admin: Mark referrals as rewarded
export const markRewarded = mutation({
  args: {
    referrerProfileId: v.id('profiles'),
    rewardTier: v.string(),
  },
  handler: async (ctx, { referrerProfileId, rewardTier }) => {
    const referrals = await ctx.db
      .query('referrals')
      .withIndex('by_referrer', (q) => q.eq('referrerProfileId', referrerProfileId))
      .collect();

    const unfulfilled = referrals.filter((r) => !r.rewardFulfilledAt);
    const now = Date.now();

    for (const r of unfulfilled) {
      await ctx.db.patch(r._id, {
        rewardTier,
        rewardFulfilledAt: now,
      });
    }

    return { marked: unfulfilled.length };
  },
});
```

#### 2.2 Modify `convex/profiles.ts`

Update the `create` mutation to:
1. Generate a referral code for new profiles
2. Accept optional `referredByCode` parameter
3. Record referral attribution after creation

```typescript
// convex/profiles.ts - MODIFIED create mutation

import { internal } from './_generated/api';

export const create = zodMutation({
  args: profileMutationSchema.extend({
    // NEW: Optional referral code from the person who referred this user
    referredByCode: z.string().optional(),
  }),
  handler: async (ctx, args) => {
    const { referredByCode, ...profileData } = args;

    const existing = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', (q) =>
        q.eq('workosUserId', args.workosUserId),
      )
      .first();

    const now = Date.now();

    let profileId: string;
    let isNew = false;

    if (existing) {
      // Update existing profile (don't change referralCode)
      await ctx.db.patch(existing._id, {
        ...profileData,
        updatedAt: now,
      });
      profileId = existing._id;
    } else {
      // NEW PROFILE: Generate unique referral code
      const referralCode = await ctx.runMutation(
        internal.referrals.generateUniqueCode,
        {}
      );

      profileId = await ctx.db.insert('profiles', {
        ...profileData,
        referralCode,
        createdAt: now,
        updatedAt: now,
      });
      isNew = true;

      // Record referral attribution if code provided
      if (referredByCode) {
        await ctx.scheduler.runAfter(0, internal.referrals.recordReferral, {
          referrerCode: referredByCode,
          referredProfileId: profileId as any,
        });
      }
    }

    // Send profile data to Inngest webhook (existing logic)
    await ctx.scheduler.runAfter(0, internal.inngest.sendProfileWebhook, {
      workosUserId: args.workosUserId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      thingsICanOffer: args.thingsICanOffer,
      headline: args.headline,
      bio: args.bio,
      location: args.location,
      website: args.website,
      resumeLink: args.resumeLink,
      linkedinUrl: args.linkedinUrl,
      instagramUrl: args.instagramUrl,
    });

    return profileId;
  },
});
```

#### 2.3 Create Migration for Existing Profiles

```typescript
// convex/migrations.ts
import { internalMutation } from './_generated/server';

// Characters that aren't easily confused
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// Run once to backfill referralCode for existing profiles
export const backfillReferralCodes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query('profiles').collect();
    const usedCodes = new Set<string>();
    let updated = 0;

    for (const profile of profiles) {
      // Skip if already has a referral code
      if ((profile as any).referralCode) {
        usedCodes.add((profile as any).referralCode);
        continue;
      }

      // Generate unique code
      let code: string;
      do {
        code = generateReferralCode();
      } while (usedCodes.has(code));

      usedCodes.add(code);
      await ctx.db.patch(profile._id, { referralCode: code } as any);
      updated++;
    }

    return { updated, total: profiles.length };
  },
});
```

---

### Phase 3: Referral Cookie Utilities

#### 3.1 Create `src/lib/referral-cookie.ts`

```typescript
// src/lib/referral-cookie.ts
import { parse, serialize } from 'cookie';

const REFERRAL_COOKIE = 'pending_referral';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

export function setReferralCookie(headers: Headers, code: string): void {
  const cookie = serialize(REFERRAL_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  headers.append('Set-Cookie', cookie);
}

export function getReferralFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = parse(cookieHeader);
  return cookies[REFERRAL_COOKIE] || null;
}

export function clearReferralCookie(headers: Headers): void {
  const cookie = serialize(REFERRAL_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  headers.append('Set-Cookie', cookie);
}
```

---

### Phase 4: Route Implementations

#### 4.1 Create `/join/$code` Route

```typescript
// src/routes/join/$code.tsx
import { createFileRoute } from '@tanstack/react-router';
import { setReferralCookie } from '../../lib/referral-cookie';

// Environment config
const CIRCLE_DOMAIN = process.env.CIRCLE_DOMAIN || 'mycommunity.circle.so';
const DEFAULT_CIRCLE_INVITE = process.env.DEFAULT_CIRCLE_INVITE || '';

export const Route = createFileRoute('/join/$code')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { code } = params;

        // Validate code format (6 alphanumeric chars)
        if (!/^[A-Z0-9]{6,8}$/i.test(code)) {
          return new Response('Invalid referral code', { status: 400 });
        }

        // Set referral cookie and redirect to Circle
        const headers = new Headers();
        setReferralCookie(headers, code.toUpperCase());

        // Build Circle URL
        let circleUrl = `https://${CIRCLE_DOMAIN}`;
        if (DEFAULT_CIRCLE_INVITE) {
          circleUrl += `?invite_code=${DEFAULT_CIRCLE_INVITE}`;
        }

        headers.set('Location', circleUrl);

        return new Response(null, {
          status: 302,
          headers,
        });
      },
    },
  },
});
```

#### 4.2 Alternative: `/join/$code` with Landing Page (Optional)

If you want a landing page with social previews instead of instant redirect:

```typescript
// src/routes/join/$code.tsx (alternative with UI)
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { setReferralCookie } from '../../lib/referral-cookie';

const CIRCLE_DOMAIN = process.env.CIRCLE_DOMAIN || 'mycommunity.circle.so';
const DEFAULT_CIRCLE_INVITE = process.env.DEFAULT_CIRCLE_INVITE || '';

// Server function to set cookie
const setCookieAndGetRedirect = createServerFn({ method: 'POST' })
  .validator((code: string) => code)
  .handler(async ({ data: code }) => {
    // Cookie will be set via the response, not here
    // Return the redirect URL
    let circleUrl = `https://${CIRCLE_DOMAIN}`;
    if (DEFAULT_CIRCLE_INVITE) {
      circleUrl += `?invite_code=${DEFAULT_CIRCLE_INVITE}`;
    }
    return circleUrl;
  });

export const Route = createFileRoute('/join/$code')({
  head: () => ({
    meta: [
      { title: 'Join Recovery Jobs Community' },
      { name: 'og:title', content: "You're invited to Recovery Jobs" },
      { name: 'og:description', content: 'Join a community of people rebuilding their careers in recovery.' },
      { name: 'og:image', content: '/og-invite.png' },
    ],
  }),
  loader: async ({ params }) => {
    const { code } = params;

    // Validate code format
    const isValid = /^[A-Z0-9]{6,8}$/i.test(code);

    return { code: code.toUpperCase(), isValid };
  },
  component: JoinPage,
});

function JoinPage() {
  const { code, isValid } = Route.useLoaderData();

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
          <h1 className="text-2xl font-bold text-destructive mb-4">Invalid Link</h1>
          <p className="text-muted-foreground">This referral link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const handleJoin = () => {
    // Set cookie via document.cookie (less secure but simpler for client-side)
    // OR redirect to a server endpoint that sets the cookie
    document.cookie = `pending_referral=${code}; path=/; max-age=86400; samesite=lax`;

    let circleUrl = `https://${CIRCLE_DOMAIN}`;
    if (DEFAULT_CIRCLE_INVITE) {
      circleUrl += `?invite_code=${DEFAULT_CIRCLE_INVITE}`;
    }
    window.location.href = circleUrl;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20 p-4">
      <div className="bg-card rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
        <div className="text-5xl mb-4">🌱</div>
        <h1 className="text-2xl font-bold text-card-foreground">
          You've Been Invited
        </h1>
        <p className="mt-2 text-muted-foreground">
          Join a community of people rebuilding their careers in recovery.
        </p>
        <button
          onClick={handleJoin}
          className="mt-6 w-full bg-primary text-primary-foreground font-semibold py-4 rounded-xl hover:bg-primary/90 transition-colors"
        >
          Join the Community →
        </button>
        <p className="mt-4 text-xs text-muted-foreground">
          Free forever. No spam. Real support.
        </p>
      </div>
    </div>
  );
}
```

#### 4.3 Modify `src/lib/oauth-session.ts`

Add `referralCode` to the session data:

```typescript
// src/lib/oauth-session.ts - ADD to interface

export interface OAuthSessionData {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  scope?: string;
  createdAt: number;

  // NEW: Referral code if present when OAuth flow started
  referralCode?: string;
}
```

#### 4.4 Modify `/oauth/authorize` Route

Read referral cookie and include in OAuth session:

```typescript
// src/routes/oauth/authorize.tsx - MODIFIED

import { createFileRoute } from '@tanstack/react-router';
import { getSignUpUrl } from '@workos/authkit-tanstack-react-start';
import {
  encryptSession,
  setOAuthSessionCookie
} from '../../lib/oauth-session';
import { getReferralFromRequest } from '../../lib/referral-cookie';
import type { OAuthSessionData } from '../../lib/oauth-session';

export const Route = createFileRoute('/oauth/authorize')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);

        // Extract OAuth parameters from Circle
        const clientId = url.searchParams.get('client_id');
        const redirectUri = url.searchParams.get('redirect_uri');
        const responseType = url.searchParams.get('response_type');
        const state = url.searchParams.get('state');
        const scope = url.searchParams.get('scope');
        const codeChallenge = url.searchParams.get('code_challenge');
        const codeChallengeMethod = url.searchParams.get('code_challenge_method');

        // Validate required parameters
        if (!clientId || !redirectUri || responseType !== 'code' || !state) {
          return new Response(
            JSON.stringify({
              error: 'invalid_request',
              error_description: 'Missing required OAuth parameters',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        // NEW: Read referral cookie
        const referralCode = getReferralFromRequest(request);

        // Store OAuth session data (now includes referral code)
        const sessionData: OAuthSessionData = {
          clientId,
          redirectUri,
          state,
          codeChallenge: codeChallenge || undefined,
          codeChallengeMethod: codeChallengeMethod || undefined,
          scope: scope || undefined,
          createdAt: Date.now(),
          referralCode: referralCode || undefined,  // NEW
        };

        const encryptedSession = await encryptSession(sessionData);

        // Redirect to WorkOS AuthKit
        const signUpUrl = await getSignUpUrl({
          data: { returnPathname: '/oauth/callback' },
        });

        const headers = new Headers();
        headers.set('Location', signUpUrl);
        setOAuthSessionCookie(headers, encryptedSession);

        return new Response(null, {
          status: 302,
          headers,
        });
      },
    },
  },
});
```

#### 4.5 Modify `/oauth/callback` Route

Pass referral code to profile page:

```typescript
// src/routes/oauth/callback.tsx - MODIFIED

import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@workos/authkit-tanstack-react-start';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import {
  clearOAuthSessionCookie,
  decryptSession,
  getOAuthSessionFromRequest,
  setOAuthSessionCookie,
} from '../../lib/oauth-session';
import { clearReferralCookie } from '../../lib/referral-cookie';
import { generateAuthorizationCode } from '../../lib/oauth-tokens';

const getConvexClient = () => {
  const url = process.env.VITE_CONVEX_URL;
  if (!url) throw new Error('VITE_CONVEX_URL not set');
  return new ConvexHttpClient(url);
};

export const Route = createFileRoute('/oauth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getAuth();

        if (!auth.user) {
          return new Response('Unauthorized', { status: 401 });
        }

        // Retrieve OAuth session
        const encryptedSession = getOAuthSessionFromRequest(request);
        if (!encryptedSession) {
          return new Response('OAuth session expired. Please start over.', {
            status: 400,
          });
        }

        const oauthSession = await decryptSession(encryptedSession);
        if (!oauthSession) {
          return new Response('Invalid OAuth session', { status: 400 });
        }

        // Check session expiry (10 minutes)
        if (Date.now() - oauthSession.createdAt > 600000) {
          return new Response('OAuth session expired', { status: 400 });
        }

        // Check if user has a profile
        const convex = getConvexClient();
        const profile = await convex.query(api.profiles.getByWorkosUserId, {
          workosUserId: auth.user.id,
        });

        if (!profile) {
          // Redirect to profile form WITH referral code as query param
          const headers = new Headers();

          // Build profile URL with referral code if present
          let profileUrl = '/oauth/profile';
          if (oauthSession.referralCode) {
            profileUrl += `?ref=${encodeURIComponent(oauthSession.referralCode)}`;
          }

          headers.set('Location', profileUrl);
          // Keep the session cookie for the profile form
          setOAuthSessionCookie(headers, encryptedSession);

          return new Response(null, {
            status: 302,
            headers,
          });
        }

        // User has profile - generate authorization code and redirect to Circle
        const code = generateAuthorizationCode();

        await convex.mutation(api.oauth.createAuthorizationCode, {
          code,
          clientId: oauthSession.clientId,
          workosUserId: auth.user.id,
          redirectUri: oauthSession.redirectUri,
          codeChallenge: oauthSession.codeChallenge,
          codeChallengeMethod: oauthSession.codeChallengeMethod,
          scope: oauthSession.scope,
          expiresAt: Date.now() + 600000,
        });

        // Build redirect URL with code and state
        const redirectUrl = new URL(oauthSession.redirectUri);
        redirectUrl.searchParams.set('code', code);
        redirectUrl.searchParams.set('state', oauthSession.state);

        const headers = new Headers();
        headers.set('Location', redirectUrl.toString());
        clearOAuthSessionCookie(headers);
        clearReferralCookie(headers);  // NEW: Clear referral cookie

        return new Response(null, {
          status: 302,
          headers,
        });
      },
    },
  },
});
```

#### 4.6 Modify `/oauth/profile` Route

Accept and pass referral code:

```typescript
// src/routes/oauth/profile.tsx - MODIFIED

import { createFileRoute, redirect } from '@tanstack/react-router';
import { getAuth } from '@workos/authkit-tanstack-react-start';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '../../../convex/_generated/api';
import { ProfileForm } from '../../components/ProfileForm';
import type { ErrorComponentProps } from '@tanstack/react-router';

function ProfileError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex-1 bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto bg-card rounded-lg shadow-sm sm:shadow-md p-6 sm:p-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-destructive mb-4">
          Failed to Load Profile
        </h1>
        <p className="text-muted-foreground mb-6">
          {error?.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={() => reset()}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/oauth/profile')({
  errorComponent: ProfileError,
  // NEW: Validate search params for referral code
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === 'string' ? search.ref : undefined,
  }),
  loader: async ({ context }) => {
    const auth = await getAuth();

    if (!auth.user) {
      throw redirect({ to: '/' });
    }

    await context.queryClient.ensureQueryData(
      convexQuery(api.profiles.getByWorkosUserId, {
        workosUserId: auth.user.id,
      }),
    );

    return {
      user: auth.user,
    };
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useLoaderData();
  const { ref } = Route.useSearch();  // NEW: Get referral code from URL

  const handleSuccess = () => {
    window.location.href = '/oauth/complete';
  };

  // NEW: Pass referral code to ProfileForm
  return <ProfileForm user={user} onSuccess={handleSuccess} referredByCode={ref} />;
}
```

#### 4.7 Modify `/oauth/complete` Route

Clear referral cookie:

```typescript
// src/routes/oauth/complete.tsx - MODIFIED

import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@workos/authkit-tanstack-react-start';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import {
  clearOAuthSessionCookie,
  decryptSession,
  getOAuthSessionFromRequest,
} from '../../lib/oauth-session';
import { clearReferralCookie } from '../../lib/referral-cookie';  // NEW
import { generateAuthorizationCode } from '../../lib/oauth-tokens';

const getConvexClient = () => {
  const url = process.env.VITE_CONVEX_URL;
  if (!url) throw new Error('VITE_CONVEX_URL not set');
  return new ConvexHttpClient(url);
};

export const Route = createFileRoute('/oauth/complete')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getAuth();

        if (!auth.user) {
          return new Response('Unauthorized', { status: 401 });
        }

        // Retrieve OAuth session
        const encryptedSession = getOAuthSessionFromRequest(request);
        if (!encryptedSession) {
          return new Response(
            'OAuth session expired. Please start the login process again.',
            { status: 400 },
          );
        }

        const oauthSession = await decryptSession(encryptedSession);
        if (!oauthSession) {
          return new Response('Invalid OAuth session', { status: 400 });
        }

        // Generate authorization code
        const code = generateAuthorizationCode();
        const convex = getConvexClient();

        await convex.mutation(api.oauth.createAuthorizationCode, {
          code,
          clientId: oauthSession.clientId,
          workosUserId: auth.user.id,
          redirectUri: oauthSession.redirectUri,
          codeChallenge: oauthSession.codeChallenge,
          codeChallengeMethod: oauthSession.codeChallengeMethod,
          scope: oauthSession.scope,
          expiresAt: Date.now() + 600000,
        });

        // Redirect to Circle with code
        const redirectUrl = new URL(oauthSession.redirectUri);
        redirectUrl.searchParams.set('code', code);
        redirectUrl.searchParams.set('state', oauthSession.state);

        const headers = new Headers();
        headers.set('Location', redirectUrl.toString());
        clearOAuthSessionCookie(headers);
        clearReferralCookie(headers);  // NEW: Clear referral cookie

        return new Response(null, {
          status: 302,
          headers,
        });
      },
    },
  },
});
```

---

### Phase 5: Update ProfileForm Component

#### 5.1 Modify `src/components/ProfileForm.tsx`

Accept and pass referral code to mutation:

```typescript
// src/components/ProfileForm.tsx - MODIFIED SECTIONS

interface ProfileFormProps {
  user: User
  onSuccess?: () => void
  referredByCode?: string  // NEW
}

export function ProfileForm({ user, onSuccess, referredByCode }: ProfileFormProps) {
  // ... existing code ...

  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => {
      setErrorDismissed(false)
      createProfile({
        email: user.email,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        workosUserId: user.id,
        referredByCode,  // NEW: Pass referral code
        ...value,
      })
    },
  })

  // ... rest of component unchanged ...
}
```

---

### Phase 6: Update Profile Schema

#### 6.1 Modify `src/lib/schemas/profile.ts`

Add optional referredByCode to mutation schema:

```typescript
// src/lib/schemas/profile.ts - ADD to profileMutationSchema

// Extended schema for mutations that require user identification
export const profileMutationSchema = profileFormSchema.extend({
  workosUserId: z.string().min(1),
  email: z.string().email(),
  firstName: optionalString,
  lastName: optionalString,
  referredByCode: optionalString,  // NEW: Optional referral attribution
});
```

---

### Phase 7: Direct Signup Flow (Non-OAuth)

#### 7.1 Modify Home Page to Read Referral Cookie

For users who sign up directly (not through Circle), we need to:
1. Read the `pending_referral` cookie server-side
2. Pass it to the ProfileForm

```typescript
// src/routes/index.tsx - MODIFIED

import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/start'
import { Authenticated, Unauthenticated } from 'convex/react'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { getAuth, getSignInUrl, getSignUpUrl } from '@workos/authkit-tanstack-react-start'
import { useEffect } from 'react'
import type { User } from '@workos/authkit-tanstack-react-start'
import { ProfileForm } from '../components/ProfileForm'
import { api } from '../../convex/_generated/api'
import { convexQuery } from '@convex-dev/react-query'

// NEW: Server function to read referral cookie
const getReferralCode = createServerFn({ method: 'GET' }).handler(async ({ request }) => {
  const cookieHeader = request?.headers.get('cookie')
  if (!cookieHeader) return null

  const match = cookieHeader.match(/pending_referral=([^;]+)/)
  return match ? match[1] : null
})

export const Route = createFileRoute('/')({
  component: Home,
  loader: async ({ context }) => {
    const { user } = await getAuth()
    const signInUrl = await getSignInUrl()
    const signUpUrl = await getSignUpUrl()

    // NEW: Get referral code from cookie
    const referralCode = await getReferralCode()

    if (user) {
      await context.queryClient.ensureQueryData(
        convexQuery(api.profiles.getByWorkosUserId, { workosUserId: user.id }),
      )
    }

    return { user, signInUrl, signUpUrl, referralCode }
  },
})

function Home() {
  const { user, signInUrl, signUpUrl, referralCode } = Route.useLoaderData()
  return (
    <HomeContent
      user={user}
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      referralCode={referralCode}  // NEW
    />
  )
}

function HomeContent({
  user,
  signInUrl,
  signUpUrl,
  referralCode,  // NEW
}: {
  user: User | null
  signInUrl: string
  signUpUrl: string
  referralCode: string | null  // NEW
}) {
  return (
    <div className='min-h-screen flex flex-col'>
      <header className='sticky top-0 z-10 bg-card border-b border-border'>
        <div className='flex items-center justify-between px-4 py-3 sm:px-6'>
          <span className='font-semibold text-foreground'>Recovery Jobs</span>
          {user && <UserMenu user={user} />}
        </div>
      </header>
      <AuthDebug />
      <main className='flex-1'>
        <Authenticated>
          {user && <ProfileForm user={user} referredByCode={referralCode ?? undefined} />}
        </Authenticated>
        <Unauthenticated>
          <div className='flex flex-col items-center justify-center min-h-[calc(100vh-53px)] gap-6 px-4 py-8'>
            <h1 className='text-2xl sm:text-3xl font-bold text-center'>Welcome to Recovery Jobs</h1>
            <p className='text-muted-foreground text-center'>Sign in to access your profile</p>
            <SignInForm signInUrl={signInUrl} signUpUrl={signUpUrl} />
          </div>
        </Unauthenticated>
      </main>
    </div>
  )
}

// ... rest of file unchanged ...
```

---

### Phase 8: Referral Dashboard Component

#### 8.1 Create `src/components/ReferralCard.tsx`

```typescript
// src/components/ReferralCard.tsx
import { useSuspenseQuery } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { useState } from 'react';
import { api } from '../../convex/_generated/api';
import { useToast } from '@/hooks/use-toast';

const REWARD_TIERS = [
  { count: 3, reward: 'T-Shirt', emoji: '👕' },
  { count: 10, reward: 'Hoodie', emoji: '🧥' },
  { count: 25, reward: 'Merch Bundle', emoji: '🎁' },
];

interface ReferralCardProps {
  workosUserId: string;
}

export function ReferralCard({ workosUserId }: ReferralCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data: stats } = useSuspenseQuery(
    convexQuery(api.referrals.getMyReferralStats, { workosUserId })
  );

  if (!stats) return null;

  const shareUrl = `${window.location.origin}/join/${stats.code}`;
  const nextTier = REWARD_TIERS.find((t) => t.count > stats.totalReferrals);
  const currentTierProgress = nextTier
    ? (stats.totalReferrals / nextTier.count) * 100
    : 100;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'Share it with friends to earn rewards.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Please copy the link manually.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl p-6 border border-primary/10">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🎁</span>
        <h3 className="font-semibold text-lg text-foreground">
          Invite Friends, Earn Merch
        </h3>
      </div>

      {/* Share URL Input */}
      <div className="flex gap-2 mb-4">
        <input
          readOnly
          value={shareUrl}
          className="flex-1 px-3 py-2 bg-background rounded-lg border border-border text-sm font-mono truncate"
        />
        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-muted-foreground">
          <strong className="text-primary">{stats.totalReferrals}</strong>{' '}
          {stats.totalReferrals === 1 ? 'referral' : 'referrals'}
        </span>
        {nextTier && (
          <span className="text-muted-foreground">
            {nextTier.count - stats.totalReferrals} more → {nextTier.emoji} {nextTier.reward}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {nextTier && (
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(currentTierProgress, 100)}%` }}
          />
        </div>
      )}

      {/* Earned Tiers */}
      {stats.totalReferrals >= 3 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-2">Rewards earned:</p>
          <div className="flex gap-2">
            {REWARD_TIERS.filter((t) => t.count <= stats.totalReferrals).map((tier) => (
              <span
                key={tier.reward}
                className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
              >
                {tier.emoji} {tier.reward}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Phase 9: Environment Variables

Add to your environment configuration:

```bash
# .env.local (add these)

# Circle community domain
CIRCLE_DOMAIN=mycommunity.circle.so

# Default Circle invite code (optional, for general invite link)
DEFAULT_CIRCLE_INVITE=your_default_invite_code
```

---

## Testing Checklist

### Unit Tests

- [ ] `generateUniqueCode` produces valid 6-char codes
- [ ] `recordReferral` prevents self-referral
- [ ] `recordReferral` prevents duplicate referrals
- [ ] Cookie utilities set/get/clear correctly

### Integration Tests

- [ ] `/join/CODE` sets cookie and redirects to Circle
- [ ] OAuth flow preserves referral through session
- [ ] Profile creation with referral records attribution
- [ ] Profile creation without referral works normally
- [ ] Existing users don't get new referral codes on profile update

### E2E Flow Tests

1. **Referral → Circle → New User**
   - Visit `/join/TESTCODE`
   - Verify cookie is set
   - Complete Circle SSO
   - Complete profile
   - Verify referral recorded in database

2. **Direct Signup with Prior Referral**
   - Set `pending_referral` cookie manually
   - Visit `/` and sign up
   - Complete profile
   - Verify referral recorded

3. **Existing User Login**
   - Login as existing user
   - Verify referral code exists on profile
   - Verify share link works

---

## Migration Steps

1. **Deploy schema changes** (new index, new table)
2. **Run migration** to backfill `referralCode` for existing profiles
3. **Deploy code changes** in order:
   - Convex functions first
   - Then frontend routes
4. **Add environment variables**
5. **Test full flow**

---

## Summary of Files to Modify/Create

### New Files
- `convex/referrals.ts` - Referral functions
- `convex/migrations.ts` - Backfill migration
- `src/lib/referral-cookie.ts` - Cookie utilities
- `src/routes/join/$code.tsx` - Referral entry point
- `src/components/ReferralCard.tsx` - Dashboard widget

### Modified Files
- `convex/schema.ts` - Add `referralCode` to profiles, add `referrals` table
- `convex/profiles.ts` - Accept `referredByCode`, generate codes
- `src/lib/oauth-session.ts` - Add `referralCode` to session
- `src/lib/schemas/profile.ts` - Add `referredByCode` to mutation schema
- `src/routes/oauth/authorize.tsx` - Read referral cookie into session
- `src/routes/oauth/callback.tsx` - Pass referral to profile page
- `src/routes/oauth/profile.tsx` - Accept `ref` query param
- `src/routes/oauth/complete.tsx` - Clear referral cookie
- `src/routes/index.tsx` - Read referral cookie for direct signups
- `src/components/ProfileForm.tsx` - Accept and pass `referredByCode`
