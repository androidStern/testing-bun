import { httpRouter } from 'convex/server'
import { z } from 'zod'

import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { httpAction } from './_generated/server'
import { env } from './lib/env'
import { verifyTwilioSignature } from './lib/twilio'

// Input validation schemas for HTTP endpoints
const insertJobSchema = z.object({
  city: z.string().optional(),
  company: z.string(),
  description: z.string().optional(),
  externalId: z.string(),
  isEasyApply: z.boolean().optional(),
  isUrgent: z.boolean().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  payMax: z.number().optional(),
  payMin: z.number().optional(),
  payType: z.string().optional(),
  postedAt: z.number().optional(),
  source: z.string(),
  state: z.string().optional(),
  title: z.string(),
  url: z.string(),
})

const enrichJobSchema = z.object({
  busAccessible: z.boolean().optional(),
  id: z.string(),
  railAccessible: z.boolean().optional(),
  // Second-chance (legacy boolean - derived from tier)
  secondChance: z.boolean().optional(),
  secondChanceConfidence: z.number().optional(),
  // Second-chance audit fields
  secondChanceDebug: z
    .object({
      employerContribution: z.number(),
      llmContribution: z.number(),
      onetContribution: z.number(),
      overrideApplied: z.string().optional(),
    })
    .optional(),
  secondChanceEmployerMatch: z
    .object({
      matchedName: z.string().optional(),
      matchType: z.string(),
      similarity: z.number().optional(),
    })
    .optional(),
  secondChanceLlmReasoning: z.string().optional(),
  secondChanceLlmStance: z.string().optional(),
  secondChanceOnetCode: z.string().optional(),
  secondChanceReasoning: z.string().optional(),
  // Second-chance scoring (new multi-signal)
  secondChanceScore: z.number().optional(),
  secondChanceScoredAt: z.number().optional(),
  secondChanceSignals: z.array(z.string()).optional(),
  secondChanceTier: z.enum(['high', 'medium', 'low', 'unlikely', 'unknown']).optional(),
  shiftAfternoon: z.boolean().optional(),
  shiftEvening: z.boolean().optional(),
  shiftFlexible: z.boolean().optional(),
  shiftMorning: z.boolean().optional(),
  shiftOvernight: z.boolean().optional(),
  shiftSource: z.string().optional(),
  transitDistance: z.number().optional(),
  transitScore: z.string().optional(),
})

const markIndexedSchema = z.object({
  id: z.string(),
  typesenseId: z.string(),
})

const updateStatusSchema = z.object({
  failureReason: z.string().optional(),
  failureStage: z.string().optional(),
  id: z.string(),
  status: z.enum(['scraped', 'enriching', 'enriched', 'indexed', 'failed']),
})

const existsSchema = z.object({
  externalId: z.string(),
  source: z.string(),
})

// Validate all env vars on first HTTP request
void env.TOKEN_SIGNING_SECRET

const http = httpRouter()

// Helper to convert Headers to plain object
function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

// Helper to bridge HTTP action to Node.js action for Inngest
async function bridgeToNodeAction(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  request: Request,
) {
  const result = await ctx.runAction(internal.inngestNode.handle, {
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : '',
    headers: headersToObject(request.headers),
    method: request.method,
    url: request.url,
  })
  return new Response(result.body, {
    headers: result.headers as HeadersInit,
    status: result.status,
  })
}

// Inngest API endpoint - bridges to Node.js action for node:async_hooks support
http.route({
  handler: httpAction(async (ctx, request) => bridgeToNodeAction(ctx, request)),
  method: 'GET',
  path: '/api/inngest',
})

http.route({
  handler: httpAction(async (ctx, request) => bridgeToNodeAction(ctx, request)),
  method: 'POST',
  path: '/api/inngest',
})

http.route({
  handler: httpAction(async (ctx, request) => bridgeToNodeAction(ctx, request)),
  method: 'PUT',
  path: '/api/inngest',
})

