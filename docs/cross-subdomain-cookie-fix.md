# Cross-Subdomain Cookie & Domain Configuration Fix

## What We're Trying to Accomplish

We have a TanStack Start app using WorkOS AuthKit for authentication, deployed on Coolify. The app currently runs at `https://auth-test.apps.recovery-jobs.com`. We want to:

1. **Add a cleaner subdomain** for job-related pages: `https://jobs.apps.recovery-jobs.com`
2. **Share authentication sessions** across all `*.recovery-jobs.com` subdomains
3. **Fix the Apply URL bug** in Circle job posts (currently hardcoded to wrong domain)

## The Problem

When a user logs in at `auth-test.apps.recovery-jobs.com` and then visits `jobs.apps.recovery-jobs.com`, they appear logged out. This is because:

- By default, cookies are scoped to the **exact host** that set them
- The `wos-session` cookie (WorkOS auth) is only valid for `auth-test.apps.recovery-jobs.com`
- It's NOT automatically shared with other subdomains

## The Solution

Per [MDN Cookie documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies), a subdomain CAN set cookies for its parent domain:

> A server can only set the Domain attribute to its own domain or a parent domain

So `auth-test.apps.recovery-jobs.com` CAN set `Domain=recovery-jobs.com`, and that cookie will then be valid for ALL subdomains including:
- `auth-test.apps.recovery-jobs.com`
- `jobs.apps.recovery-jobs.com`
- `jobs.recovery-jobs.com` (if added later)
- `community.recovery-jobs.com` (Circle)
- Any future subdomain

---

## Current Infrastructure

| Component | URL |
|-----------|-----|
| Frontend (Coolify) | `https://auth-test.apps.recovery-jobs.com` |
| Convex Backend | `https://amiable-dove-3.convex.cloud` |
| Convex HTTP Site | `https://amiable-dove-3.convex.site` |
| Circle Community | `https://community.recovery-jobs.com` |
| DNS | Route 53: `*.apps.recovery-jobs.com` → `178.156.132.105` (Coolify) |

---

## Cookies That Need Domain Configuration

There are **3 cookies** in the app that need the domain attribute:

### 1. WorkOS Session (`wos-session`)

**Source:** WorkOS AuthKit package (`@workos/authkit-tanstack-react-start`)

**Current:** No domain attribute (scoped to exact host)

**Fix:** Set environment variable
```
WORKOS_COOKIE_DOMAIN=recovery-jobs.com
```

