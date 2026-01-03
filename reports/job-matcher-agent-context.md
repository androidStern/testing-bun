# Job Matching AI Agent - Complete Context Report

> **Generated**: January 2, 2026  
> **Purpose**: Comprehensive technical documentation for AI architects designing the next iteration

---

## Executive Summary

The job matching system is a **stateful AI agent** built on the **Convex Agent framework** (`@convex-dev/agent`). It combines:
- **LLM-powered intent parsing** (via Groq SDK + `moonshotai/kimi-k2-instruct` model)
- **High-performance search** (Typesense with faceted filtering)
- **Geospatial filtering** (Transit isochrones via Geoapify + Turf.js polygon containment)
- **Real-time streaming UI** (assistant-ui + Convex subscriptions)

The agent follows a structured workflow: load user context → gather missing info via interactive tools → search with automatic geo-filtering → return curated results.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  JobMatcherChat.tsx          │  JobMatcherRuntimeProvider.tsx                │
│  - Welcome screen            │  - Bridges Convex Agent → assistant-ui        │
│  - Chat header w/ controls   │  - useUIMessages subscription                 │
│  - Thread component          │  - Message format conversion                  │
│                              │  - Tool result handling                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                          Tool UI Components                                   │
│  ShowPlanToolUI | ResumeToolUI | PreferencesToolUI | SearchJobsToolUI        │
│  QuestionToolUI | CollectLocationToolUI (multi-step location wizard)         │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ Convex Actions
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Convex + Inngest)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  convex/jobMatcher/                                                          │
│  ├── agent.ts        → Agent definition (instructions, model, tools)         │
│  ├── tools.ts        → 7 tools: showPlan, getMyResume, getMyJobPreferences,  │
│  │                      searchJobs, askQuestion, collectLocation,            │
│  │                      saveUserPreference                                   │
│  ├── actions.ts      → Entry points: startSearch, sendMessage, forceSearch,  │
│  │                      submitToolResult, cancelSearch                       │
│  ├── queries.ts      → getActiveSearch, listSearches, createSearchRecord     │
│  ├── messages.ts     → listThreadMessages (streaming + pagination)           │
│  └── schema.ts       → Zod schemas for job results                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Supporting Modules                                                          │
│  ├── scrapedJobsSearch.ts  → Typesense search with geo-filter                │
│  ├── lib/geoFilter.ts      → Isochrone polygon filtering (Turf.js)           │
│  ├── jobPreferences.ts     → User preference CRUD                            │
│  ├── resumes.ts            → Resume data access                              │
│  ├── profiles.ts           → Profile + isochrones storage                    │
│  └── isochrones.ts         → Triggers Inngest workflow                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Inngest Workflows                                                           │
│  └── computeIsochrones.ts  → Async isochrone computation via Geoapify        │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Groq API           → LLM inference (moonshotai/kimi-k2-instruct-0905)       │
│  Typesense          → Full-text + faceted job search                         │
│  Geoapify           → Transit isochrone computation                          │
│  Nominatim          → Geocoding (address → coordinates)                      │
│  WorkOS AuthKit     → User authentication                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure & Contents

### 1. Agent Core (`convex/jobMatcher/`)

#### `convex/jobMatcher/agent.ts` (117 lines)
**Purpose**: Defines the AI agent's personality, model, and toolset.

```typescript
// Key configuration:
export const jobMatcherAgent = new Agent(components.agent, {
  name: 'Job Matcher',
  languageModel: groq('moonshotai/kimi-k2-instruct-0905'),
  maxSteps: 15,
  tools,
  instructions: `You are a job matching assistant for Recovery Jobs...
  
  ## Available Tools (ONLY use these exact names)
  - showPlan - Display your action plan with progress tracking
  - getMyResume - Get the user's resume
  - getMyJobPreferences - Get the user's job search preferences  
  - collectLocation - Show UI to collect location + transport preferences
  - searchJobs - Search for jobs matching keywords and filters
  - askQuestion - Ask the user a clarifying question with options
  - saveUserPreference - Save transport/commute preferences to profile
  
  ## Workflow
  1. ALWAYS start with showPlan to display what you're doing
  2. Load profile data via getMyResume and getMyJobPreferences
  3. Collect missing info (decision tree for location, job type, etc.)
  4. Run 2-3 searches with relevant keywords
  5. Summarize WHY each job matches
  ...`
})
```

