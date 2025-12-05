import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Authorization Codes
export const createAuthorizationCode = mutation({
  args: {
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
    return await ctx.db.insert('oauthAuthorizationCodes', {
      ...args,
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
  args: { code: v.string() },
  handler: async (ctx, args) => {
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
    token: v.string(),
    workosUserId: v.string(),
    clientId: v.string(),
    scope: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('oauthAccessTokens', {
      ...args,
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
    token: v.string(),
    workosUserId: v.string(),
    clientId: v.string(),
    scope: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('oauthRefreshTokens', {
      ...args,
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
    clientId: v.string(),
    clientSecret: v.string(),
    name: v.string(),
    redirectUris: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('oauthClients')
      .withIndex('by_client_id', (q) => q.eq('clientId', args.clientId))
      .first();

    if (existing) {
      throw new Error('Client already exists');
    }

    return await ctx.db.insert('oauthClients', {
      ...args,
      createdAt: Date.now(),
    });
  },
});
