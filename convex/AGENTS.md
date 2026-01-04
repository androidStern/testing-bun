# CONVEX BACKEND

## OVERVIEW

Convex serverless backend with Inngest workflows. 12 domain tables + 4 OAuth tables.

## STRUCTURE

```
convex/
├── schema.ts              # All table definitions
├── functions.ts           # Custom auth wrappers (adminQuery, etc.)
├── http.ts                # HTTP endpoints (Twilio webhook, scrape-jobs API)
├── inngestNode.ts         # Node.js actions (Inngest, email, Slack)
├── jobMatcher/            # AI agent subsystem (see nested AGENTS.md)
├── inngest/               # Workflow definitions
│   ├── client.ts          # Inngest client + event types
│   ├── processJob.ts      # Job submission -> parsing -> approval
│   └── processApplication.ts
└── lib/                   # Utilities
    ├── env.ts             # Environment variable validation
    ├── slack.ts           # Slack notifications
    ├── circle.ts          # Circle.so API
    └── twilio.ts          # Twilio signature verification
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add table | `schema.ts` + create new module |
| Add index | `schema.ts` in `.index()` chains |
| Twilio webhook | `http.ts` -> `/webhooks/twilio-sms` |
| Scrape API | `http.ts` -> `/api/scraped-jobs/*` |
| Inngest workflow | `inngest/*.ts` + register in `inngestNode.ts` |
| Admin function | Use wrappers from `functions.ts` |

## FUNCTION PATTERNS

### Custom function wrappers (`functions.ts`):

| Wrapper | Auth Check | Use For |
|---------|------------|---------|
| `query`/`mutation` | None | Public API |
| `authQuery`/`authMutation` | Requires login | User-specific data |
| `adminQuery`/`adminMutation`/`adminAction` | ADMIN_EMAILS check | Admin dashboard |
| `internalQuery`/`internalMutation`/`internalAction` | None (not exposed) | Internal use only |

### Zod mutations (`zCustomMutation`):

```typescript
import { zCustomMutation } from 'convex-helpers/server/zod4'
import { NoOp } from 'convex-helpers/server/customFunctions'

const zodMutation = zCustomMutation(mutation, NoOp)

export const upsert = zodMutation({
  args: resumeMutationSchema, // Zod schema directly
  handler: async (ctx, args) => { ... }
})
```

## NODE.JS RUNTIME DECISION TREE

```
Does code use node:async_hooks, nodemailer, or node:* modules?
  -> YES: Put in *Node.ts file with "use node" directive
  -> NO: Put in regular *.ts file

Is it called from HTTP endpoint?
  -> YES: httpAction (V8) -> ctx.runAction(internal.xxxNode.yyy)
  -> NO: Direct call
```

**Current Node.js files:**
- `inngestNode.ts` - Inngest events, email, Slack updates
- `inngest/handler.ts` - Inngest handler factory

## API KEY PATTERN

External services (scrape-pipeline) authenticate via shared secret:

```typescript
// convex/http.ts
function verifyPipelineSecret(request: Request): boolean {
  return request.headers.get('X-Pipeline-Secret') === env.SCRAPE_PIPELINE_SECRET
}

http.route({
  path: '/api/scraped-jobs/insert',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!verifyPipelineSecret(request)) {
      return new Response('Unauthorized', { status: 401 })
    }
    // ... process request
  }),
})
```

## CONVENTIONS

- **Validators**: Every function needs `args` + `returns` validators
- **Indexing**: Use `withIndex()` never `filter()` for queries
- **Internal vs Public**: `internalQuery`/`internalMutation` for private
- **HTTP validation**: All HTTP endpoints use Zod schemas defined at top of `http.ts`
- **Inngest bridge**: HTTP actions -> Node actions via `internal.inngestNode.*`

## ANTI-PATTERNS

- **DEPRECATED**: `scrapedJobs.noBackgroundCheck` -> use `secondChanceTier` instead
- **Never filter()**: Always define indexes in schema, use `withIndex()`
- **No v.any()**: Define proper validators for all returns