**Key Design Decisions**:
- Uses `maxSteps: 15` to allow multi-tool workflows
- System prompt contains explicit decision tree for handling missing data
- Tool names are enumerated to prevent hallucination
- Specific guidance on when to skip questions vs. ask them

---

#### `convex/jobMatcher/tools.ts` (642 lines)
**Purpose**: Implements all 7 agent tools with security-first design.

**Tool Inventory**:

| Tool | Purpose | Security Model |
|------|---------|----------------|
| `showPlan` | Render progress UI with todo list | UI-only, no DB access |
| `getMyResume` | Fetch user's resume | Uses `ctx.userId` from auth context |
| `getMyJobPreferences` | Fetch commute/shift/fair-chance prefs | Uses `ctx.userId` from auth context |
| `collectLocation` | Multi-step location wizard | Returns status, UI handles input |
| `searchJobs` | Search Typesense with auto geo-filter | Implicit isochrone filtering, sanitized results |
| `askQuestion` | Q&A with quick-reply buttons | Passthrough to UI |
| `saveUserPreference` | Persist transport/commute prefs | Uses `ctx.userId` from auth context |

**`searchJobs` Implementation** (most complex tool):

```typescript
export const searchJobs = createTool({
  args: z.object({
    query: z.string(),
    filters: z.object({
      second_chance_only: z.boolean().optional(),
      shifts: z.array(z.enum([...])).optional(),
      city: z.string().optional(),
      // ...
    }).optional(),
    limit: z.number().min(1).max(8).default(5),
  }),
  handler: async (ctx, args): Promise<SearchResult> => {
    // 1. Fetch user context (LLM never sees this)
    const [prefs, profile] = await Promise.all([
      ctx.runQuery(internal.jobPreferences.getByWorkosUserIdInternal, ...),
      ctx.runQuery(internal.profiles.getByWorkosUserIdInternal, ...),
    ]);
    
    // 2. Merge explicit filters with implicit user preferences
    const typesenseFilters = { ...args.filters };
    if (prefs?.requireSecondChance) typesenseFilters.second_chance = true;
    
    // 3. Pre-filter with wide geo radius (80km)
    let geoFilter = profile?.homeLat ? { lat, lng, radiusKm: 80 } : undefined;
    
    // 4. Execute Typesense search
    const searchResults = await ctx.runAction(internal.scrapedJobsSearch.searchWithGeo, ...);
    
    // 5. Post-process with precise isochrone polygon filtering
    if (profile?.isochrones && prefs?.requirePublicTransit) {
      jobs = filterByIsochrone(jobs, profile.isochrones, maxMinutes);
    }
    
    // 6. Return sanitized results with search context
    return { jobs: sanitizedJobs, searchContext };
  }
})
```

**Sanitization Pattern**:
- Resume: Strip internal IDs, timestamps, storage refs
- Preferences: Return boolean flags, not raw coordinates
- Jobs: Truncate descriptions to 100 chars, format salary strings

---

#### `convex/jobMatcher/actions.ts` (206 lines)
**Purpose**: Entry points for starting/continuing agent conversations.

```typescript
// Main entry point
export const startSearch = action({
  args: { prompt: v.string(), threadId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');
    
    // Continue existing thread OR create new
    if (args.threadId) {
      const { thread } = await jobMatcherAgent.continueThread(ctx, {
        threadId: args.threadId,
        userId: identity.subject,
      });
      await thread.streamText({ prompt: args.prompt }, { saveStreamDeltas: true });
      return { isNew: false, threadId: args.threadId };
    }
    
    // Create new thread + record search
    const { thread, threadId } = await jobMatcherAgent.createThread(ctx, { userId });
    await ctx.runMutation(internal.jobMatcher.queries.createSearchRecord, { ... });
    await thread.streamText({ prompt: args.prompt }, { saveStreamDeltas: true });
    return { isNew: true, threadId };
  }
})
```

