import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { zodOutputToConvex } from 'convex-helpers/server/zod4'

import { ParsedJobSchema } from './lib/jobSchema'

export default defineSchema({
  // Applications - seeker applications to job postings
  applications: defineTable({
    appliedAt: v.number(),
    connectedAt: v.optional(v.number()),
    jobSubmissionId: v.id('jobSubmissions'),

    message: v.optional(v.string()), // Optional note from seeker
    passedAt: v.optional(v.number()),
    seekerProfileId: v.id('profiles'),

    status: v.union(v.literal('pending'), v.literal('connected'), v.literal('passed')),
  })
    .index('by_job', ['jobSubmissionId'])
    .index('by_seeker', ['seekerProfileId'])
    .index('by_job_and_status', ['jobSubmissionId', 'status']),

  // Employers - job poster accounts (Checkpoint 3 vetting)
  employers: defineTable({
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.string()),
    company: v.string(),

    // Timestamps
    createdAt: v.number(),
    email: v.string(),

    // From signup form
    name: v.string(),
    phone: v.string(),
    role: v.optional(v.string()),
    senderId: v.id('senders'), // Link to original sender

    // Vetting status
    status: v.union(v.literal('pending_review'), v.literal('approved'), v.literal('rejected')),
    website: v.optional(v.string()),

    // WorkOS account (created after approval)
    workosUserId: v.optional(v.string()),
  })
    .index('by_sender', ['senderId'])
    .index('by_status', ['status'])
    .index('by_email', ['email'])
    .index('by_workos_user_id', ['workosUserId']),

  // Inbound SMS messages (legacy - will be replaced by jobSubmissions)
  inboundMessages: defineTable({
    body: v.string(),
    createdAt: v.number(),
    phone: v.string(),
    senderId: v.optional(v.id('senders')),
    status: v.string(), // "pending_review" | "approved" | "rejected" | "processed"
    twilioMessageSid: v.string(),
  })
    .index('by_status', ['status'])
    .index('by_phone', ['phone'])
    .index('by_createdAt', ['createdAt'])
    .index('by_senderId', ['senderId']),

  // Job search preferences - maps to Typesense facets
  jobPreferences: defineTable({
    // Commute preferences
    maxCommuteMinutes: v.optional(v.union(v.literal(10), v.literal(30), v.literal(60))),
    preferEasyApply: v.optional(v.boolean()),

    // Second-chance employer preferences
    preferSecondChance: v.optional(v.boolean()),

    // Job type preferences
    preferUrgent: v.optional(v.boolean()),

    // Transit accessibility requirements
    requireBusAccessible: v.optional(v.boolean()),
    requirePublicTransit: v.optional(v.boolean()),
    requireRailAccessible: v.optional(v.boolean()),
    requireSecondChance: v.optional(v.boolean()),
    shiftAfternoon: v.optional(v.boolean()),
    shiftEvening: v.optional(v.boolean()),
    shiftFlexible: v.optional(v.boolean()),

    // Shift preferences
    shiftMorning: v.optional(v.boolean()),
    shiftOvernight: v.optional(v.boolean()),

    updatedAt: v.number(),
    workosUserId: v.string(),
  }).index('by_workos_user_id', ['workosUserId']),

  // Track active job searches (one per user)
  jobSearches: defineTable({
    completedAt: v.optional(v.number()),
    initialPrompt: v.string(),
    plan: v.optional(
      v.array(
        v.object({
          content: v.string(),
          id: v.string(),
          priority: v.union(v.literal('high'), v.literal('medium'), v.literal('low')),
          status: v.union(
            v.literal('pending'),
            v.literal('in_progress'),
            v.literal('completed'),
            v.literal('cancelled'),
          ),
        }),
      ),
    ),
    startedAt: v.number(),
    status: v.union(v.literal('active'), v.literal('completed'), v.literal('cancelled')),
    threadId: v.string(),
    workosUserId: v.string(),
  })
    .index('by_workos_user_id', ['workosUserId'])
    .index('by_workos_user_id_status', ['workosUserId', 'status'])
    .index('by_thread_id', ['threadId']),

  // Job submissions - unified table for SMS and form submissions
  jobSubmissions: defineTable({
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.string()),

    // External links (set after approval)
    circlePostUrl: v.optional(v.string()),
    closedAt: v.optional(v.number()),
    closedReason: v.optional(v.string()), // "employer_request" | "auto_expired"

    // Timestamps
    createdAt: v.number(),
    denyReason: v.optional(v.string()),

    // Parsed job (after AI processing) - generated from shared Zod schema
    parsedJob: v.optional(zodOutputToConvex(ParsedJobSchema)),

    // Raw input
    rawContent: v.string(), // SMS body or form JSON
    senderId: v.id('senders'),

    // Slack message reference (for updating message after edit)
    slackChannel: v.optional(v.string()),
    slackMessageTs: v.optional(v.string()),
    // Source tracking
    source: v.union(v.literal('sms'), v.literal('form')),

    // Workflow state
    status: v.union(
      v.literal('pending_parse'), // awaiting AI parsing
      v.literal('pending_approval'), // awaiting human approval
      v.literal('approved'),
      v.literal('denied'),
      v.literal('closed'), // job closed by employer or auto-expired
    ),
  })
    .index('by_status', ['status'])
    .index('by_sender', ['senderId'])
    .index('by_created_at', ['createdAt']),
  numbers: defineTable({
    value: v.number(),
  }),

  // OAuth access tokens
  oauthAccessTokens: defineTable({
    clientId: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
    token: v.string(),
    workosUserId: v.string(),
  })
    .index('by_token', ['token'])
    .index('by_user_client', ['workosUserId', 'clientId']),

  // OAuth authorization codes - short-lived, single-use
  oauthAuthorizationCodes: defineTable({
    clientId: v.string(),
    code: v.string(),
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
    redirectUri: v.string(),
    scope: v.optional(v.string()),
    used: v.boolean(),
    workosUserId: v.string(),
  }).index('by_code', ['code']),

  // OAuth clients (Circle.so credentials)
  oauthClients: defineTable({
    clientId: v.string(),
    clientSecret: v.string(),
    createdAt: v.number(),
    name: v.string(),
    redirectUris: v.array(v.string()),
  }).index('by_client_id', ['clientId']),

  // OAuth refresh tokens
  oauthRefreshTokens: defineTable({
    clientId: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
    token: v.string(),
    workosUserId: v.string(),
  })
    .index('by_token', ['token'])
    .index('by_user_client', ['workosUserId', 'clientId']),

  // User profiles - linked to WorkOS user IDs
  profiles: defineTable({
    bio: v.optional(v.string()),
    createdAt: v.number(),
    email: v.string(),
    firstName: v.optional(v.string()),
    headline: v.optional(v.string()),
    // Home location for transit isochrone calculations
    homeLat: v.optional(v.number()),
    homeLon: v.optional(v.number()),
    instagramUrl: v.optional(v.string()),
    // Transit isochrones (10/30/60 minute zones from home location)
    isochrones: v.optional(
      v.object({
        computedAt: v.number(),
        originLat: v.number(),
        originLon: v.number(),
        sixtyMinute: v.any(),
        tenMinute: v.any(),
        thirtyMinute: v.any(),
      }),
    ),
    lastName: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    location: v.optional(v.string()),
    // Unique referral code for this user (6-char alphanumeric)
    // Uniqueness is enforced by generateUniqueCode in referrals.ts
    referralCode: v.optional(v.string()),
    resumeLink: v.optional(v.string()),
    thingsICanOffer: v.array(v.string()),
    updatedAt: v.number(),
    website: v.optional(v.string()),
    workosUserId: v.string(),
  })
    .index('by_workos_user_id', ['workosUserId'])
    .index('by_email', ['email'])
    .index('by_referral_code', ['referralCode']),

  // Referral attribution - tracks who referred whom
  referrals: defineTable({
    createdAt: v.number(),
    referralCode: v.string(), // The code that was used
    referredProfileId: v.id('profiles'),
    referrerProfileId: v.id('profiles'),
  })
    .index('by_referrer', ['referrerProfileId'])
    .index('by_referred', ['referredProfileId']),

  // User resumes - one per user
  resumes: defineTable({
    createdAt: v.number(),
    education: v.array(
      v.object({
        degree: v.optional(v.string()),
        description: v.optional(v.string()),
        field: v.optional(v.string()),
        graduationDate: v.optional(v.string()),
        id: v.string(),
        institution: v.optional(v.string()),
      }),
    ),
    personalInfo: v.object({
      email: v.string(),
      linkedin: v.optional(v.string()),
      location: v.optional(v.string()),
      name: v.string(),
      phone: v.optional(v.string()),
    }),
    skills: v.optional(v.string()),
    summary: v.optional(v.string()),
    updatedAt: v.number(),
    workExperience: v.array(
      v.object({
        achievements: v.optional(v.string()),
        company: v.optional(v.string()),
        description: v.optional(v.string()),
        endDate: v.optional(v.string()),
        id: v.string(),
        position: v.optional(v.string()),
        startDate: v.optional(v.string()),
      }),
    ),
    workosUserId: v.string(),
  }).index('by_workos_user_id', ['workosUserId']),

  // Scraped Jobs - from external job boards (Snagajob, Indeed, etc.)
  // Separate from jobSubmissions which are employer-submitted
  scrapedJobs: defineTable({
    busAccessible: v.optional(v.boolean()),

    // Location
    city: v.optional(v.string()),

    // Core job data
    company: v.string(),
    description: v.optional(v.string()),
    enrichedAt: v.optional(v.number()),
    // External identification
    externalId: v.string(),

    // Error tracking
    failureReason: v.optional(v.string()),
    failureStage: v.optional(v.string()),
    indexedAt: v.optional(v.number()),
    isEasyApply: v.optional(v.boolean()),

    // Job metadata
    isUrgent: v.optional(v.boolean()),
    jobType: v.optional(v.string()), // 'job' | 'gig'
    lat: v.optional(v.float64()),
    lng: v.optional(v.float64()),
    noBackgroundCheck: v.optional(v.boolean()), // DEPRECATED - being migrated
    payMax: v.optional(v.float64()),

    // Salary
    payMin: v.optional(v.float64()),
    payType: v.optional(v.string()),
    postedAt: v.optional(v.number()),
    railAccessible: v.optional(v.boolean()),

    // Pipeline timestamps
    scrapedAt: v.number(),

    // Enrichment: Second-chance (legacy keyword detection)
    secondChance: v.optional(v.boolean()),
    secondChanceConfidence: v.optional(v.float64()),

    // Enrichment: Second-chance audit fields (for full traceability)
    secondChanceDebug: v.optional(
      v.object({
        employerContribution: v.number(),
        llmContribution: v.number(),
        onetContribution: v.number(),
        overrideApplied: v.optional(v.string()),
      }),
    ),
    secondChanceEmployerMatch: v.optional(
      v.object({
        matchedName: v.optional(v.string()),
        matchType: v.string(),
        similarity: v.optional(v.float64()),
      }),
    ),
    secondChanceLlmReasoning: v.optional(v.string()),
    secondChanceLlmStance: v.optional(v.string()),
    secondChanceOnetCode: v.optional(v.string()),
    secondChanceReasoning: v.optional(v.string()),

    // Enrichment: Second-chance scoring (new multi-signal)
    secondChanceScore: v.optional(v.number()),
    secondChanceScoredAt: v.optional(v.float64()),
    secondChanceSignals: v.optional(v.array(v.string())),
    secondChanceTier: v.optional(
      v.union(
        v.literal('high'),
        v.literal('medium'),
        v.literal('low'),
        v.literal('unlikely'),
        v.literal('unknown'),
      ),
    ),
    shiftAfternoon: v.optional(v.boolean()),
    shiftEvening: v.optional(v.boolean()),
    shiftFlexible: v.optional(v.boolean()),

    // Enrichment: Shifts
    shiftMorning: v.optional(v.boolean()),
    shiftOvernight: v.optional(v.boolean()),
    shiftSource: v.optional(v.string()),
    source: v.string(),
    state: v.optional(v.string()),

    // Pipeline status tracking
    status: v.union(
      v.literal('scraped'),
      v.literal('enriching'),
      v.literal('enriched'),
      v.literal('indexed'),
      v.literal('failed'),
    ),
    title: v.string(),
    transitDistance: v.optional(v.float64()),

    // Enrichment: Transit
    transitScore: v.optional(v.string()),

    // Typesense reference
    typesenseId: v.optional(v.string()),
    url: v.string(),
  })
    .index('by_external_id_source', ['externalId', 'source'])
    .index('by_status', ['status'])
    .index('by_source', ['source'])
    .index('by_scraped_at', ['scrapedAt'])
    .index('by_typesense_id', ['typesenseId']),

  // Senders - tracks phone/email and approval status (for both SMS and form submissions)
  senders: defineTable({
    company: v.optional(v.string()),
    createdAt: v.number(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    notes: v.optional(v.string()),
    phone: v.optional(v.string()),
    status: v.string(), // "pending" | "approved" | "blocked"
    updatedAt: v.number(),
  })
    .index('by_phone', ['phone'])
    .index('by_email', ['email'])
    .index('by_status', ['status']),
})
