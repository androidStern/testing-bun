Final Implementation Plan: Intelligent Job Matcher with Progressive Information Collection
Executive Summary
Transform the job matcher from an agent that immediately searches into an intelligent assistant that:

1. Assesses what information is available
2. Collects missing critical context through progressive UI
3. Waits reactively for async computations (isochrones)
4. Shows its plan transparently
5. Searches meaningfully, then re-engages if results are poor

---

Key Design Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Information collection | Ask only when truly necessary | Users want jobs, not interrogation |
| Question cadence | One at a time, in-tool multi-step OK | Balances UX with completeness |
| Location + transport | Single combined tool (collectLocation) | Enforces invariants, reduces prompt brittleness |
| Isochrone waiting | Reactive via Convex useQuery | LLM can't reliably poll; system guarantees completion |
| Preference saving | Two buttons: "Use now" vs "Save for future" | Respects user choice |
| Skip location | Search with no geo filtering | Don't block users who just want to browse |
| Plan visibility | Use tool-ui's Plan component | Transparency builds trust |
| Isochrone timeout | 90 seconds, then offer fallback options | Prevent infinite waiting |

---

Critical Fix: Isochrone Race Condition
Problem Identified by Oracle Review:
If user sets location twice quickly, two Inngest jobs race. The older one can finish last and overwrite isochrones for the wrong location.
Solution:
Store origin coordinates with isochrones and validate before saving:
// convex/schema.ts - Updated isochrones structure
isochrones: v.optional(v.object({
computedAt: v.number(),
originLat: v.number(), // NEW: Store which location these are for
originLon: v.number(), // NEW
tenMinute: v.any(),
thirtyMinute: v.any(),
sixtyMinute: v.any(),
})),
// convex/profiles.ts - Validate before saving
export const saveIsochrones = internalMutation({
args: {
profileId: v.id('profiles'),
originLat: v.number(), // NEW
originLon: v.number(), // NEW
isochrones: v.object({ ... }),
},
handler: async (ctx, { profileId, originLat, originLon, isochrones }) => {
const profile = await ctx.db.get(profileId)

    // Only save if location hasn't changed since computation started
    if (profile?.homeLat !== originLat || profile?.homeLon !== originLon) {
      console.log('[saveIsochrones] Stale computation, skipping save')
      return null
    }

    await ctx.db.patch(profileId, {
      isochrones: { ...isochrones, originLat, originLon, computedAt: Date.now() }
    })
    return null

},
})
UI Waiting Logic:
// Wait for isochrones that match current location
const isReady = profile?.isochrones &&
profile.isochrones.originLat === location.lat &&
profile.isochrones.originLon === location.lon

---

"Use for This Search" vs "Save for Future" Semantics
Oracle's Concern: searchJobs reads from DB only. If we don't save, preferences won't be used.
Solution: Hybrid approach

