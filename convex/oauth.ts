import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { timingSafeEqual } from './lib/crypto';
import { env } from './lib/env';

// Verify internal secret for OAuth operations
// Uses constant-time comparison to prevent timing attacks
function verifyInternalSecret(secret: string | undefined) {
  // Normalize to empty string to avoid timing leak from !secret check
  const providedSecret = secret || '';
  if (!timingSafeEqual(providedSecret, env.CONVEX_INTERNAL_SECRET)) {
    throw new Error('Invalid internal secret');
  }
}

// Authorization Codes
export const createAuthorizationCode = mutation({
  args: {
    internalSecret: v.string(),
    code: v.string(),
    clientId: v.string(),
    workosUserId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()),
    scope: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    verifyInternalSecret(args.internalSecret);
    const { internalSecret: _, ...data } = args;
    return await ctx.db.insert('oauthAuthorizationCodes', {
      ...data,
      used: false,
      createdAt: Date.now(),
    });
  },
});

export const getAuthorizationCode = query({
  args: { code: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('oauthAuthorizationCodes'),
      _creationTime: v.number(),
      code: v.string(),
      clientId: v.string(),
      workosUserId: v.string(),
      redirectUri: v.string(),
      codeChallenge: v.optional(v.string()),
      codeChallengeMethod: v.optional(v.string()),
      scope: v.optional(v.string()),
      expiresAt: v.number(),
      used: v.boolean(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('oauthAuthorizationCodes')
      .withIndex('by_code', (q) => q.eq('code', args.code))
      .first();
  },
});

// Atomic auth code exchange - validates and marks as used in single transaction
// Returns auth code data on success, error object on failure
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

    if (!authCode) {
      console.error('exchangeAuthorizationCode: code not found', { code: args.code });
      return { success: false as const, error: 'not_found' as const };
    }

    if (authCode.used) {
      console.error('exchangeAuthorizationCode: code already used - revoking tokens', {
        code: args.code,
        workosUserId: authCode.workosUserId,
        clientId: authCode.clientId,
      });

      // SECURITY: Revoke all tokens atomically within this mutation (RFC 6749 Section 10.5)
      // This prevents race window between detection and revocation
      const accessTokens = await ctx.db
        .query('oauthAccessTokens')
        .withIndex('by_user_client', (q) =>
          q.eq('workosUserId', authCode.workosUserId).eq('clientId', authCode.clientId)
        )
        .collect();

      for (const token of accessTokens) {
        await ctx.db.delete(token._id);
      }

      const refreshTokens = await ctx.db
        .query('oauthRefreshTokens')
        .withIndex('by_user_client', (q) =>
          q.eq('workosUserId', authCode.workosUserId).eq('clientId', authCode.clientId)
        )
        .collect();

      for (const token of refreshTokens) {
        await ctx.db.delete(token._id);
      }

      console.warn(
        `SECURITY: Revoked ${accessTokens.length} access + ${refreshTokens.length} refresh tokens for ${authCode.workosUserId} due to auth code reuse`
      );

      return {
        success: false as const,
        error: 'already_used' as const,
      };
    }

    if (Date.now() > authCode.expiresAt) {
      console.error('exchangeAuthorizationCode: code expired', {
        code: args.code,
        expiresAt: authCode.expiresAt,
        now: Date.now(),
      });
      return { success: false as const, error: 'expired' as const };
    }

    // Atomically mark as used
    await ctx.db.patch(authCode._id, { used: true });

    return { success: true as const, authCode };
  },
});