**Other Actions**:
- `sendMessage`: Continue conversation in existing thread
- `forceSearch`: Skip Q&A, search immediately with system prompt
- `submitToolResult`: Bridge UI tool results back to agent (e.g., location)
- `cancelSearch`: Mark search as cancelled

---

#### `convex/jobMatcher/queries.ts` (144 lines)
**Purpose**: Database queries for search management.

**Key Queries**:
- `getActiveSearch`: Find user's current active search (one per user)
- `listSearches`: Search history for user
- `createSearchRecord`: Mark previous search complete, create new one
- `markSearchCancelled`: Update search status

---

#### `convex/jobMatcher/messages.ts` (47 lines)
**Purpose**: List thread messages with streaming support.

```typescript
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    // Auth + ownership check
    const search = await ctx.db.query('jobSearches')
      .withIndex('by_thread_id', q => q.eq('threadId', args.threadId))
      .unique();
    if (!search || search.workosUserId !== identity.subject) {
      throw new Error('Thread not found or not authorized');
    }
    
    // Paginated messages + streaming deltas
    const paginated = await listUIMessages(ctx, components.agent, { threadId, paginationOpts });
    const streams = await syncStreams(ctx, components.agent, { threadId, streamArgs });
    return { ...paginated, streams };
  }
})
```

---

### 2. Search Infrastructure

#### `convex/scrapedJobsSearch.ts` (268 lines)
**Purpose**: Typesense integration with geo-filtering.

**Key Function** - `searchWithGeo`:
```typescript
export const searchWithGeo = internalAction({
  args: {
    query: v.string(),
    filters: v.optional(v.object({ ... })),
    shiftPreferences: v.optional(v.array(v.string())),  // OR logic
    geoFilter: v.optional(v.object({ lat, lng, radiusKm })),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const client = getTypesenseClient();
    
    // Build filter string with AND logic for facets
    const filterParts = [buildFilterStringForGeo(args.filters)];
    
    // Shift preferences use OR logic (any matching shift)
    if (args.shiftPreferences?.length > 0) {
      const shiftConditions = args.shiftPreferences
        .map(shift => `shift_${shift}:=true`)
        .join(' || ');
      filterParts.push(`(${shiftConditions})`);
    }
    
    // Geo filter (coordinate-based radius)
    if (args.geoFilter) {
      filterParts.push(`location:(${lat}, ${lng}, ${radiusKm} km)`);
    }
    
    return client.collections('jobs').documents().search({
      q: args.query || '*',
      query_by: 'title,company,description',
      filter_by: filterParts.join(' && '),
      sort_by: args.geoFilter ? `location(${lat}, ${lng}):asc` : 'posted_at:desc',
    });
  }
})
```

**Filter Whitelist**:
```typescript
const ALLOWED_FILTERS = new Set([
  'source', 'city', 'state', 'second_chance', 'second_chance_tier',
  'bus_accessible', 'rail_accessible', 'shift_morning', 'shift_afternoon',
  'shift_evening', 'shift_overnight', 'shift_flexible', 'is_urgent', 'is_easy_apply',
])
```

---

#### `convex/lib/geoFilter.ts` (100 lines)
**Purpose**: Precise isochrone polygon filtering using Turf.js.

```typescript
export function filterByIsochrone<T extends JobWithLocation>(
  jobs: T[],
  isochrones: IsochroneData,
  maxMinutes: 10 | 30 | 60,
): T[] {
  // Select polygon based on commute time
  const polygon = maxMinutes === 10 ? isochrones.tenMinute
    : maxMinutes === 30 ? isochrones.thirtyMinute
    : isochrones.sixtyMinute;
  
  return jobs.filter(job => {
    if (!job.location) return false;
    
    const [lat, lng] = job.location;
    // IMPORTANT: Turf uses [lng, lat], Typesense uses [lat, lng]
    const jobPoint = point([lng, lat]);
    
    return polygon.features.some(feature => 
      booleanPointInPolygon(jobPoint, feature)
    );
  });
}
```

**Key Coordinate Order Note**: 
- Typesense stores `[lat, lng]` 
- Turf.js/GeoJSON uses `[lng, lat]`
- Conversion happens in `filterByIsochrone`

---

### 3. User Data Models

#### `convex/schema.ts` (relevant excerpts)

