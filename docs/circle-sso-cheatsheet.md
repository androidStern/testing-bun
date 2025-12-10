# Circle SSO + WorkOS + Convex Cheatsheet

## Architecture Overview

```
Circle.so → /oauth/authorize → WorkOS Auth → /oauth/callback
                                                    ↓
                                           (has profile?)
                                              ↓        ↓
                                            yes       no
                                              ↓        ↓
                                    /oauth/complete  /oauth/profile
                                              ↓        ↓
                                              ↓   (form submit)
                                              ↓        ↓
                                    Circle callback (with code & state)
```

---

## Files Created

| File | Purpose |
|------|---------|
| `src/routes/oauth/authorize.tsx` | Entry point from Circle, stores session, redirects to WorkOS |
| `src/routes/oauth/callback.tsx` | Post-WorkOS, checks profile, routes accordingly |
| `src/routes/oauth/profile.tsx` | Profile form for new users |
| `src/routes/oauth/complete.tsx` | Generates auth code, redirects back to Circle |
| `src/routes/oauth/token.tsx` | Token exchange endpoint for Circle |
| `src/routes/oauth/userinfo.tsx` | Returns user data to Circle |
| `src/lib/oauth-session.ts` | Encrypts/decrypts OAuth session cookie |
| `src/lib/oauth-tokens.ts` | Token generation, PKCE validation, hashing |
| `convex/oauth.ts` | Auth codes, tokens, client management |
| `convex/profiles.ts` | Profile CRUD operations |
| `convex/schema.ts` | Database schema (profiles, oauthClients, tokens, etc.) |

---

## Environment Variables

### Development (`.env.local`)

```bash
# Convex
CONVEX_DEPLOYMENT=dev:cheery-loris-723
VITE_CONVEX_URL=https://cheery-loris-723.convex.cloud

# WorkOS
WORKOS_CLIENT_ID=client_XXXXX
WORKOS_API_KEY=sk_test_XXXXX
WORKOS_COOKIE_PASSWORD=<32+ chars>
WORKOS_REDIRECT_URI=http://localhost:3000/callback

# OAuth Session
OAUTH_SESSION_SECRET=<32+ chars>
```

### Production (Coolify)

```bash
# Convex
CONVEX_DEPLOYMENT=prod:cheery-loris-723
VITE_CONVEX_URL=https://cheery-loris-723.convex.cloud

# WorkOS (production keys)
WORKOS_CLIENT_ID=client_XXXXX
WORKOS_API_KEY=sk_live_XXXXX
WORKOS_COOKIE_PASSWORD=<64 chars>
WORKOS_REDIRECT_URI=https://YOUR-APP-DOMAIN/callback

# OAuth Session
OAUTH_SESSION_SECRET=<64 chars>

# Node
NODE_ENV=production
```

### Generate Secrets

```bash
# Generate any secret
openssl rand -base64 48
```

---

## Circle SSO Configuration

| Field | Value |
|-------|-------|
| Authorization URL | `https://YOUR-APP-DOMAIN/oauth/authorize` |
| Token Fetch URL | `https://YOUR-APP-DOMAIN/oauth/token` |
| User Info API URL | `https://YOUR-APP-DOMAIN/oauth/userinfo` |
| Client ID | Generated client ID |
| Client Secret | Raw secret (NOT the hash) |
| Scopes | `openid profile email` |
| User ID response path | `sub` |
| User Email response path | `email` |
| User Name response path | `name` |
| Profile image URL response path | (leave blank) |

---

## OAuth Client Setup (Convex)

### Generate Credentials

```bash
CLIENT_ID=$(openssl rand -hex 16)
CLIENT_SECRET=$(openssl rand -hex 32)
SECRET_HASH=$(echo -n "$CLIENT_SECRET" | shasum -a 256 | cut -d' ' -f1)

echo "Client ID: $CLIENT_ID"
echo "Client Secret: $CLIENT_SECRET"    # Give to Circle
echo "Secret Hash: $SECRET_HASH"        # Store in Convex
```

### Create Client in Convex

Run `oauth:createClient` mutation in Convex Dashboard:

```json
{
  "clientId": "<CLIENT_ID>",
  "clientSecret": "<SECRET_HASH>",
  "name": "Circle",
  "redirectUris": ["https://community.recovery-jobs.com/oauth2/callback"]
}
```

---

## WorkOS Configuration

1. Add redirect URI: `https://YOUR-APP-DOMAIN/callback`
2. For production: use `sk_live_` API key (not `sk_test_`)

---

## Convex: Dev vs Prod

| Command | Deployment | Use Case |
|---------|------------|----------|
| `bunx convex dev` | `dev:slug` | Local development |
| `bunx convex deploy` | `prod:slug` | Production push |

URLs are the same (`xxx.convex.cloud`), distinguished by `CONVEX_DEPLOYMENT` env var.

---

## Local Testing with Tunnel

```bash
# Terminal 1: Dev server
bun run dev

# Terminal 2: Tunnel
cloudflared tunnel --url http://localhost:3000
```

Update for tunnel testing:
- `WORKOS_REDIRECT_URI` → tunnel URL + `/callback`
- WorkOS Dashboard → add tunnel redirect URI
- Circle SSO URLs → use tunnel URL
- `vite.config.ts` → `allowedHosts: true`

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing required OAuth parameters` | Circle not sending `state` | Enable state in Circle or make it optional |
| `OAuth session expired` | Cookie lost during redirect | Check `WORKOS_REDIRECT_URI` matches tunnel/prod URL |
| `Not Found` on `/oauth/complete` | Client-side navigation | Use `window.location.href` not `navigate()` |
| `Invalid client credentials` | Secret mismatch | Store HASH in Convex, give RAW to Circle |
| `.convex.site` error | Wrong Convex URL | Use `.convex.cloud` not `.convex.site` |

---

## Key Gotcha

**Server-only routes need full page redirects:**

```tsx
// WRONG - client-side navigation, won't hit server handler
navigate({ to: '/oauth/complete' });

// CORRECT - full page load, hits server handler
window.location.href = '/oauth/complete';
```