// Atomic refresh token rotation - validates, creates new tokens, deletes old in single transaction
export const rotateRefreshToken = mutation({
  args: {
    internalSecret: v.string(),
    oldRefreshToken: v.string(),
    clientId: v.string(),
    newAccessToken: v.string(),
    newRefreshToken: v.string(),
    accessTokenExpiresAt: v.number(),
    refreshTokenExpiresAt: v.number(),
  },
  returns: v.union(
    v.object({ success: v.literal(false), error: v.string() }),
    v.object({
      success: v.literal(true),
      workosUserId: v.string(),
      scope: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    verifyInternalSecret(args.internalSecret);

    // 1. Validate old refresh token exists
    const oldToken = await ctx.db
      .query('oauthRefreshTokens')
      .withIndex('by_token', (q) => q.eq('token', args.oldRefreshToken))
      .first();

    if (!oldToken) {
      return { success: false as const, error: 'invalid_token' };
    }

    // 2. Validate client ID matches
    if (oldToken.clientId !== args.clientId) {
      return { success: false as const, error: 'client_mismatch' };
    }

    // 3. Validate not expired
    if (Date.now() > oldToken.expiresAt) {
      return { success: false as const, error: 'token_expired' };
    }

    const now = Date.now();

    // 4. Create new access token
    await ctx.db.insert('oauthAccessTokens', {
      token: args.newAccessToken,
      workosUserId: oldToken.workosUserId,
      clientId: oldToken.clientId,
      scope: oldToken.scope,
      expiresAt: args.accessTokenExpiresAt,
      createdAt: now,
    });

    // 5. Create new refresh token
    await ctx.db.insert('oauthRefreshTokens', {
      token: args.newRefreshToken,
      workosUserId: oldToken.workosUserId,
      clientId: oldToken.clientId,
      scope: oldToken.scope,
      expiresAt: args.refreshTokenExpiresAt,
      createdAt: now,
    });

    // 6. Delete old refresh token
    await ctx.db.delete(oldToken._id);

    return {
      success: true as const,
      workosUserId: oldToken.workosUserId,
      scope: oldToken.scope,
    };
  },
});

// Access Tokens
export const createAccessToken = mutation({
  args: {
    internalSecret: v.string(),
    token: v.string(),
    workosUserId: v.string(),
    clientId: v.string(),
    scope: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    verifyInternalSecret(args.internalSecret);
    const { internalSecret: _, ...data } = args;
    return await ctx.db.insert('oauthAccessTokens', {
      ...data,
      createdAt: Date.now(),
    });
  },
});

export const getAccessToken = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('oauthAccessTokens'),
      _creationTime: v.number(),
      token: v.string(),
      workosUserId: v.string(),
      clientId: v.string(),
      scope: v.optional(v.string()),
      expiresAt: v.number(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query('oauthAccessTokens')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();

    // Validate expiry server-side - treat expired tokens as non-existent
    if (tokenDoc && Date.now() > tokenDoc.expiresAt) {
      return null;
    }

    return tokenDoc;
  },
});

// Refresh Tokens
export const createRefreshToken = mutation({
  args: {
    internalSecret: v.string(),
    token: v.string(),
    workosUserId: v.string(),
    clientId: v.string(),
    scope: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    verifyInternalSecret(args.internalSecret);
    const { internalSecret: _, ...data } = args;
    return await ctx.db.insert('oauthRefreshTokens', {
      ...data,
      createdAt: Date.now(),
    });
  },
});

export const getRefreshToken = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('oauthRefreshTokens'),
      _creationTime: v.number(),
      token: v.string(),
      workosUserId: v.string(),
      clientId: v.string(),
      scope: v.optional(v.string()),
      expiresAt: v.number(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query('oauthRefreshTokens')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();

    // Validate expiry server-side - treat expired tokens as non-existent
    if (tokenDoc && Date.now() > tokenDoc.expiresAt) {
      return null;
    }

    return tokenDoc;
  },
});

// OAuth Clients
export const getClient = query({
  args: {
    internalSecret: v.string(),
    clientId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('oauthClients'),
      _creationTime: v.number(),
      clientId: v.string(),
      clientSecret: v.string(),
      name: v.string(),
      redirectUris: v.array(v.string()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    verifyInternalSecret(args.internalSecret);
    return await ctx.db
      .query('oauthClients')
      .withIndex('by_client_id', (q) => q.eq('clientId', args.clientId))
      .first();
  },
});

export const createClient = mutation({
  args: {
    internalSecret: v.string(),
    clientId: v.string(),
    clientSecret: v.string(),
    name: v.string(),
    redirectUris: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    verifyInternalSecret(args.internalSecret);
    const { internalSecret: _, ...data } = args;
    const existing = await ctx.db
      .query('oauthClients')
      .withIndex('by_client_id', (q) => q.eq('clientId', data.clientId))
      .first();

    if (existing) {
      throw new Error('Client already exists');
    }

    return await ctx.db.insert('oauthClients', {
      ...data,
      createdAt: Date.now(),
    });
  },
});