**`jobSearches` Table**:
```typescript
jobSearches: defineTable({
  workosUserId: v.string(),
  threadId: v.string(),
  status: v.union(v.literal('active'), v.literal('completed'), v.literal('cancelled')),
  initialPrompt: v.string(),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index('by_workos_user_id', ['workosUserId'])
  .index('by_workos_user_id_status', ['workosUserId', 'status'])
  .index('by_thread_id', ['threadId'])
```

**`jobPreferences` Table**:
```typescript
jobPreferences: defineTable({
  workosUserId: v.string(),
  maxCommuteMinutes: v.optional(v.union(v.literal(10), v.literal(30), v.literal(60))),
  requirePublicTransit: v.optional(v.boolean()),
  preferSecondChance: v.optional(v.boolean()),
  requireSecondChance: v.optional(v.boolean()),
  shiftMorning: v.optional(v.boolean()),
  // ... other shifts
  requireBusAccessible: v.optional(v.boolean()),
  requireRailAccessible: v.optional(v.boolean()),
  // ...
})
```

**`profiles` Table** (isochrones stored here):
```typescript
profiles: defineTable({
  // ...
  homeLat: v.optional(v.number()),
  homeLon: v.optional(v.number()),
  isochrones: v.optional(v.object({
    computedAt: v.number(),
    originLat: v.number(),
    originLon: v.number(),
    tenMinute: v.any(),     // GeoJSON FeatureCollection
    thirtyMinute: v.any(),
    sixtyMinute: v.any(),
  })),
})
```

**`scrapedJobs` Table** (main job data):
```typescript
scrapedJobs: defineTable({
  // Core
  title: v.string(),
  company: v.string(),
  description: v.optional(v.string()),
  url: v.string(),
  
  // Location
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  lat: v.optional(v.float64()),
  lng: v.optional(v.float64()),
  
  // Second-chance scoring
  secondChance: v.optional(v.boolean()),
  secondChanceScore: v.optional(v.number()),
  secondChanceTier: v.optional(v.union(...)),  // 'high'|'medium'|'low'|'unlikely'|'unknown'
  
  // Shifts
  shiftMorning: v.optional(v.boolean()),
  shiftAfternoon: v.optional(v.boolean()),
  // ...
  
  // Transit accessibility
  busAccessible: v.optional(v.boolean()),
  railAccessible: v.optional(v.boolean()),
  
  // Other enrichments
  isUrgent: v.optional(v.boolean()),
  isEasyApply: v.optional(v.boolean()),
})
```

---

### 4. Frontend Components

#### `src/components/chat/JobMatcherChat.tsx` (184 lines)
**Purpose**: Main chat interface with welcome screen and active thread view.

**State Management**:
```typescript
const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
const [lastSearchPrefs, setLastSearchPrefs] = useState<JobPreferences | null>(null)

// Check for existing active search
const { data: activeSearch } = useQuery(
  convexQuery(api.jobMatcher.queries.getActiveSearch, {})
)

// Detect filter changes since last search
const filtersChanged = useMemo(() => {
  return JSON.stringify(lastSearchPrefs) !== JSON.stringify(currentPrefs)
}, [lastSearchPrefs, currentPrefs])
```

**Two UI States**:
1. **No thread**: Welcome screen with textarea + "Search Now" button
2. **Active thread**: Chat interface with tool UI components

---

#### `src/components/chat/JobMatcherRuntimeProvider.tsx` (134 lines)
**Purpose**: Bridges Convex Agent to assistant-ui runtime.

```typescript
export function JobMatcherRuntimeProvider({ threadId, children, onThreadCreated }) {
  // Subscribe to thread messages
  const { results: messages, status } = useUIMessages(
    api.jobMatcher.messages.listThreadMessages,
    threadId ? { threadId } : 'skip',
    { initialNumItems: 50, stream: true },
  )
  
  // Convert Convex messages to assistant-ui format
  const convertedMessages = useMemo(() => 
    messages?.map(msg => convertConvexMessage(msg)), [messages]
  )
  
  // Handle tool results (e.g., location submission)
  const handleAddToolResult = useCallback(async (options) => {
    if (isLocationResult) {
      await submitToolResultAction({
        toolCallId, toolName: 'collectLocation', result, threadId
      })
    }
  }, [threadId])
  
  // Create runtime
  const runtime = useExternalStoreRuntime({
    messages: convertedMessages,
    isRunning: messages?.some(isMessageStreaming),
    onNew: handleNewMessage,
    onAddToolResult: handleAddToolResult,
  })
  
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
```

