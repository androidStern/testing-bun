# Job Poster Identity & Application Flow

We're building a job board where employers can post jobs by simply texting a description to our Twilio number—we parse it with AI and post it to our Circle community. The open question is what happens when a job seeker (who is a full RJ member with a Circle account) wants to apply: how do we notify the poster, and how do we facilitate the connection? The core tension is that requiring posters to create an RJ/Circle account enables richer features (Circle DMs, in-platform management, outcome tracking) but adds friction that undermines the "just text us a job" value proposition—especially problematic for one-time posters like small businesses with temp work. The alternative is keeping posters anonymous (phone/email only) and simply forwarding candidate info to them via SMS or email, but this means communication happens off-platform with no visibility into outcomes. A hybrid approach would let anyone post via SMS with no account, then offer two paths when accepting a candidate: "Share My Contact" (reveals their email/phone to the seeker, done) or "Connect on Platform" (prompts quick account creation, opens Circle DM). We also need to handle job closing—posters should be able to reply "STOP" via SMS or click a link to stop receiving applications. The decision likely hinges on what percentage of posters are one-time vs. repeat, and whether we value tracking hiring outcomes over minimizing friction.

## The Actors

| Actor               | Identity                                    | Platform Presence              |
| ------------------- | ------------------------------------------- | ------------------------------ |
| Job Seeker          | RJ member, Circle account, WorkOS auth      | Full member                    |
| Job Poster (Type A) | Small biz, temp work, maybe not in recovery | Phone number only (texted job) |
| Job Poster (Type B) | Employer with ongoing relationship          | Could have RJ account          |

## The Core Tension

```
SIMPLE FOR POSTER          vs          RICH COMMUNICATION
─────────────────                      ────────────────────
"Just text a job"                      Circle DMs, in-platform
No account needed                      Requires poster account
Notify via SMS/email                   Poster must check Circle
Share seeker info directly             Mediated connection
```

## Application Flow

```
SEEKER sees job on Circle
        │
        ▼
Clicks "Apply" → Submits resume/info
        │
        ▼
POSTER receives notification (SMS? Email? Both?)
        │
        ├── Contains: Candidate summary, resume link
        │
        ▼
POSTER takes action:
        │
        ├─► "Accept" → Connection established
        │              (What does this mean?)
        │
        ├─► "Ignore" → Nothing happens, seeker not notified
        │
        └─► "Close Posting" → No more applications accepted
```

## The "Accept Connection" Question

Here's where the two options diverge:

### Option 1: Poster stays anonymous (phone/email only)

```
Poster clicks "Accept"
        │
        ▼
System shares poster's contact with seeker:
  - Email: "John from ABC Company wants to connect.
            Their email: john@abc.com"
  - Or SMS: Same message to seeker's phone
        │
        ▼
Communication happens OFF-PLATFORM (email, phone)
```

**Pros:** Zero friction for poster, they never leave SMS
**Cons:** No visibility into whether connection worked, no Circle engagement

### Option 2: Poster gets Circle account (at accept time?)

```
Poster clicks "Accept"
        │
        ▼
If no Circle account:
  "To connect, create a free account (30 sec)"
  [One-click signup with phone/email they provided]
        │
        ▼
Circle DM opens between poster and seeker
```

**Pros:** Mediated, trackable, builds community
**Cons:** Friction at critical moment, may lose conversions

## A Hybrid Approach

What if you defer the account question until it matters?

```
POSTING: Text job → We post it → Done (no account needed)
         │
         ▼
APPLICATION: Seeker applies
         │
         ▼
NOTIFICATION: Poster gets SMS + email:
  "Someone applied to your [Job Title] posting!

   [View Candidate] ← link to simple web page

   Reply STOP to close this job posting"
         │
         ▼
POSTER views candidate page (no login required, magic link):
  - Candidate summary
  - Resume/info
  - [Accept - Share My Contact]  ← reveals poster email/phone to seeker
  - [Accept - Connect on Platform] ← prompts account creation
  - [Pass on This Candidate]
  - [Close Job Posting]
         │
         ▼
If "Share My Contact":
  - Seeker gets email: "Great news! [Poster] wants to connect.
    Email: john@abc.com | Phone: 555-1234"
  - Done, off-platform from here

If "Connect on Platform":
  - Quick account creation (prefilled with their phone/email)
  - Circle DM initiated
  - Better for ongoing relationship
```

## Handling "Close Posting"

Multiple touch points:

1. **SMS:** Reply `CLOSE` or `STOP` to the job number
2. **Email:** Link in any notification email
3. **Web:** Button on the magic-link candidate page

## Questions to Help Decide

1. **What % of posters are one-time vs repeat?**
   - One-time → optimize for frictionless
   - Repeat → account pays off

2. **Do you want to track outcomes?**
   - "Did they actually hire someone?" requires some platform presence

3. **What's the seeker experience if poster never responds?**
   - With accounts: You can nudge, show "Pending" status
   - Anonymous: Seeker just... waits?

4. **Is Circle the right place for job-related DMs?**
   - Circle is community. Job convos might feel transactional there.
   - Alternative: Email-based thread (like Craigslist relay)