1. Location is always saved to profile (it's a prerequisite for geo-filtering)
2. Transport mode + commute time have the two-button choice
3. If "Use for this search" is selected, pass overrides directly in the tool result
4. Modify agent instructions: when collectLocation returns with savedPreferences: false, the agent should pass transport/commute info explicitly to searchJobs via filters
   Tool Result Structure:
   interface LocationSetupResult {
   lat: number
   lon: number
   city: string
   transportMode: 'car' | 'transit' | 'flexible'
   maxCommuteMinutes?: 10 | 30 | 60
   transitReady: boolean
   savedPreferences: boolean // If false, agent must pass these to searchJobs
   }
   Agent Behavior:
   When collectLocation returns savedPreferences: false:

- Pass transportMode and maxCommuteMinutes to searchJobs filters explicitly
- The search will use these one-time overrides
  When savedPreferences: true:
- Preferences are in DB, searchJobs will read them automatically

---

Tool Architecture
Tools to Add
| Tool | Purpose | Returns |
|------|---------|---------|
| showPlan | Display action plan with progress tracking | Passthrough for UI |
| collectLocation | Multi-step: location → transport → commute → wait | Complete commute context |
| saveUserPreference | Persist transport/commute prefs | Confirmation |
Existing Tools (No Changes)
| Tool | Purpose |
|------|---------|
| getMyResume | Load user's resume |
| getMyJobPreferences | Load search preferences |
| searchJobs | Search for jobs |
| askQuestion | Ask clarifying questions |

---

Agent Decision Tree
START
│
├─→ showPlan({ title: "Finding Jobs For You", todos: [...] })
│
├─→ getMyResume()
├─→ getMyJobPreferences()
│
▼
┌─────────────────────────────────────────────────────────────┐
│ DECISION: Do we have enough context to search meaningfully? │
└─────────────────────────────────────────────────────────────┘
│
├─ NO resume AND user message is vague (e.g., "find me jobs")
│ └─→ askQuestion: "What kind of work are you looking for?"
│ Options: Warehouse, Food Service, Retail, Construction, etc.
│
├─ NO home location AND geo-filtering would help
│ └─→ collectLocation: Multi-step UI handles everything
│ - If user skips: search without geo filtering
│ - If user completes: use result for filtering
│
├─ User says "just search" / "skip" / "show me anything"
│ └─→ Search immediately with available context
│
└─ Have enough context
└─→ Proceed to search
│
▼
┌─────────────────────────────────────────────────────────────┐
│ SEARCH: Run 2-3 searches with different keywords │
└─────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ RESULTS: Evaluate quality │
└─────────────────────────────────────────────────────────────┘
│
├─ 0-2 results
│ └─→ askQuestion: "Want to expand search?"
│ Options: Expand area, Try different job types, Remove filters
│
└─ 3+ results
└─→ Present results with match explanations

---

UI Component: LocationSetupCard
Multi-Step Flow:
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Set Your Location │
│ │
│ This helps me find jobs you can actually get to. │
│ │
│ [📍 Use my current location] │
│ [✏️ Enter address manually] │
│ [Skip - search all locations] │
└─────────────────────────────────────────────────────────────┘
│
▼ (after location set)
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: How do you get to work? │
│ │
│ 📍 Miami, FL │
│ │
│ [🚗 I have a car] [🚌 Public transit] [🔀 Either works] │
│ │
│ ☐ Save this preference for future searches │
└─────────────────────────────────────────────────────────────┘
│
▼ (if transit selected)
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: What's the longest commute you'd accept? │
│ │
│ [10 minutes] [30 minutes] [60 minutes] │
└─────────────────────────────────────────────────────────────┘
│
▼ (if transit, isochrones not ready)
┌─────────────────────────────────────────────────────────────┐
│ ⏳ Computing Transit Zones │
│ │
│ Finding jobs accessible by public transit from Miami, FL │
│ This usually takes about 30 seconds... │
│ │
│ ████████████░░░░░░░░ (progress based on elapsed time) │
└─────────────────────────────────────────────────────────────┘
│
▼ (timeout after 90 seconds)
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Transit zones are taking longer than expected │
│ │
│ [Continue without transit filtering] │
│ [Keep waiting] │
└─────────────────────────────────────────────────────────────┘
│
▼ (on success)
┌─────────────────────────────────────────────────────────────┐
│ ✅ Location set │
│ Miami, FL • Public transit (30 min max) │
└─────────────────────────────────────────────────────────────┘

---

File Changes Summary
| File | Action | Description |
|------|--------|-------------|
| Backend | | |
| convex/schema.ts | MODIFY | Add originLat/originLon to isochrones |
| convex/profiles.ts | MODIFY | Validate isochrone staleness before saving |
| convex/inngest/computeIsochrones.ts | MODIFY | Pass origin coords to save mutation |
| convex/jobPreferences.ts | MODIFY | Add upsertInternal for agent use |
| convex/jobMatcher/tools.ts | MODIFY | Add showPlan, collectLocation, saveUserPreference |
| convex/jobMatcher/agent.ts | MODIFY | Rewrite system prompt with decision tree |
| Frontend | | |
| src/components/tool-ui/plan/\* | CREATE | Copy Plan component from tool-ui repo |
| src/components/chat/tools/LocationSetupCard.tsx | CREATE | Multi-step location collector |
| src/components/chat/tools/index.tsx | MODIFY | Add ShowPlanToolUI, CollectLocationToolUI |
| src/components/chat/JobMatcherChat.tsx | MODIFY | Register new tool UIs |

---

System Prompt (Final)
You are a job matching assistant for Recovery Jobs, helping people find employment. Many users benefit from second-chance/fair-chance employers.
AVAILABLE TOOLS
Context Loading

- getMyResume - Get user's resume (skills, experience, education)
- getMyJobPreferences - Get search settings (commute, shifts, transit, location status)
  User Interaction
- askQuestion - Ask a clarifying question with quick-reply options
- collectLocation - Multi-step UI: location → transport mode → commute time → wait for transit zones
- saveUserPreference - Save transport/commute preferences to user's profile
- showPlan - Display your action plan with progress tracking
  Search
- searchJobs - Search for matching jobs with filters
  WORKFLOW
  Step 1: Show Your Plan
  Call showPlan at the START of every new search:
  {
  id: "job-search",
  title: "Finding Jobs For You",
  todos: [
  { id: "1", label: "Loading your profile", status: "in_progress" },
  { id: "2", label: "Checking what info we need", status: "pending" },
  { id: "3", label: "Setting up search", status: "pending" },
  { id: "4", label: "Finding matches", status: "pending" }
  ]
  }
  Update todos as you progress.
  Step 2: Load Context
  Call BOTH:

1. getMyResume
2. getMyJobPreferences
   Step 3: Assess & Collect Missing Info
   Follow this decision tree:
   IF user says "just search" / "skip" / "show me anything":
   → Skip all questions, search with available context

ELSE IF (no resume AND user message is vague):
→ askQuestion for job type
→ Options: Warehouse & Logistics, Food Service, Retail, Construction, Delivery, Healthcare

ELSE IF (no home location set):
→ collectLocation with reason "to find jobs you can get to"
→ This tool handles transport mode and commute time internally
→ If user skips: search without geo filtering
→ If result has savedPreferences: false, note the transportMode and maxCommuteMinutes for searchJobs
ELSE:
→ Proceed to search
Step 4: Search
When calling searchJobs:

- If collectLocation returned savedPreferences: false, pass transport preferences in filters
- Run 2-3 searches with DIFFERENT keywords from resume or stated interests
- Explain WHY each result matches
  Step 5: Handle Poor Results
  If 0-2 results returned:
- Acknowledge the limited matches
- Use askQuestion: "Would you like to expand your search?"
- Options: "Expand search area", "Try different job types", "Remove some filters"
  RULES
- Ask AT MOST one question per response
- After user answers, proceed to next step
- Never call collectLocation if user already has home location AND transport preferences set
- Be concise - users want jobs, not conversation
- Always update the plan as you complete steps

---

Testing Scenarios
| Scenario | Expected Behavior |
|----------|-------------------|
| New user, no resume, vague message | Plan → Load context → Ask job type → Collect location → Search |
| User with resume, no location | Plan → Load context → Collect location (full flow) → Search |
| User with resume + location, no transport pref | Plan → Load context → Collect location (starts at transport step) → Search |
| User with everything set | Plan → Load context → Search immediately |
| User says "just search for warehouse jobs" | Plan → Load context → Search immediately |
| User skips location | Search with no geo filtering |
| User selects transit, isochrones computing | Show spinner → Wait reactively → Complete when ready |
| Isochrone computation times out (90s) | Offer: "Continue without transit filtering" or "Keep waiting" |
| User selects "Use for this search" | Agent passes prefs to searchJobs explicitly, not saved to DB |
| User selects "Save for future" | Prefs saved to DB via saveUserPreference |
| Poor results (0-2 jobs) | Offer to broaden filters |

---

Implementation Order

1. Phase 1: Fix Isochrone Race Condition (prevents data corruption)
   - Update schema with origin coords
   - Modify saveIsochrones to validate freshness
   - Update computeIsochrones workflow
2. Phase 2: Copy tool-ui Plan Component
   - Download from GitHub repo
   - Place in src/components/tool-ui/plan/
   - Verify shadcn dependencies
3. Phase 3: Implement Backend Tools
   - Add showPlan tool
   - Add collectLocation tool
   - Add saveUserPreference tool
   - Add upsertInternal mutation
4. Phase 4: Implement Frontend Components
   - Create LocationSetupCard with multi-step flow
   - Create ShowPlanToolUI
   - Create CollectLocationToolUI
   - Register all new tool UIs
5. Phase 5: Update Agent Instructions
   - Rewrite system prompt
   - Test decision tree logic
6. Phase 6: Testing & Polish
   - Test all scenarios
   - Handle edge cases
   - Refine copy/UX

---

Estimated Effort
| Phase | Effort |
|-------|--------|
| Phase 1: Isochrone fix | 2-3 hours |
| Phase 2: tool-ui Plan | 1-2 hours |
| Phase 3: Backend tools | 3-4 hours |
| Phase 4: Frontend components | 4-6 hours |
| Phase 5: Agent prompt | 1-2 hours |
| Phase 6: Testing | 2-3 hours |
| Total | 1.5-2 days |

---