---

#### `src/components/chat/tools/index.tsx` (624 lines)
**Purpose**: Custom UI renderers for each agent tool.

**Tool UI Pattern**:
```typescript
export const SearchJobsToolUI = makeAssistantToolUI<SearchJobsArgs, SearchResult>({
  toolName: 'searchJobs',
  render: ({ args, result, status }) => {
    if (status.type === 'running') {
      return <ToolCard status="running" title={`Searching: "${args.query}"`} />
    }
    
    // No results
    if (result.jobs.length === 0) {
      return <Card>No jobs found for "{args.query}"</Card>
    }
    
    // Results with carousel
    return (
      <Card>
        <CardHeader>Found {result.jobs.length} jobs</CardHeader>
        <SearchDetailsSection context={result.searchContext} />
        <Carousel>
          {result.jobs.map(job => <JobResultCard job={job} />)}
        </Carousel>
      </Card>
    )
  }
})
```

**`CollectLocationToolUI`** (multi-step wizard):
- Shows `LocationSetupCard` for interactive input
- Handles states: location → transport → commute → waiting → complete/skipped
- Triggers isochrone computation via `profiles.setHomeLocation`
- Polls for isochrone readiness with timeout handling

---

#### `src/components/chat/tools/LocationSetupCard.tsx` (555 lines)
**Purpose**: Multi-step location wizard UI.

**State Machine**:
```
location → transport → commute → waiting → complete
    ↓                               ↓
  skipped              (timeout → proceed without transit)
```

**Key Flows**:
1. **Browser geolocation**: `navigator.geolocation.getCurrentPosition()`
2. **Manual entry**: Geocode via Nominatim API
3. **Transport selection**: car / transit / flexible
4. **Commute time** (transit only): 10 / 30 / 60 minutes
5. **Isochrone wait**: Poll profile for `isochrones` field, 90s timeout

---

#### `src/lib/convexAgentBridge.ts` (216 lines)
**Purpose**: Convert Convex Agent message format to assistant-ui format.

```typescript
export function convertConvexMessage(msg: ConvexUIMessage, idx: number): ThreadMessageLike {
  const content = convertParts(msg.parts)
  
  return {
    id: msg.key,
    role: msg.role,
    createdAt: new Date(msg._creationTime),
    content,
    status: msg.role === 'assistant' ? mapStatus(msg.status) : undefined,
  }
}

function convertParts(parts): ContentPart[] {
  // Skip internal parts: 'step-start', 'step-finish', 'source', 'file'
  // Convert 'text' → { type: 'text', text }
  // Convert 'tool-*' → { type: 'tool-call', toolCallId, toolName, args, result }
}
```

---

### 5. Isochrone System

#### `convex/isochrones.ts` (31 lines)
**Purpose**: Trigger async isochrone computation.

```typescript
export const triggerCompute = internalAction({
  args: { profileId: v.id('profiles'), lat: v.number(), lon: v.number() },
  handler: async (_ctx, { profileId, lat, lon }) => {
    await inngest.send({
      name: 'isochrones/compute',
      data: { profileId: profileId.toString(), lat, lon },
    })
  },
})
```

#### `convex/inngest/computeIsochrones.ts` (87 lines)
**Purpose**: Async workflow for Geoapify isochrone computation.

```typescript
export const computeIsochrones = inngest.createFunction({
  id: 'compute-isochrones',
  concurrency: { limit: 5 },  // Geoapify rate limit
  retries: 10,
}, { event: 'isochrones/compute' }, async ({ event, step, convex }) => {
  // Step 1: Initial fetch (may return async job ID)
  const initial = await step.run('fetch-isochrones', () => fetchIsochrones(lat, lon))
  
  // Step 2: Poll if async
  let data = initial.done ? initial.data : await step.run('poll-isochrones', () => 
    pollIsochrones(initial.jobId)
  )
  
  // Step 3: Save to Convex
  const isochrones = parseIsochrones(data)
  await step.run('save-isochrones', () => 
    convex.runMutation(internal.profiles.saveIsochrones, { profileId, isochrones })
  )
})
```

