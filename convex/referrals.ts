import { v } from 'convex/values';
import { internalMutation, query } from './_generated/server';

// Characters that aren't easily confused (no 0/O, 1/I/l)
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode(): string {
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

    // Fallback: append timestamp suffix for guaranteed uniqueness
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
      referralCode: referrerCode,
      createdAt: Date.now(),
    });

    console.log(`Recorded referral: ${referrer._id} referred ${referredProfileId}`);
    return referralId;
  },
});

// Get profile by referral code (for validation on join page)
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

    if (!profile || !profile.referralCode) return null;

    const referrals = await ctx.db
      .query('referrals')
      .withIndex('by_referrer', (q) => q.eq('referrerProfileId', profile._id))
      .collect();

    return {
      code: profile.referralCode,
      totalReferrals: referrals.length,
    };
  },
});

// Get all referrals made by a user (for admin/debugging)
export const getReferralsByReferrer = query({
  args: { referrerProfileId: v.id('profiles') },
  handler: async (ctx, { referrerProfileId }) => {
    const referrals = await ctx.db
      .query('referrals')
      .withIndex('by_referrer', (q) => q.eq('referrerProfileId', referrerProfileId))
      .collect();

    // Get referred user details
    const referralsWithDetails = await Promise.all(
      referrals.map(async (r) => {
        const referredProfile = await ctx.db.get(r.referredProfileId);
        return {
          ...r,
          referredEmail: referredProfile?.email,
          referredName: referredProfile?.firstName,
        };
      }),
    );

    return referralsWithDetails;
  },
});
