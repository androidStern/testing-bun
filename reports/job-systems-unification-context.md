# Job Systems Context Report

## Overview

This document provides research findings on two job ingestion systems:

1. **testing-bun** (`/Users/winterfell/src/testing-bun/testing-bun`) - SMS-based job submissions via Twilio webhook
2. **job-ingress** (`/Users/winterfell/src/job-ingress`) - Form-based job submissions with Inngest workflow

---

## System 1: testing-bun (SMS Job Submissions)

### Tech Stack
| Component | Technology |
|-----------|------------|
| Frontend | React 19 + TanStack Start 1.132 |
| Backend | Convex (serverless functions + database) |
| Auth | WorkOS AuthKit |
| SMS | Twilio webhook |
| Build | Bun + Vite |

### Database Schema (Convex)

**`senders` table** - Tracks SMS sender approval status:
```typescript
// convex/schema.ts:110-120
senders: defineTable({
  phone: v.string(),
  status: v.string(),           // "pending" | "approved" | "blocked"
  name: v.optional(v.string()),
  company: v.optional(v.string()),
  notes: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_phone', ['phone'])
  .index('by_status', ['status'])
```

**`inboundMessages` table** - Stores received SMS messages:
```typescript
// convex/schema.ts:122-135
inboundMessages: defineTable({
  phone: v.string(),
  body: v.string(),                              // The job content (raw SMS text)
  twilioMessageSid: v.string(),
  senderId: v.optional(v.id('senders')),
  status: v.string(),                            // "pending_review" | "approved" | "rejected" | "processed"
  createdAt: v.number(),
})
  .index('by_status', ['status'])
  .index('by_phone', ['phone'])
  .index('by_createdAt', ['createdAt'])
  .index('by_senderId', ['senderId'])
```

### SMS Webhook Endpoint

**File:** `convex/http.ts:9-66`
**Endpoint:** `POST /webhooks/twilio-sms`
**Content-Type:** `application/x-www-form-urlencoded`

**Twilio POST Parameters:**
- `From` - Sender phone number
- `Body` - SMS message content
- `MessageSid` - Twilio message ID

**Processing Logic:**
1. Parse form data from Twilio
2. Look up sender by phone number (`api.senders.getByPhone`)
3. If sender not found: create new sender with `status: "pending"`
4. Determine message status based on sender status:
   - Sender approved → message `status: "approved"`
   - Sender blocked → message `status: "rejected"`
   - Sender pending → message `status: "pending_review"`
5. Store message in `inboundMessages` table
6. Return TwiML response: `<Response></Response>`

### Admin Dashboard

**File:** `src/routes/_authenticated/_admin/admin.tsx`

Four tabs displaying data from Convex queries:
- **Pending Senders** - `api.senders.list({ status: 'pending' })`
- **All Senders** - `api.senders.list({})`
- **Pending Messages** - `api.inboundMessages.list({ status: 'pending_review' })`
- **All Messages** - `api.inboundMessages.list({})`

**Admin Functions (require ADMIN_EMAILS env var):**

`api.senders.updateStatus` (`convex/senders.ts:100-137`):
- Changes sender status to `approved`, `blocked`, or `pending`
- Cascades to messages: when sender approved/blocked, all their `pending_review` messages update accordingly

`api.inboundMessages.updateStatus` (`convex/inboundMessages.ts:82-95`):
- Changes individual message status to `pending_review`, `approved`, `rejected`, or `processed`

### Admin UI Components

**SenderCard** (`src/components/admin/SenderCard.tsx`):
- Displays: phone, status badge, name, company, first message preview, message count, relative time
- Actions: Approve button, Block button (only shown for pending senders)

**MessageCard** (`src/components/admin/MessageCard.tsx`):
- Displays: phone, status badge, sender info, full message body, relative time
- Actions: Approve/Reject (for pending_review), Mark Processed (for approved)

### Existing Inngest Integration

**File:** `convex/inngest.ts:12-84`

There's an existing internal action that sends profile data to job-ingress:

```typescript
export const sendProfileWebhook = internalAction({
  args: { workosUserId, email, firstName, lastName, thingsICanOffer, headline, bio, ... },
  handler: async (_ctx, args) => {
    const webhookUrl = process.env.INNGEST_WEBHOOK_URL;

    const payload = {
      data: {
        fields: {
          first_name, last_name,
          most_recent_title: headline,
          platform_goals: mappedThingsICanOffer,
          entrepreneurship_vision: bio,
        },
        user: { email, email_verified: true, user_id: workosUserId }
      }
    };

    await fetch(webhookUrl, { method: 'POST', body: JSON.stringify(payload) });
  }
});
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `WORKOS_CLIENT_ID` | WorkOS authentication |
| `WORKOS_API_KEY` | WorkOS API key |
| `WORKOS_COOKIE_PASSWORD` | Cookie encryption (32+ chars) |
| `WORKOS_REDIRECT_URI` | Auth callback URL |
| `VITE_CONVEX_URL` | Convex deployment URL |
| `INNGEST_WEBHOOK_URL` | job-ingress Inngest endpoint |
| `ADMIN_EMAILS` | Comma-separated list of admin user emails |

---

## System 2: job-ingress (Form Job Submissions)

### Tech Stack
| Component | Technology |
|-----------|------------|
| Runtime | Cloudflare Workers |
| Framework | Hono |
| Workflow Engine | Inngest |
| Validation | Valibot |
| Frontend | React 19 (embedded in Circle via iframe) |
| Auth | Auth0 passwordless (OTP) |

### API Routes

**File:** `src/index.tsx`

| Route | Method | Handler |
|-------|--------|---------|
| `/api/submit-job` | POST | `submitJobHandler` |
| `/api/inngest` | GET, POST, PUT | Inngest serve handler |
| `/api/passwordless/start` | POST | Send OTP |
| `/api/passwordless/verify` | POST | Verify OTP |
| `/embed` | GET | Serve React SPA with CSP headers for Circle iframe |
| `/api/oembed` | GET | oEmbed response for Circle embed discovery |

### Job Submission Schema

**File:** `src/shared/schemas/job-submission.schema.ts`

```typescript
export const JobSubmissionSchema = v.pipe(
  v.object({
    // Required
    title: v.pipe(v.string(), v.minLength(1, 'Job title is required')),
    company: v.object({
      name: v.pipe(v.string(), v.minLength(1)),
      domain: v.optional(v.string()),
      icon: v.optional(v.string()),
    }),
    workArrangement: v.picklist(['on-site', 'remote', 'hybrid']),
    contact: v.pipe(
      v.object({
        name: v.pipe(v.string(), v.minLength(1)),
        email: v.optional(v.pipe(v.string(), v.email())),
        phone: v.optional(v.string()),
        method: v.picklist(['email', 'phone']),
      }),
      v.check(data => !!data.email || !!data.phone, 'Either email or phone is required'),
    ),

    // Optional
    location: v.optional(v.object({
      city: v.string(),
      state: v.string(),
      postal_code: v.string(),
      country_code: v.string(),
    })),
    description: v.optional(v.string()),
    employmentType: v.optional(v.picklist(['full-time', 'part-time', 'contract', 'internship', 'temporary'])),
    salary: v.optional(v.union([
      v.object({ min: v.number(), max: v.number(), unit: v.picklist(['hr', 'day', 'week', 'month', 'year']) }),
      v.object({ amount: v.number(), unit: v.picklist(['hr', 'day', 'week', 'month', 'year']) }),
    ])),
    skills: v.optional(v.array(v.string())),
    requirements: v.optional(v.array(v.string())),
    postedAt: v.optional(v.date()),
    sourceUrl: v.optional(v.string()),
  }),
  // Refinement: location required for on-site/hybrid
  v.check(data => {
    if (data.workArrangement === 'on-site' || data.workArrangement === 'hybrid') {
      return !!data.location;
    }
    return true;
  }, 'Location is required for on-site and hybrid positions'),
);
```

### Job Submission Handler

**File:** `src/api/submit-job.ts`

1. Parse JSON body
2. Verify ID token from cookie (`IDT_COOKIE`)
3. Validate against `JobSubmissionSchema`
4. Verify contact info matches token claims (email or phone)
5. Send Inngest event:
```typescript
await inngest.send({
  name: 'app/job-submitted',
  data: { ...jobSubmission, guid: crypto.randomUUID() },
});
```
6. Return success response

### Inngest Workflow

**File:** `src/inngest/approve-job.ts`

```typescript
export const approveJob = inngest.createFunction(
  { id: 'approve-job' },
  { event: 'app/job-submitted' },
  async ({ event, step, env }) => {
    const jobId = event.data.guid;
    const job = event.data;

    // Step 1: Post approval request to Slack
    const blocks = await step.run('post-slack-message', async () =>
      await postSlackApproval({
        approvalId: jobId,
        channel: env.SLACK_APPROVAL_CHANNEL,
        job: job,
        token: env.SLACK_BOT_TOKEN,
      })
    );

    // Step 2: Wait for Slack button click (up to 3 days)
    const approval = await step.waitForEvent('wait-approval', {
      event: 'slack/approval.clicked',
      if: `async.data.approvalId == "${jobId}"`,
      timeout: '3d',
    });

    const decision = approval?.data.decision;  // 'approved' | 'denied' | 'unknown'

    // Step 3: Verify Slack request signature
    const valid = await verifySlackSignature({
      body: approval.data._raw,
      requestSignature: approval.data._sig,
      requestTimestamp: Number(approval.data._ts),
      signingSecret: env.SLACK_SIGNING_SECRET,
    });

    // Step 4: Update original Slack message with decision
    await step.run('update-slack-message', async () => {
      await updateSlackApproval({
        channel: env.SLACK_APPROVAL_CHANNEL,
        decision: decision,
        originalBlocks: blocks,
        responseUrl: approval.data.slack.responseUrl,
        userName: approval.data.slack.userName,
        token: env.SLACK_BOT_TOKEN,
      });
    });

    // Step 5: If denied, return early
    if (decision === 'denied') {
      return { message: 'Job denied' };
    }

    // Step 6: Post to Circle
    const name = `${job.title} at ${job.company.name}${job.location ? ` — ${job.location.city}` : ''}`;
    const res = await step.fetch('https://app.circle.so/api/admin/v2/posts', {
      method: 'POST',
      headers: {
        Authorization: `Token ${env.CIRCLE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        internal_custom_html: renderToStaticMarkup(JobPost({ job })),
        is_comments_enabled: true,
        is_liking_enabled: true,
        name,
        space_id: Number(env.CIRCLE_SPACE_ID),
        topics: [job.location?.city],
      }),
    });

    const json = await res.json();
    return { message: `Job approved! Check out the post at ${json.post?.url}` };
  }
);
```

### Inngest Event Types

**File:** `src/inngest/types.ts`

```typescript
type JobSubmitted = {
  name: 'app/job-submitted'
  data: JobSubmission & { guid: string }
}

type SlackApproval = {
  name: 'slack/approval.clicked'
  data: {
    decision: 'approved' | 'denied' | 'unknown'
    slack: { responseUrl: string; userName: string }
    approvalId: string
    _raw: string   // Raw body for signature verification
    _sig: string   // X-Slack-Signature header
    _ts: string    // X-Slack-Request-Timestamp header
  }
}
```

### Slack Integration

**File:** `src/inngest/lib/post-slack-approval.ts`

`postSlackApproval()` function:
- Builds Slack Block Kit message with job fields
- Chunks fields into groups of 10 (Slack's limit per section)
- Adds Approve (primary/green) and Deny (danger/red) buttons with `approvalId` as value
- POSTs to `https://slack.com/api/chat.postMessage`

`updateSlackApproval()` function:
- Removes action buttons from original message
- Adds status section: "✅ Approved by @username" or "❌ Denied by @username"
- POSTs to Slack's `responseUrl` to update the message

### Circle Integration

**File:** `src/inngest/lib/render-job-post.tsx`

`JobPost` component renders HTML card with:
- Tailwind CSS (loaded via CDN: `https://cdn.tailwindcss.com`)
- Gradient background image
- Company logo or initial
- Job title and company name
- Employment type badge
- Location, salary, employment type, posted date
- Job description
- Skills and requirements as pill badges
- "Apply Now" button (links to `{{330197811__fields__Posting URL}}` - Circle template variable)

**File:** `src/inngest/lib/circle.ts`

Additional Circle utilities:
- `findMemberId()` - Get member ID from SSO ID using `@circleco/headless-server-sdk`
- `updateMember()` - PATCH member profile fields via Circle Admin API v2
- Profile field mapping functions for career goals, employment status, industry, etc.

### React Form Component

**File:** `src/client/components/JobForm.tsx`

Multi-step form with URL state persistence:

**Step 1: job-info**
- Job title (required)
- Company name with autocomplete
- Work arrangement toggle: Remote / On-site / Hybrid
- Location autocomplete (required for on-site/hybrid)
- Description
- Advanced fields: employment type, skills, requirements

**Step 2: contact-verify**
- Contact name (required)
- Email or phone (switchable)
- OTP verification via Auth0 passwordless
- Terms and conditions link

**Step 3: confirmation**
- Review all entered data
- Edit buttons to return to previous steps
- Submit button triggers form submission

### Environment Variables

**From `wrangler.jsonc`:**

| Variable | Value/Purpose |
|----------|---------------|
| `INNGEST_DEV` | `"0"` in production |
| `SLACK_APPROVAL_CHANNEL` | `"C08E4B0NNRL"` |
| `CIRCLE_POST_AS_EMAIL` | `"andrew@recoveryjobs.com"` |
| `CIRCLE_SPACE_ID` | `"2286211"` |

**Secrets (via `wrangler secret put`):**
- `INNGEST_SIGNING_KEY`
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `CIRCLE_API_TOKEN`
- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`

---

## Data Flow Diagrams

### testing-bun SMS Flow

```
Twilio SMS
    │
    ▼
POST /webhooks/twilio-sms (convex/http.ts)
    │
    ├─► Query: api.senders.getByPhone
    │       │
    │       ├─► Not found: Mutation api.senders.create (status: "pending")
    │       │
    │       └─► Found: Use existing sender status
    │
    ├─► Determine message status from sender status
    │
    ├─► Mutation: api.inboundMessages.create
    │
    └─► Return TwiML: <Response></Response>

Admin Dashboard (manual)
    │
    ├─► View pending senders/messages
    │
    ├─► Approve/Block sender → Cascades to messages
    │
    └─► Mark message as processed
```

### job-ingress Form Flow

```
React Form (JobForm.tsx)
    │
    ▼
POST /api/submit-job (src/api/submit-job.ts)
    │
    ├─► Validate JobSubmissionSchema
    ├─► Verify ID token claims match contact
    │
    └─► inngest.send({ name: 'app/job-submitted', data: job })
            │
            ▼
    Inngest Workflow: approve-job
            │
            ├─► step.run: postSlackApproval()
            │       │
            │       └─► POST https://slack.com/api/chat.postMessage
            │
            ├─► step.waitForEvent: 'slack/approval.clicked' (timeout: 3d)
            │       │
            │       └─► [Slack button click sends event to Inngest]
            │
            ├─► Verify Slack signature
            │
            ├─► step.run: updateSlackApproval()
            │       │
            │       └─► POST to Slack responseUrl
            │
            └─► If approved: step.fetch to Circle API
                    │
                    └─► POST https://app.circle.so/api/admin/v2/posts
                            body: { internal_custom_html: <JobPost /> }
```

---

## File Reference

### testing-bun

| File | Description |
|------|-------------|
| `convex/schema.ts` | Database schema: senders, inboundMessages, profiles, resumes, OAuth tables |
| `convex/http.ts` | HTTP router with Twilio webhook endpoint |
| `convex/senders.ts` | Sender CRUD, getByPhone, updateStatus with cascade |
| `convex/inboundMessages.ts` | Message CRUD, updateStatus |
| `convex/functions.ts` | Auth helpers: adminQuery, adminMutation (checks ADMIN_EMAILS) |
| `convex/inngest.ts` | sendProfileWebhook internal action |
| `src/routes/_authenticated/_admin/admin.tsx` | Admin dashboard with 4 tabs |
| `src/components/admin/SenderCard.tsx` | Sender card with approve/block buttons |
| `src/components/admin/MessageCard.tsx` | Message card with approve/reject/processed buttons |
| `src/components/admin/StatusBadge.tsx` | Color-coded status badge |
| `package.json` | Dependencies: Convex, TanStack, WorkOS, React 19 |

### job-ingress

| File | Description |
|------|-------------|
| `src/index.tsx` | Hono app entry, routes, Inngest serve |
| `src/api/submit-job.ts` | Job submission handler |
| `src/api/passwordless.ts` | Auth0 OTP routes |
| `src/api/utils.ts` | ID token verification |
| `src/inngest/client.ts` | Inngest client with middleware |
| `src/inngest/types.ts` | Event schemas, FieldsSchema |
| `src/inngest/index.ts` | Exports functions array |
| `src/inngest/approve-job.ts` | Main approval workflow |
| `src/inngest/lib/post-slack-approval.ts` | Slack Block Kit message builder |
| `src/inngest/lib/verify-slack-signature.ts` | Slack request signature verification |
| `src/inngest/lib/render-job-post.tsx` | Circle HTML card JSX component |
| `src/inngest/lib/circle.ts` | Circle API helpers |
| `src/inngest/lib/utils.ts` | formatSalary, kebabToReadable |
| `src/shared/schemas/job-submission.schema.ts` | Job validation schema |
| `src/shared/schemas/index.ts` | Schema exports |
| `src/client/components/JobForm.tsx` | Multi-step React form |
| `src/client/hooks/useFormUrlState.ts` | URL state persistence |
| `src/client/hooks/use-verified-contact.ts` | Contact verification hook |
| `wrangler.jsonc` | Cloudflare Workers config, env vars |
| `package.json` | Dependencies: Hono, Inngest, Valibot, React 19 |

---

## Current State Summary

| Aspect | testing-bun (SMS) | job-ingress (Form) |
|--------|-------------------|-------------------|
| **Input Format** | Unstructured SMS text | Structured form fields |
| **Validation** | None (raw text stored) | Valibot schema |
| **Storage** | Convex database | None (stateless workflow) |
| **Approval UI** | Web admin dashboard | Slack buttons |
| **Approval Method** | Manual clicks in dashboard | Inngest waitForEvent |
| **Circle Posting** | Not implemented | Automated via Inngest |
| **Contact Verification** | Implicit (sender phone) | Explicit (Auth0 OTP) |
| **Status Lifecycle** | pending_review → approved/rejected → processed | app/job-submitted → slack/approval.clicked → Circle post |