---

### 6. Configuration

#### `convex/convex.config.ts` (8 lines)
```typescript
import agent from '@convex-dev/agent/convex.config'
import { defineApp } from 'convex/server'

const app = defineApp()
app.use(agent)

export default app
```

---

## Data Flow Diagrams

### User Initiates Search

```
User clicks "Search Now"
         │
         ▼
JobMatcherChat.handleForceSearch()
         │
         ▼
api.jobMatcher.actions.startSearch({ prompt })
         │
         ├── Create thread: jobMatcherAgent.createThread(ctx, { userId })
         │
         ├── Record search: createSearchRecord({ threadId, initialPrompt })
         │
         └── Stream response: thread.streamText({ prompt }, { saveStreamDeltas: true })
                    │
                    ▼
              Agent Execution Loop (maxSteps: 15)
                    │
         ┌─────────┴─────────┐
         ▼                   ▼
    Tool: showPlan     Tool: getMyResume
         │                   │
         ▼                   ▼
    Tool: getMyJobPreferences
         │
         ▼
    [Decision Tree: Missing info?]
         │
    ┌────┴────┐
    ▼         ▼
  Yes        No
    │         │
    ▼         ▼
collectLocation  searchJobs (x2-3)
    │              │
    ▼              ▼
[Wait for UI]  [Typesense + Isochrone filter]
         │
         ▼
    Return results to UI via streaming
```

### Location Collection Flow

```
Agent calls: collectLocation({ reason: "..." })
         │
         ▼
UI renders: LocationSetupCard
         │
         ├── User selects: "Use my location" OR "Enter manually"
         │           │
         │           ▼
         │     Browser geolocation OR Nominatim geocode
         │           │
         │           ▼
         │     User selects transport mode
         │           │
         │           ├── car/flexible → Complete immediately
         │           │
         │           └── transit → Select commute time (10/30/60)
         │                   │
         │                   ▼
         │             profiles.setHomeLocation({ lat, lon })
         │                   │
         │                   ├── Clear existing isochrones
         │                   │
         │                   └── Trigger: isochrones.triggerCompute
         │                             │
         │                             ▼
         │                       Inngest: computeIsochrones
         │                             │
         │                             ▼
         │                       Geoapify API (10/30/60 min zones)
         │                             │
         │                             ▼
         │                       profiles.saveIsochrones
         │
         ▼
UI polls profile.isochrones (2s interval)
         │
         ├── Ready → Complete, call addResult()
         │
         └── Timeout (90s) → Option to proceed without transit filter
```

---

## Security Model

### Principle: **Implicit User Context**

The LLM never sees:
- Raw user IDs (only uses `ctx.userId` internally)
- Isochrone polygon coordinates
- Internal database IDs
- Timestamps
- Other users' data

All tools use `ctx.userId` from the authenticated context:
```typescript
const getMyResume = createTool({
  handler: async (ctx) => {
    if (!ctx.userId) throw new Error('Not authenticated')
    // ctx.userId comes from auth, not tool args
    const resume = await ctx.runQuery(internal.resumes.getByWorkosUserIdInternal, {
      workosUserId: ctx.userId,  // ← Secure: derived from auth
    })
  }
})
```

### Thread Ownership Verification

```typescript
export const listThreadMessages = query({
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    
    // Verify ownership via jobSearches table
    const search = await ctx.db.query('jobSearches')
      .withIndex('by_thread_id', q => q.eq('threadId', args.threadId))
      .unique()
    
    if (!search || search.workosUserId !== identity.subject) {
      throw new Error('Thread not found or not authorized')
    }
  }
})
```

---

## Environment Variables Required

```bash
# Convex (set in dashboard)
GROQ_API_KEY          # For LLM inference
TYPESENSE_URL         # Typesense cluster URL
TYPESENSE_API_KEY     # Typesense admin API key
GEOAPIFY_API_KEY      # For isochrone computation

# Frontend (set in .env.local)
WORKOS_CLIENT_ID      # WorkOS authentication
WORKOS_API_KEY        # WorkOS authentication
```