http.route({
  handler: httpAction(async (ctx, request) => {
    const contentType = request.headers.get('content-type') || ''

    if (!contentType.includes('application/x-www-form-urlencoded')) {
      return new Response('Invalid content type', { status: 400 })
    }

    // Read body as text to verify signature, then parse as form data
    const bodyText = await request.text()
    const formParams = new URLSearchParams(bodyText)

    // Convert to plain object for signature verification
    const params: Record<string, string> = {}
    formParams.forEach((value, key) => {
      params[key] = value
    })

    // Extract canonical URL from request (without query params)
    const requestUrl = new URL(request.url)
    const actualUrl = `${requestUrl.origin}${requestUrl.pathname}`

    // Validate request URL matches expected webhook URL
    const expectedUrl = new URL(env.TWILIO_WEBHOOK_URL)
    const expectedCanonicalUrl = `${expectedUrl.origin}${expectedUrl.pathname}`

    if (actualUrl !== expectedCanonicalUrl) {
      console.error('Webhook URL mismatch', { actual: actualUrl, expected: expectedCanonicalUrl })
      return new Response('Invalid webhook URL', { status: 403 })
    }

    // Verify Twilio signature using the actual request URL
    const signature = request.headers.get('X-Twilio-Signature') || ''
    const isValid = await verifyTwilioSignature({
      params,
      signature,
      webhookUrl: actualUrl,
    })

    if (!isValid) {
      console.error('Invalid Twilio signature')
      return new Response('Invalid signature', { status: 403 })
    }

    const phone = params.From || null
    const body = params.Body || null
    const twilioMessageSid = params.MessageSid || null

    if (!phone || !body || !twilioMessageSid) {
      console.error('Missing required Twilio fields:', { body, phone, twilioMessageSid })
      return new Response('Missing required fields', { status: 400 })
    }

    // Check for STOP/CLOSE command (case-insensitive, allow whitespace)
    const normalizedBody = body.trim().toUpperCase()
    if (normalizedBody === 'STOP' || normalizedBody === 'CLOSE') {
      // Look up sender
      const sender = await ctx.runQuery(internal.senders.getByPhone, { phone })
      if (sender) {
        // Find their most recent open job
        const openJob = await ctx.runQuery(internal.jobSubmissions.getOpenBySender, {
          senderId: sender._id,
        })
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- openJob can be null at runtime
        if (openJob) {
          await ctx.runMutation(internal.jobSubmissions.close, {
            id: openJob._id,
            reason: 'employer_request',
          })
          console.log(`Job ${openJob._id} closed by sender ${sender._id} via SMS STOP command`)
        }
      }
      // Return empty TwiML - no need to log the STOP message as a job submission
      return new Response('<Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Atomically get or create sender (prevents race condition with concurrent SMS)
    const { sender, created } = await ctx.runMutation(internal.senders.getOrCreate, {
      phone,
      status: 'pending',
    })

    const senderId = sender._id
    let messageStatus: string

    if (created) {
      messageStatus = 'pending_review'
    } else if (sender.status === 'approved') {
      messageStatus = 'approved'
    } else if (sender.status === 'blocked') {
      messageStatus = 'rejected'
    } else {
      messageStatus = 'pending_review'
    }

    // Save the inbound message (for tracking all SMS)
    await ctx.runMutation(internal.inboundMessages.create, {
      body,
      phone,
      senderId,
      status: messageStatus,
      twilioMessageSid,
    })

    // Create a job submission and trigger the Inngest workflow
    // Only process if sender is not blocked
    if (messageStatus !== 'rejected') {
      const submissionId = await ctx.runMutation(internal.jobSubmissions.create, {
        rawContent: body,
        senderId,
        source: 'sms',
      })

      // Trigger Inngest workflow (via Node.js action since inngest.send needs node:async_hooks)
      await ctx.scheduler.runAfter(0, internal.inngestNode.sendJobSubmittedEvent, {
        source: 'sms',
        submissionId,
      })
    }

    return new Response('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }),
  method: 'POST',
  path: '/webhooks/twilio-sms',
})

// ============================================================================
// Scraped Jobs API - for scrape-jobs pipeline
// ============================================================================

// Verify pipeline secret
function verifyPipelineSecret(request: Request): boolean {
  const secret = request.headers.get('X-Pipeline-Secret')
  return secret === env.SCRAPE_PIPELINE_SECRET
}

// Insert a new scraped job
http.route({
  handler: httpAction(async (ctx, request) => {
    if (!verifyPipelineSecret(request)) {
      return new Response('Unauthorized', { status: 401 })
    }
    const rawBody = await request.json()
    const parseResult = insertJobSchema.safeParse(rawBody)
    if (!parseResult.success) {
      return Response.json(
        { details: parseResult.error.flatten(), error: 'Invalid input' },
        { status: 400 },
      )
    }
    const id = await ctx.runMutation(internal.scrapedJobs.insert, parseResult.data)
    return Response.json({ id })
  }),
  method: 'POST',
  path: '/api/scraped-jobs/insert',
})

// Add enrichment data
http.route({
  handler: httpAction(async (ctx, request) => {
    if (!verifyPipelineSecret(request)) {
      return new Response('Unauthorized', { status: 401 })
    }
    const rawBody = await request.json()
    const parseResult = enrichJobSchema.safeParse(rawBody)
    if (!parseResult.success) {
      return Response.json(
        { details: parseResult.error.flatten(), error: 'Invalid input' },
        { status: 400 },
      )
    }
    await ctx.runMutation(internal.scrapedJobs.enrich, {
      ...parseResult.data,
      id: parseResult.data.id as Id<'scrapedJobs'>,
    })
    return Response.json({ success: true })
  }),
  method: 'POST',
  path: '/api/scraped-jobs/enrich',
})

// Mark as indexed
http.route({
  handler: httpAction(async (ctx, request) => {
    if (!verifyPipelineSecret(request)) {
      return new Response('Unauthorized', { status: 401 })
    }
    const rawBody = await request.json()
    const parseResult = markIndexedSchema.safeParse(rawBody)
    if (!parseResult.success) {
      return Response.json(
        { details: parseResult.error.flatten(), error: 'Invalid input' },
        { status: 400 },
      )
    }
    await ctx.runMutation(internal.scrapedJobs.markIndexed, {
      ...parseResult.data,
      id: parseResult.data.id as Id<'scrapedJobs'>,
    })
    return Response.json({ success: true })
  }),
  method: 'POST',
  path: '/api/scraped-jobs/indexed',
})

// Update status (for errors)
http.route({
  handler: httpAction(async (ctx, request) => {
    if (!verifyPipelineSecret(request)) {
      return new Response('Unauthorized', { status: 401 })
    }
    const rawBody = await request.json()
    const parseResult = updateStatusSchema.safeParse(rawBody)
    if (!parseResult.success) {
      return Response.json(
        { details: parseResult.error.flatten(), error: 'Invalid input' },
        { status: 400 },
      )
    }
    await ctx.runMutation(internal.scrapedJobs.updateStatus, {
      ...parseResult.data,
      id: parseResult.data.id as Id<'scrapedJobs'>,
    })
    return Response.json({ success: true })
  }),
  method: 'POST',
  path: '/api/scraped-jobs/status',
})

// Check if job exists (dedup fallback)
http.route({
  handler: httpAction(async (ctx, request) => {
    if (!verifyPipelineSecret(request)) {
      return new Response('Unauthorized', { status: 401 })
    }
    const rawBody = await request.json()
    const parseResult = existsSchema.safeParse(rawBody)
    if (!parseResult.success) {
      return Response.json(
        { details: parseResult.error.flatten(), error: 'Invalid input' },
        { status: 400 },
      )
    }
    const { externalId, source } = parseResult.data
    const job = await ctx.runQuery(internal.scrapedJobs.getByExternalId, {
      externalId,
      source,
    })
    return Response.json({ exists: !!job, job })
  }),
  method: 'POST',
  path: '/api/scraped-jobs/exists',
})

export default http
