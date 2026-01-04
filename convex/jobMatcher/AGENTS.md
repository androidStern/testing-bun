# JOB MATCHER AI AGENT

## OVERVIEW

AI-powered job matching using @convex-dev/agent. Conversational interface for job seekers with tools for searching, filtering, and planning.

## STRUCTURE

```
jobMatcher/
├── agent.ts      # Agent definition and configuration
├── tools.ts      # Tool definitions (search, plan, preferences)
├── context.ts    # User context builder
├── actions.ts    # Convex actions for agent operations
├── messages.ts   # Message handling
├── queries.ts    # Read operations
├── plan.ts       # Job search plan management
├── reminders.ts  # Contextual reminder system
├── schema.ts     # Types for agent domain
└── index.ts      # Barrel exports
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add new tool | `tools.ts` |
| Modify agent behavior | `agent.ts` |
| Change user context | `context.ts` |
| Add reminder | `reminders.ts` -> `REMINDERS` constant |
| Plan management | `plan.ts` |

## CONVENTIONS

- Tool descriptions loaded from `.txt` files (see `TODOWRITE_DESCRIPTION`)
- User context includes resume, preferences, home location
- Plan stored in `jobSearches` table with todo-style status tracking
- All tools return typed results (see `schema.ts`)

## UNIQUE PATTERNS

### Reminders System

`getApplicableReminders()` returns contextual prompts based on user state:
- Missing resume data
- No home location set
- Incomplete preferences

### Job Search Plan

Persistent todo list for multi-step job search workflows stored in `jobSearches.plan`:

```typescript
plan: v.array(v.object({
  id: v.string(),
  content: v.string(),
  status: v.union(v.literal('pending'), v.literal('in_progress'), v.literal('completed'), v.literal('cancelled')),
  priority: v.union(v.literal('high'), v.literal('medium'), v.literal('low')),
}))
```

### Tool Integration

Tools interact with Typesense for job search and Convex for user data:

```typescript
// tools.ts pattern
{
  name: 'searchJobs',
  description: '...',
  args: { ... },
  handler: async (ctx, args) => {
    // 1. Build Typesense query from args
    // 2. Execute search via scrapedJobsSearch.search
    // 3. Return sanitized results
  }
}
```