---

## Key Design Decisions & Trade-offs

### 1. **Groq over OpenAI for inference**
- **Why**: Speed is critical for multi-step tool workflows
- **Trade-off**: Smaller model selection, potential quality difference
- **Model**: `moonshotai/kimi-k2-instruct-0905`

### 2. **Two-phase geo-filtering**
- **Phase 1**: Wide radius (80km) in Typesense for pre-filtering
- **Phase 2**: Precise isochrone polygon check with Turf.js
- **Why**: Typesense doesn't support polygon queries; this balances performance with precision

### 3. **Async isochrone computation**
- **Why**: Geoapify can take 10-60+ seconds for complex polygons
- **Solution**: Inngest workflow with polling + timeout handling
- **UX**: Show "Computing transit zones..." with option to proceed without

### 4. **Shift preferences use OR logic**
- **If user prefers morning OR afternoon**: Show jobs with EITHER shift
- **Implemented in Typesense**: `(shift_morning:=true || shift_afternoon:=true)`

### 5. **One active search per user**
- **Why**: Simplifies state management, prevents orphaned threads
- **Implementation**: `createSearchRecord` marks existing active searches as completed

### 6. **Tool results truncation**
- **Job descriptions**: Truncated to 100 chars in tool results
- **Why**: Stay within Groq's 10K TPM limit
- **Full data**: Available in UI via `searchContext`

---

## Complete File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `convex/jobMatcher/agent.ts` | 117 | Agent definition, system prompt, model config |
| `convex/jobMatcher/tools.ts` | 642 | All 7 tools with handlers |
| `convex/jobMatcher/actions.ts` | 206 | Entry point actions (startSearch, etc.) |
| `convex/jobMatcher/queries.ts` | 144 | Database queries for search management |
| `convex/jobMatcher/messages.ts` | 47 | Thread message listing with streaming |
| `convex/jobMatcher/schema.ts` | 24 | Zod schemas for job results |
| `convex/jobMatcher/index.ts` | 8 | Module exports |
| `convex/scrapedJobsSearch.ts` | 268 | Typesense search integration |
| `convex/lib/geoFilter.ts` | 100 | Isochrone polygon filtering |
| `convex/jobPreferences.ts` | 126 | User preference CRUD |
| `convex/profiles.ts` | 282 | Profile + isochrone storage |
| `convex/resumes.ts` | 369 | Resume data access + AI polishing |
| `convex/isochrones.ts` | 31 | Isochrone computation trigger |
| `convex/inngest/computeIsochrones.ts` | 87 | Async isochrone workflow |
| `convex/schema.ts` | 409 | Full database schema |
| `convex/convex.config.ts` | 8 | Convex app configuration |
| `src/components/chat/JobMatcherChat.tsx` | 184 | Main chat interface |
| `src/components/chat/JobMatcherRuntimeProvider.tsx` | 134 | Convex → assistant-ui bridge |
| `src/components/chat/tools/index.tsx` | 624 | Tool UI components |
| `src/components/chat/tools/LocationSetupCard.tsx` | 555 | Multi-step location wizard |
| `src/components/JobMatcher.tsx` | 258 | Legacy job matcher component |
| `src/components/JobMatchResults.tsx` | 486 | Job results display |
| `src/lib/convexAgentBridge.ts` | 216 | Message format conversion |
| `src/lib/geo.ts` | 114 | Geocoding utilities |

---

## Potential Improvements for Next Iteration

### Architecture
1. **Vector search**: Add embedding-based semantic search for better matching
2. **Multi-model routing**: Use faster model for simple queries, better model for complex
3. **Cached search results**: TTL-based caching for repeated searches
4. **Streaming tool results**: Show jobs as they're found, not all at once

### Features
1. **Saved searches**: Allow users to save and re-run searches
2. **Job alerts**: Notify when new jobs match saved criteria
3. **Application tracking**: Track which jobs user applied to
4. **Interview scheduling**: Integrate with calendar

