# Job Posting & Application Flow Spec (v2)

## Overview

Frictionless job posting via SMS or web form. Account creation deferred until first applicant. Three-stage human verification: sender screening, job approval, and employer account vetting.

---

## Actors

| Actor | Description |
|-------|-------------|
| **Poster** | Anyone submitting a job (SMS or form). No account yet. |
| **Employer** | Poster who completed account setup + passed vetting. |
| **Seeker** | Circle member with profile/resume. Already authenticated via WorkOS. |
| **Admin** | Internal team reviewing at all 3 checkpoints. |

---

## Input Channels

| Channel | Auth Required? | Notes |
|---------|----------------|-------|
| SMS to Twilio number | No | Phone becomes identifier |
| Web form on our site | Yes (WorkOS) | Email becomes identifier |

---

## Three Verification Checkpoints

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CHECKPOINT 1: SENDER SCREENING                           │
│                    (First-time texters only)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   First text from unknown number → Slack notification                       │
│                                                                             │
│   Admin sees: Phone number + job text                                       │
│   Admin decides: [Approve Sender] or [Block Sender]                         │
│                                                                             │
│   • Approve → Sender whitelisted, job proceeds to Checkpoint 2              │
│   • Block → Sender blocked, all future texts ignored (silent)               │
│                                                                             │
│   NOTE: Known senders skip this checkpoint entirely.                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    CHECKPOINT 2: JOB APPROVAL                               │
│                    (All jobs, even from approved senders)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Job parsed by AI → Slack notification                                     │
│                                                                             │
│   Admin sees: Parsed job details, company, contact                          │
│   Admin decides: [Approve Job] or [Deny Job]                                │
│                                                                             │
│   • Approve → Posted to Circle, saved to DB                                 │
│   • Deny → Silent drop (MVP), maybe notify sender later                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    CHECKPOINT 3: EMPLOYER ACCOUNT VETTING                   │
│                    (When poster sets up account to view applicants)         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Poster clicks "complete setup" link → Signup form                         │
│   Collects: Name, email, phone, company, role, etc.                         │
│                                                                             │
│   → Slack notification to Admin                                             │
│                                                                             │
│   Admin sees: Full employer info, linked jobs                               │
│   Admin decides: [Approve Account] or [Reject Account]                      │
│                                                                             │
│   • Pending → Poster sees "We're reviewing your info..."                    │
│   • Approved → Redirect to candidate view, full access                      │
│   • Rejected → ??? (deferred)                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Application Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SEEKER APPLIES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Circle post has "Apply" button (link to our server)                       │
│                        │                                                    │
│                        ▼                                                    │
│   Seeker clicks → Our server detects user via shared WorkOS session         │
│                        │                                                    │
│                        ▼                                                    │
│   Popup (embedded in Circle HTML):                                          │
│   ┌─────────────────────────────────┐                                       │
│   │ Include a message (optional):   │                                       │
│   │ ┌─────────────────────────────┐ │                                       │
│   │ │ I'm interested because...   │ │                                       │
│   │ └─────────────────────────────┘ │                                       │
│   │         [Apply]  [Cancel]       │                                       │
│   └─────────────────────────────────┘                                       │
│                        │                                                    │
│                        ▼                                                    │
│   Application saved (seeker profile + message auto-attached)                │
│                        │                                                    │
│                        ▼                                                    │
│   Seeker sees: "Application submitted!" (confirmation only for MVP)         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        POSTER NOTIFICATION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   EVERY application triggers a notification to the poster:                  │
│                                                                             │
│   On first application for a job:                                           │
│                                                                             │
│   SMS (or email if on file):                                                │
│   "Someone is interested in your Cook position!                             │
│    Complete your account to connect: [MAGIC_LINK]                           │
│    Reply STOP to close this posting."                                       │
│                                                                             │
│   On subsequent applications:                                               │
│                                                                             │
│   SMS: "Another applicant for your Cook position!                           │
│         [X] people interested. View: [LINK]"                                │
│                                                                             │
│   Link behavior based on employer account status:                           │
│   - No employer account: Links to /employer/setup (complete signup form)    │
│   - Account pending review: Links to /employer/setup (shows pending status) │
│   - Account approved: Links to /employer/candidates (view applicants)       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Employer Account Setup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ACCOUNT SETUP FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Poster clicks magic link → Signup Form                                    │
│                                                                             │
│   Fields (pre-filled from AI extraction where possible):                    │
│   • Full name *                                                             │
│   • Email *                                                                 │
│   • Phone * (pre-filled from SMS)                                           │
│   • Company name *                                                          │
│   • Your role/title                                                         │
│   • Company website                                                         │
│   • How did you hear about us?                                              │
│                                                                             │
│                        │                                                    │
│                        ▼                                                    │
│   Submit → Account created in "pending_review" status                       │
│          → Slack notification to Admin (Checkpoint 3)                       │
│          → Poster sees: "Thanks! Our team is reviewing..."                  │
│                                                                             │
│                        │                                                    │
│             ┌──────────┴──────────┐                                         │
│             │                     │                                         │
│         APPROVED              REJECTED                                      │
│             │                     │                                         │
│             ▼                     ▼                                         │
│   SMS: "Account approved!"    (Deferred)                                    │
│   Link to candidate view                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Candidate Review (Post-Approval)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CANDIDATE VIEW PAGE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Employer (approved) visits candidate page:                                │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │ Job: Cook at [Your Company]                                 │           │
│   │ 3 applicants                                                │           │
│   ├─────────────────────────────────────────────────────────────┤           │
│   │                                                             │           │
│   │ [Photo] Jane Smith                                          │           │
│   │ Applied: Dec 11, 2024                                       │           │
│   │ Message: "I have 5 years cooking experience..."             │           │
│   │                                                             │           │
│   │ Resume: [View PDF]                                          │           │
│   │ Profile: [View on Circle]                                   │           │
│   │                                                             │           │
│   │         [Connect]              [Pass]                       │           │
│   │                                                             │           │
│   └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
│   CONNECT → DM Composer:                                                    │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │ Send a message to Jane:                                     │           │
│   │ ┌─────────────────────────────────────────────────────────┐ │           │
│   │ │ Hi Jane! Thanks for your interest. I'd love to chat...  │ │           │
│   │ └─────────────────────────────────────────────────────────┘ │           │
│   │                    [Send via Circle DM]                     │           │
│   └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
│   DM sent via Circle API → Application marked "connected"                   │
│                                                                             │
│   PASS → Application marked "passed" (silent for MVP)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Job Lifecycle Management

