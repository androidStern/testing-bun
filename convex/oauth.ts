import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { timingSafeEqual } from './lib/crypto';
import { env } from './lib/env';

// Verify internal secret for OAuth operations
// Uses constant-time comparison to prevent timing attacks
function verifyInternalSecret(secret: string | undefined) {
  if (!secret || !timingSafeEqual(secret, env.CONVEX_INTERNAL_SECRET)) {
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
  handler: async (ctx, args) => {
    return await ctx.db
      .query('oauthAuthorizationCodes')
      .withIndex('by_code', (q) => q.eq('code', args.code))
      .first();
  },
});

export const markCodeAsUsed = mutation({
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

    if (authCode) {
      await ctx.db.patch(authCode._id, { used: true });
    }
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
  handler: async (ctx, args) => {
    return await ctx.db
      .query('oauthAccessTokens')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();
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
  handler: async (ctx, args) => {
    return await ctx.db
      .query('oauthRefreshTokens')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();
  },
});

// OAuth Clients
export const getClient = query({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
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