### UX
1. **Progressive disclosure**: Start with simple search, reveal advanced filters
2. **Map view**: Show jobs on map with isochrone overlay
3. **Comparison view**: Side-by-side job comparison
4. **Mobile-first**: Optimize touch interactions

### Performance
1. **Prefetch user context**: Load resume/prefs before first tool call
2. **Batch tool calls**: Combine `getMyResume` + `getMyJobPreferences`
3. **Edge caching**: Cache Typesense results at CDN level

---

## Appendix: Full System Prompt

```
You are a job matching assistant for Recovery Jobs, helping people find employment. Many users benefit from second-chance/fair-chance employers.

## Available Tools (ONLY use these exact names)
- showPlan - Display your action plan with progress tracking
- getMyResume - Get the user's resume
- getMyJobPreferences - Get the user's job search preferences  
- collectLocation - Show UI to collect location + transport preferences (ONLY if hasHomeLocation is false)
- searchJobs - Search for jobs matching keywords and filters
- askQuestion - Ask the user a clarifying question with options
- saveUserPreference - Save transport/commute preferences to profile

IMPORTANT: Only call tools by these exact names. Do NOT invent or guess tool names.

## Workflow

### Step 1: Show Your Plan
ALWAYS start by calling showPlan to display what you're doing:
{
  "id": "job-search-plan",
  "title": "Finding jobs for you",
  "todos": [
    {"id": "load-profile", "label": "Loading your profile", "status": "in_progress"},
    {"id": "check-info", "label": "Checking what info we need", "status": "pending"},
    {"id": "setup-search", "label": "Setting up search", "status": "pending"},
    {"id": "find-jobs", "label": "Finding matching jobs", "status": "pending"}
  ]
}

### Step 2: Load Profile Data
Call getMyResume and getMyJobPreferences to understand the user.

### Step 3: Collect Missing Info (Decision Tree)

After loading profile, check what's missing and handle ONE item at a time:

**A) No home location (hasHomeLocation is false)**
→ Call collectLocation with reason: "To find jobs you can actually get to"
→ The UI handles location + transport + commute in one flow
→ Wait for the result before proceeding

**B) Has location but needs clarification on job type (no resume AND user's message is vague)**
→ Use askQuestion to ask what kind of work they want

**C) Everything else**
→ Proceed to search

### Step 4: Search
Run 2-3 searches with relevant keywords from resume or stated interests.

### Step 5: Summarize
Be specific about WHY each job matches their profile.

## Q&A Mode - Question Options

**Job type** (if no resume AND vague request):
- question: "What kind of work are you looking for?"
- options: [
    {id: "warehouse", label: "Warehouse & Logistics"},
    {id: "food", label: "Food Service & Restaurant"},
    {id: "retail", label: "Retail & Customer Service"},
    {id: "construction", label: "Construction & Labor"},
    {id: "delivery", label: "Delivery & Driving"},
    {id: "healthcare", label: "Healthcare & Caregiving"}
  ]

**Shifts** (if no shift preferences):
- question: "What shifts work best for you?"
- options: [
    {id: "morning", label: "Morning (6am-2pm)"},
    {id: "afternoon", label: "Afternoon (2pm-10pm)"},
    {id: "evening", label: "Evening/Night"},
    {id: "flexible", label: "Flexible/Any"}
  ]

## When to Skip Questions

- User says "just search", "skip", or "force search"
- User provides specific job type (e.g., "find me warehouse jobs")
- Resume exists with clear skills/experience
- This is a follow-up message (not first interaction)
- You've already asked a question in this conversation
- User skips location collection (they want to see all locations)

## Important Rules

- ALWAYS start with showPlan on first message
- Ask at MOST one question per response
- collectLocation handles multiple steps internally - just wait for its result
- If user skips location, search proceeds without geo filtering
- After user answers, proceed - don't ask more unless critical
- The Force Search button bypasses all questions

## Search Guidelines

- searchJobs AUTOMATICALLY filters by location if user has transit zones
- If no resume AND no stated interest: search with query "*"
- Quality over quantity - 5 great matches beats 15 mediocre ones
- Run multiple searches with different keywords for diversity
```

---

*This report contains all code paths, data flows, and architectural decisions needed to understand, modify, or redesign the job matching AI agent system.*
