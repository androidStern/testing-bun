import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from 'convex-helpers/server/customFunctions';

import { action, mutation, query } from './_generated/server';

// Helper to check admin status
function isAdminEmail(email: string): boolean {
  const adminEmails =
    process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()) ??
    [];
  return adminEmails.includes(email.toLowerCase());
}

// Authenticated query - requires login
export const authQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Authentication required');
    return { user: { subject: identity.subject } };
  }),
);

// Authenticated mutation - requires login
export const authMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Authentication required');
    return { user: { subject: identity.subject } };
  }),
);

// Admin-only query - looks up email from profiles table
export const adminQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Authentication required');

    // WorkOS JWT doesn't include email, so look up from profiles table
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
      .first();

    if (!profile?.email) throw new Error('Profile not found');
    if (!isAdminEmail(profile.email)) throw new Error('Admin access required');

    return { user: { subject: identity.subject, email: profile.email } };
  }),
);

// Admin-only mutation - looks up email from profiles table
export const adminMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Authentication required');

    // WorkOS JWT doesn't include email, so look up from profiles table
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
      .first();

    if (!profile?.email) throw new Error('Profile not found');
    if (!isAdminEmail(profile.email)) throw new Error('Admin access required');

    return { user: { subject: identity.subject, email: profile.email } };
  }),
);

// Admin-only action - checks auth via runQuery
export const adminAction = customAction(
  action,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Authentication required');

    // Actions don't have direct db access, use public query
    const { api } = require('./_generated/api');
    const profile = await ctx.runQuery(api.profiles.getByWorkosUserId, {
      workosUserId: identity.subject,
    });

    if (!profile?.email) throw new Error('Profile not found');
    if (!isAdminEmail(profile.email)) throw new Error('Admin access required');

    return { user: { subject: identity.subject, email: profile.email } };
  }),
);