**Documentation:** [WorkOS AuthKit README](https://github.com/workos/authkit-nextjs)
> `WORKOS_COOKIE_DOMAIN` can be used to share WorkOS sessions between apps/domains. Note: The `WORKOS_COOKIE_PASSWORD` would need to be the same across apps/domains.

### 2. OAuth Session (`oauth_session`)

**Source:** `src/lib/oauth-session.ts`

**Current code (line 85):**
```typescript
const cookie = serialize(OAUTH_SESSION_COOKIE, encrypted, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 600, // 10 minutes
});
```

**Fix:** Add domain option (reusing `WORKOS_COOKIE_DOMAIN` for consistency)
```typescript
const cookie = serialize(OAUTH_SESSION_COOKIE, encrypted, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 600,
  domain: process.env.WORKOS_COOKIE_DOMAIN,  // ADD THIS
});
```

Also update `clearOAuthSessionCookie` function (line 105) to include domain.

### 3. Referral Cookie (`pending_referral`)

**Source:** `src/lib/referral-cookie.ts`

**Current code (line 9):**
```typescript
const cookie = serialize(REFERRAL_COOKIE, code, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: COOKIE_MAX_AGE,
});
```

**Fix:** Add domain option (reusing `WORKOS_COOKIE_DOMAIN` for consistency)
```typescript
const cookie = serialize(REFERRAL_COOKIE, code, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: COOKIE_MAX_AGE,
  domain: process.env.WORKOS_COOKIE_DOMAIN,  // ADD THIS
});
```

Also update `clearReferralCookie` function (line 28) to include domain.

---

## Apply URL Bug Fix

**Problem:** Circle job posts have Apply buttons linking to `https://recoveryjobs.com/apply/{jobId}` instead of our actual domain.

**Location:** `convex/inngest/processJob.ts` lines 178 and 226

**Current code:**
```typescript
const appBaseUrl = process.env.APP_BASE_URL || 'https://recoveryjobs.com';
```

**Fix:**
1. Set `APP_BASE_URL` env var on Convex
2. Remove the hardcoded fallback (or change to empty string to fail loudly if not configured)

---

## Step-by-Step Implementation

### Step 1: Coolify Environment Variables

In Coolify service settings → Environment, add:
```
WORKOS_COOKIE_DOMAIN=recovery-jobs.com
```

**Note on local development:** Do NOT set `WORKOS_COOKIE_DOMAIN` locally. When undefined, cookies default to the exact host (e.g., `localhost:3000`), which is the correct behavior for development.

### Step 2: Coolify Domain Configuration

In Coolify service settings → General → Domains, add the new subdomain:
```
https://auth-test.apps.recovery-jobs.com,https://jobs.apps.recovery-jobs.com
```
(comma-separated list - both domains point to same container)

### Step 3: Code Changes

**File: `src/lib/oauth-session.ts`**

Line 85 - add domain:
```typescript
const cookie = serialize(OAUTH_SESSION_COOKIE, encrypted, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 600,
  domain: process.env.WORKOS_COOKIE_DOMAIN,
});
```

Line 105 - add domain to clear function:
```typescript
const cookie = serialize(OAUTH_SESSION_COOKIE, '', {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 0,
  domain: process.env.WORKOS_COOKIE_DOMAIN,
});
```

**File: `src/lib/referral-cookie.ts`**

Line 9 - add domain:
```typescript
const cookie = serialize(REFERRAL_COOKIE, code, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: COOKIE_MAX_AGE,
  domain: process.env.WORKOS_COOKIE_DOMAIN,
});
```

Line 28 - add domain to clear function:
```typescript
const cookie = serialize(REFERRAL_COOKIE, '', {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 0,
  domain: process.env.WORKOS_COOKIE_DOMAIN,
});
```

**File: `convex/inngest/processJob.ts`**

Line 178 and 226 - remove hardcoded fallback:
```typescript
// BEFORE
const appBaseUrl = process.env.APP_BASE_URL || 'https://recoveryjobs.com';

// AFTER
const appBaseUrl = process.env.APP_BASE_URL;
if (!appBaseUrl) throw new Error('APP_BASE_URL environment variable is required');
```

### Step 4: Convex Environment Variable

```bash
bunx convex env set APP_BASE_URL "https://jobs.apps.recovery-jobs.com" --prod
```

### Step 5: WorkOS Dashboard

Go to [WorkOS Dashboard](https://dashboard.workos.com) → Redirects

Add redirect URI for the new subdomain:
- `https://jobs.apps.recovery-jobs.com/callback`

Or use a wildcard (if supported by your plan):
- `https://*.apps.recovery-jobs.com/callback`

### Step 6: Deploy

```bash
# Frontend - push to master triggers Coolify deploy
git add .
git commit -m "Configure cross-subdomain cookies for recovery-jobs.com"
git push origin master

# Backend - deploy Convex
bunx convex deploy
```

### Step 7: Redeploy on Coolify

After the push, go to Coolify and manually trigger a redeploy to pick up the new environment variables (or wait for automatic deploy if configured).

---

## Testing

### After deployment:

1. **Clear cookies** in browser (or use incognito)

2. **Login at original domain:**
   - Go to `https://auth-test.apps.recovery-jobs.com`
   - Complete login flow
   - Verify you're logged in

3. **Verify cookie domain:**
   - Open DevTools → Application → Cookies
   - Find `wos-session` cookie
   - Verify `Domain` column shows `recovery-jobs.com` (not `auth-test.apps.recovery-jobs.com`)

4. **Test cross-subdomain auth:**
   - Open new tab
   - Go to `https://jobs.apps.recovery-jobs.com`
   - Should still be logged in (same user)

5. **Test Apply URL:**
   - Create a test job posting via SMS
   - Approve it in Slack
   - Check the Circle post
   - Verify Apply button links to `https://jobs.apps.recovery-jobs.com/apply/{jobId}`

---

## Security Considerations

Setting cookies on `recovery-jobs.com` means:
- ALL subdomains under `recovery-jobs.com` can read these cookies
- If ANY subdomain is compromised, attacker could steal session

**This is acceptable because:**
- All subdomains are controlled by us
- No third-party subdomains exist
- The convenience of shared auth outweighs the theoretical risk

---

## Files Modified Summary

| File | Change |
|------|--------|
| `src/lib/oauth-session.ts` | Add `domain: process.env.WORKOS_COOKIE_DOMAIN` to both set and clear functions |
| `src/lib/referral-cookie.ts` | Add `domain: process.env.WORKOS_COOKIE_DOMAIN` to both set and clear functions |
| `convex/inngest/processJob.ts` | Remove hardcoded URL fallback, require `APP_BASE_URL` env var |

## Environment Variables Summary

| Location | Variable | Value | Notes |
|----------|----------|-------|-------|
| Coolify (prod) | `WORKOS_COOKIE_DOMAIN` | `recovery-jobs.com` | Shared by WorkOS AuthKit and our custom cookies |
| Convex (--prod) | `APP_BASE_URL` | `https://jobs.apps.recovery-jobs.com` | |
| Local dev | `WORKOS_COOKIE_DOMAIN` | (not set) | Cookies default to exact host when undefined |

## External Configuration

| Service | Change |
|---------|--------|
| Coolify | Add `https://jobs.apps.recovery-jobs.com` to Domains list |
| WorkOS Dashboard | Add redirect URI for new subdomain |

---

## References

- [MDN: Using HTTP Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [WorkOS AuthKit for TanStack Start](https://github.com/workos/authkit-tanstack-react-start)
- [WorkOS AuthKit for Next.js (more detailed docs)](https://github.com/workos/authkit-nextjs)
- [WorkOS Sessions Documentation](https://workos.com/docs/user-management/sessions)