```
Employer can text/email at any time:
  "STOP" or "CLOSE" → Close the job posting (no new applications)

Future: Dashboard, edit posting, reopen, etc.
```

---

## Data Model (Conceptual)

```
Sender
  - phone (unique)
  - email?
  - name?
  - company?
  - status: pending_review | approved | blocked
  - employerAccountId? → links to Employer after account setup

Employer (created at account setup)
  - senderId (back-link)
  - name, email, phone, company, role, website
  - status: pending_review | approved | rejected
  - workosUserId?

JobSubmission
  - senderId
  - source: sms | form
  - rawContent
  - parsedJob
  - status: pending_sender_review | pending_job_review | approved | denied | closed
  - circlePostId?
  - circlePostUrl?

Application
  - jobSubmissionId
  - seekerProfileId (Circle member)
  - message?
  - status: pending | connected | passed
  - appliedAt
```

---

## Security TODOs

| Priority | Item | Status |
|----------|------|--------|
| HIGH | **Magic link tokens need HMAC signing** - Currently tokens are just base64-encoded JSON with no cryptographic signature. Anyone who guesses the structure and obtains a submissionId could forge tokens. Must add HMAC-SHA256 signing with a server secret before production. | TODO |

---

## Open Questions (Reduced)

| # | Question |
|---|----------|
| 1 | Form submitters - do they go through same 3 checkpoints? Or different flow since they're already authenticated? |
| 2 | Can a seeker apply to multiple jobs from same employer? |
| 3 | What if employer is rejected at Checkpoint 3? Refund applicants somehow? |
| 4 | Circle DM - do we create a Circle account for employer automatically? |

---

## MVP vs V2

| MVP | V2 |
|-----|-----|
| Silent drop on deny | Notify poster on deny |
| No dashboard | Employer dashboard |
| Confirmation only for seeker | Application status tracking |
| Let jobs sit forever | Auto-close after X days |
| SMS/email notifications | In-app notification center |
