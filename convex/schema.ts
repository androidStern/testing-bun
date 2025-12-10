import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),

  // User profiles - linked to WorkOS user IDs
  profiles: defineTable({
    workosUserId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    thingsICanOffer: v.array(v.string()),
    headline: v.optional(v.string()),
    bio: v.optional(v.string()),
    resumeLink: v.optional(v.string()),
    location: v.optional(v.string()),
    website: v.optional(v.string()),
    instagramUrl: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Unique referral code for this user (6-char alphanumeric)
    // Uniqueness is enforced by generateUniqueCode in referrals.ts
    referralCode: v.optional(v.string()),
  })
    .index('by_workos_user_id', ['workosUserId'])
    .index('by_email', ['email'])
    .index('by_referral_code', ['referralCode']),

  // Referral attribution - tracks who referred whom
  referrals: defineTable({
    referrerProfileId: v.id('profiles'),
    referredProfileId: v.id('profiles'),
    referralCode: v.string(), // The code that was used
    createdAt: v.number(),
  })
    .index('by_referrer', ['referrerProfileId'])
    .index('by_referred', ['referredProfileId']),

  // OAuth authorization codes - short-lived, single-use
  oauthAuthorizationCodes: defineTable({
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
  }).index('by_code', ['code']),

  // OAuth access tokens
  oauthAccessTokens: defineTable({
    token: v.string(),
    workosUserId: v.string(),
    clientId: v.string(),
    scope: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index('by_token', ['token']),

  // OAuth refresh tokens
  oauthRefreshTokens: defineTable({
    token: v.string(),
    workosUserId: v.string(),
    clientId: v.string(),
    scope: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index('by_token', ['token']),

  // OAuth clients (Circle.so credentials)
  oauthClients: defineTable({
    clientId: v.string(),
    clientSecret: v.string(),
    name: v.string(),
    redirectUris: v.array(v.string()),
    createdAt: v.number(),
  }).index('by_client_id', ['clientId']),

  // User resumes - one per user
  resumes: defineTable({
    workosUserId: v.string(),
    personalInfo: v.object({
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      location: v.optional(v.string()),
      linkedin: v.optional(v.string()),
    }),
    summary: v.optional(v.string()),
    workExperience: v.array(
      v.object({
        id: v.string(),
        company: v.optional(v.string()),
        position: v.optional(v.string()),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        description: v.optional(v.string()),
        achievements: v.optional(v.string()),
      })
    ),
    education: v.array(
      v.object({
        id: v.string(),
        institution: v.optional(v.string()),
        degree: v.optional(v.string()),
        field: v.optional(v.string()),
        graduationDate: v.optional(v.string()),
        description: v.optional(v.string()),
      })
    ),
    skills: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_workos_user_id', ['workosUserId']),

  // SMS senders - tracks phone numbers and approval status
  senders: defineTable({
    phone: v.string(),
    status: v.string(), // "pending" | "approved" | "blocked"
    name: v.optional(v.string()),
    company: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_phone', ['phone'])
    .index('by_status', ['status']),

  // Inbound SMS messages
  inboundMessages: defineTable({
    phone: v.string(),
    body: v.string(),
    twilioMessageSid: v.string(),
    senderId: v.optional(v.id('senders')),
    status: v.string(), // "pending_review" | "approved" | "rejected" | "processed"
    createdAt: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_phone', ['phone'])
    .index('by_createdAt', ['createdAt'])
    .index('by_senderId', ['senderId']),
});
