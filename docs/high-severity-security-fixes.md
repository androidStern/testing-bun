# High Severity Security Fixes Plan

## Overview
Fix high severity security issues identified in the code review, organized into three categories:
1. **Race Conditions (TOCTOU)** - Data integrity vulnerabilities
2. **Missing Security Features** - OAuth2 spec compliance
3. **Information Disclosure** - Leaking system state to attackers

---

## Category 1: Race Conditions (TOCTOU Vulnerabilities)

### Understanding Convex's Transaction Model

Convex provides **serializable isolation** with **Optimistic Concurrency Control (OCC)**. This has important implications for race conditions:

1. **Each mutation is a complete transaction** - All reads and writes are atomic
2. **Read ranges are tracked** - Even empty query results are part of the transaction's read set
3. **Automatic retry on conflicts** - When two mutations conflict, the second is automatically retried

**The key rule:** If check-then-write operations are in the **same mutation**, OCC handles race conditions automatically. If they're in **separate calls** (e.g., `runQuery` then `runMutation`), they are NOT protected.

**References:**
- [OCC and Atomicity | Convex Developer Hub](https://docs.convex.dev/database/advanced/occ)
- [Unique database fields - Convex Community](https://discord-questions.convex.dev/m/1130486747931877498)

---

### Issue 1A: Duplicate Application Race Condition
**File:** `convex/applications.ts:138-158`

**Problem:** Between checking for duplicate and inserting, another request can insert.
```typescript
// Lines 139-149: Check for duplicates
const existingApplications = await ctx.db.query('applications')...
const alreadyApplied = existingApplications.some(...);
if (alreadyApplied) throw new Error('...');

// Lines 152-158: Insert
const result = await ctx.db.insert('applications', {...});
```

**Assessment:** This is already in a **single mutation**, so Convex's OCC protects it:
1. If two concurrent mutations both check and find nothing, both attempt to insert
2. First mutation commits successfully
3. Second mutation's read set (the queried index range) conflicts with the first's write
4. Second mutation is **automatically retried**
5. On retry, it sees the existing application and throws "Already applied"

**Fix:** **NO CODE CHANGE REQUIRED** - The existing check-then-insert pattern within a single mutation is already protected by Convex's serializable transactions.

**Same applies to:** `applications.ts:97-114` (internal `create` mutation) - also protected

---

### Issue 1B: OAuth Auth Code Double-Use Race
**File:** `convex/oauth.ts:48-63`

**Problem:** Check if `used === false` and mark as used are **separate API calls** (separate transactions).
```typescript
// In token.tsx line 130-131: Check if used (TRANSACTION 1 - via query or earlier mutation)
if (authCode.used) {
  return errorResponse('invalid_grant', 'Authorization code already used');
}

// Line 164: Mark as used (TRANSACTION 2 - RACE WINDOW between these calls)
await convex.mutation(api.oauth.markCodeAsUsed, { internalSecret, code });
```

**Why this needs fixing:** Unlike Issue 1A, the check and write happen in **separate Convex calls** from the HTTP handler. Each call is its own transaction, so OCC cannot protect against races between them.

**Fix:** Create atomic `exchangeAuthorizationCode` mutation that checks AND marks in one transaction:

```typescript
// In convex/oauth.ts - NEW FUNCTION:
export const exchangeAuthorizationCode = mutation({
  args: {
    internalSecret: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    verifyInternalSecret(args.internalSecret);

    const authCode = await ctx.db
      .query('oauthAuthorizationCodes')
      .withIndex('by_code', (q) => q.eq('code', args.code))
      .first();

    if (!authCode) return { success: false, error: 'not_found' };
    if (authCode.used) return { success: false, error: 'already_used' };
    if (Date.now() > authCode.expiresAt) return { success: false, error: 'expired' };

    // Atomically mark as used
    await ctx.db.patch(authCode._id, { used: true });

    return { success: true, authCode };
  },
});
```

Then update `token.tsx` to use this single atomic call.

---

### Issue 1C: Sender Creation Race
**File:** `convex/http.ts:140-151`

**Problem:** Check if sender exists, then create if not - **separate API calls** (separate transactions).
```typescript
const sender = await ctx.runQuery(api.senders.getByPhone, { phone });  // TRANSACTION 1
if (!sender) {
  // RACE WINDOW - another request could create sender between these calls
  senderId = await ctx.runMutation(api.senders.create, {...});  // TRANSACTION 2
}
```

**Why this needs fixing:** `runQuery` and `runMutation` are **separate transactions**. Two concurrent requests could both see no sender exists, then both try to create one.

**Fix:** Create `getOrCreate` mutation in senders.ts (combines check + create in single transaction):
```typescript
// In convex/senders.ts - NEW FUNCTION:
export const getOrCreate = mutation({
  args: {
    phone: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    // Check again inside mutation (atomic)
    const existing = await ctx.db
      .query('senders')
      .withIndex('by_phone', (q) => q.eq('phone', args.phone))
      .first();

    if (existing) {
      return { sender: existing, created: false };
    }

    const id = await ctx.db.insert('senders', {
      phone: args.phone,
      status: args.status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const sender = await ctx.db.get(id);
    return { sender: sender!, created: true };
  },
});
```

Update `http.ts` to use single `getOrCreate` call.

---

### Issue 1D: Referral Code Generation Race
**File:** `convex/referrals.ts`

**Problem:** Generate code → check if exists → return (race window)

**Current mitigation:** Already has timestamp fallback. This is low risk since:
- 6-char codes have 2.1 billion possibilities
- Timestamp fallback catches collisions
- Impact is just duplicate codes (cosmetic issue)

**Recommendation:** Keep current implementation - acceptable risk.

---

## Category 2: Missing OAuth Security Features

### Issue 2A: No Refresh Token Rotation
**File:** `src/routes/oauth/token.tsx:211-263`

**Problem:** RFC 6749 recommends issuing new refresh token on each use. Current implementation reuses same token for 30 days.

**Risk:** Stolen refresh token remains valid for entire 30-day period.

**Fix:** In `handleRefreshTokenGrant`:
```typescript
async function handleRefreshTokenGrant(...): Promise<Response> {
  // ... existing validation ...

  // Generate NEW refresh token (rotation)
  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenExpiry = Date.now() + 2592000000; // 30 days

  // Store new refresh token
  await convex.mutation(api.oauth.createRefreshToken, {
    internalSecret,
    token: newRefreshToken,
    workosUserId: storedToken.workosUserId,
    clientId: storedToken.clientId,
    scope: storedToken.scope,
    expiresAt: newRefreshTokenExpiry,
  });

  // Delete old refresh token (requires new mutation)
  await convex.mutation(api.oauth.deleteRefreshToken, {
    internalSecret,
    token: refreshToken,
  });

  // ... generate access token ...

  return new Response(
    JSON.stringify({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: newRefreshToken,  // Return NEW token
      scope: storedToken.scope || '',
    }),
    ...
  );
}
```

**New mutation needed in oauth.ts:**
```typescript
export const deleteRefreshToken = mutation({
  args: {
    internalSecret: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    verifyInternalSecret(args.internalSecret);
    const tokenDoc = await ctx.db
      .query('oauthRefreshTokens')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();
    if (tokenDoc) {
      await ctx.db.delete(tokenDoc._id);
    }
  },
});
```

---

### Issue 2B: No Auth Code Revocation on Reuse Detection
**File:** `src/routes/oauth/token.tsx:130-131`

**Problem:** Per RFC 6749 Section 10.5, when authorization code reuse is detected, MUST revoke all tokens issued with that code.

**Fix:** When code reuse detected, revoke associated tokens:
```typescript
if (authCode.used) {
  // SECURITY: Revoke all tokens issued with this code
  // This indicates potential attack - code was stolen and replayed
  await convex.mutation(api.oauth.revokeTokensByAuthCode, {
    internalSecret,
    workosUserId: authCode.workosUserId,
    clientId: authCode.clientId,
  });

  return errorResponse('invalid_grant', 'Authorization code already used');
}
```

**New mutation needed:**
```typescript
export const revokeTokensByAuthCode = mutation({
  args: {
    internalSecret: v.string(),
    workosUserId: v.string(),
    clientId: v.string(),
  },
  handler: async (ctx, args) => {
    verifyInternalSecret(args.internalSecret);

    // Delete all access tokens for this user+client
    const accessTokens = await ctx.db
      .query('oauthAccessTokens')
      .filter((q) =>
        q.and(
          q.eq(q.field('workosUserId'), args.workosUserId),
          q.eq(q.field('clientId'), args.clientId)
        )
      )
      .collect();

    for (const token of accessTokens) {
      await ctx.db.delete(token._id);
    }

    // Delete all refresh tokens for this user+client
    const refreshTokens = await ctx.db
      .query('oauthRefreshTokens')
      .filter((q) =>
        q.and(
          q.eq(q.field('workosUserId'), args.workosUserId),
          q.eq(q.field('clientId'), args.clientId)
        )
      )
      .collect();

    for (const token of refreshTokens) {
      await ctx.db.delete(token._id);
    }

    console.warn(`SECURITY: Revoked tokens for ${args.workosUserId} due to auth code reuse`);
  },
});
```

---

### Issue 2C: Client Secrets Stored as SHA-256
**File:** `src/lib/oauth-tokens.ts:42-50`

**Problem:** SHA-256 is fast, making brute-force feasible. Should use bcrypt/scrypt.

**Assessment:**
- Only one OAuth client (Circle.so)
- Circle controls their own secret
- Changing requires re-hashing existing secrets (breaking change)

**Recommendation:** DEFER - Low priority. Document as tech debt for future.

---

## Category 3: Information Disclosure

### Issue 3A: Detailed Error Codes Leak System State
**File:** `convex/applications.ts:226-254`

**Problem:** Returns specific errors that reveal internal state:
- `employer_not_found` → confirms sender exists
- `employer_pending` → reveals approval status
- `employer_rejected` → confirms rejection

**Fix:** Consolidate to generic errors:
```typescript
// Replace lines 246-254 with:
if (!employer || employer.status !== 'approved') {
  return { error: 'unauthorized' as const };
}

// Replace lines 253-254 with:
if (!job || job.senderId !== senderId) {
  return { error: 'unauthorized' as const };
}
```

---

### Issue 3B: Twilio API Errors Exposed
**File:** `convex/lib/twilio.ts:74-76`

**Problem:** Error message includes Twilio's internal error details.
```typescript
throw new Error(`Twilio API error: ${data.message || ...} (code: ${data.code})`);
```

**Fix:**
```typescript
if (!response.ok) {
  // Log full details server-side for debugging
  console.error('Twilio API error', {
    status: response.status,
    message: data.message,
    code: data.code,
  });
  // Throw generic error to caller
  throw new Error('Failed to send SMS');
}
```

---

### Issue 3C: Phone Numbers Logged (PII)
**File:** `convex/lib/twilio.ts:78`

**Problem:** Full phone numbers in logs violate privacy (GDPR, CCPA).
```typescript
console.log(`SMS sent to ${to}, SID: ${data.sid}`);
```

**Fix:**
```typescript
// Redact phone number - show only last 4 digits
const redactedPhone = `***${to.slice(-4)}`;
console.log(`SMS sent to ${redactedPhone}, SID: ${data.sid}`);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `convex/applications.ts` | Consolidate error messages (no race condition fix needed - OCC handles it) |
| `convex/oauth.ts` | Add `exchangeAuthorizationCode`, `deleteRefreshToken`, `revokeTokensByAuthCode` |
| `convex/senders.ts` | Add `getOrCreate` mutation |
| `convex/http.ts` | Use `senders.getOrCreate` |
| `convex/lib/twilio.ts` | Redact PII, sanitize error messages |
| `src/routes/oauth/token.tsx` | Use atomic auth code exchange, add refresh token rotation, add revocation |

---

## Implementation Order

1. **Information Disclosure fixes** (quick wins, no breaking changes)
2. **Race condition fixes** (Issues 1B and 1C only - Issue 1A is already protected)
3. **OAuth security features** (spec compliance)

---

## Testing Checklist
- [ ] Rapid double-click on "Apply" button doesn't create duplicate applications (already protected by OCC - verify behavior)
- [ ] OAuth code can only be exchanged once (requires new `exchangeAuthorizationCode` mutation)
- [ ] Refresh token is rotated on each use
- [ ] Auth code reuse triggers token revocation
- [ ] Sender `getOrCreate` prevents duplicate senders under concurrent requests
- [ ] Error messages don't leak system state
- [ ] Phone numbers are redacted in logs
