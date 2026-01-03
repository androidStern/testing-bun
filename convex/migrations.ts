import { v } from 'convex/values'

import { internalMutation } from './_generated/server'
import { generateReferralCode } from './referrals'

// Run once to backfill referralCode for existing profiles
// Call from Convex dashboard: npx convex run migrations:backfillReferralCodes
export const backfillReferralCodes = internalMutation({
  args: {},
  handler: async ctx => {
    const profiles = await ctx.db.query('profiles').collect()
    const usedCodes = new Set<string>()
    let updated = 0
    let skipped = 0

    // First pass: collect existing codes
    for (const profile of profiles) {
      if (profile.referralCode) {
        usedCodes.add(profile.referralCode)
        skipped++
      }
    }

    // Second pass: generate codes for profiles without one
    for (const profile of profiles) {
      if (profile.referralCode) continue

      // Generate unique code
      let code: string
      let attempts = 0
      do {
        code = generateReferralCode()
        attempts++
        if (attempts > 100) {
          // Fallback with timestamp
          code = `${generateReferralCode()}${Date.now().toString(36).slice(-2).toUpperCase()}`
          break
        }
      } while (usedCodes.has(code))

      usedCodes.add(code)
      await ctx.db.patch(profile._id, { referralCode: code })
      updated++
    }

    return {
      skipped,
      total: profiles.length,
      updated,
    }
  },
})

export const nukeIsochrones = internalMutation({
  args: {},
  handler: async ctx => {
    const profiles = await ctx.db.query('profiles').collect()
    let cleared = 0

    for (const profile of profiles) {
      if (profile.isochrones) {
        await ctx.db.patch(profile._id, { isochrones: undefined })
        cleared++
      }
    }

    return { cleared, total: profiles.length }
  },
  returns: v.object({ cleared: v.number(), total: v.number() }),
})
