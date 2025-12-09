import { query } from './_generated/server';

// Check if current user is admin
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) return false;

    // WorkOS JWT doesn't include email, so look up from profiles table
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
      .first();

    if (!profile?.email) return false;

    const adminEmails =
      process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()) ??
      [];

    return adminEmails.includes(profile.email.toLowerCase());
  },
});
