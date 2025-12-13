# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A job board/referral platform built with Convex + TanStack Start + WorkOS AuthKit. Employers submit jobs via SMS or web form, jobs are parsed by AI and posted to Circle.so. Job seekers create profiles, build resumes, and apply to positions.

Much of this app provides auxiliary functionality for our Circle community (job posts, SSO). We delegate auth to WorkOS AuthKit.

## Commands

```bash
# Development (runs both frontend and backend in parallel)
bun run dev

# Individual services
bun run dev:frontend   # Vite dev server on localhost:3000
bun run dev:backend    # Convex dev server

# Build and start
bun run build
bun run start

# Code quality
bun run lint           # TypeScript check + ESLint
bun run format         # Prettier
```

## Deployment

- **Frontend**: Deployed to Hetzner VPS via Coolify, built and served with `bun server.ts`
- **Backend**: Hosted on Convex Cloud

## Architecture

### Backend (Convex + Inngest)

**Core Domain Tables:**
- `profiles` - User profiles linked to WorkOS user IDs, includes referral codes
- `senders` - Phone/email records with approval status (pending/approved/blocked)
- `jobSubmissions` - Unified job posts from SMS or form, processed through AI parsing workflow
- `employers` - Vetted job poster accounts with WorkOS integration
- `applications` - Seeker applications to job postings
- `resumes` - Structured resume data per user

**OAuth Tables** (for Circle.so SSO):
- `oauthAuthorizationCodes`, `oauthAccessTokens`, `oauthRefreshTokens`, `oauthClients`

**Workflow Processing:**
- Inngest handles async workflows (job parsing, application processing)
- HTTP endpoints in `convex/http.ts` bridge to Node.js actions for Inngest
- Twilio webhook at `/webhooks/twilio-sms` processes inbound SMS

**Key Patterns:**
- Use `internal.*` for private functions, `api.*` for public
- HTTP actions bridge to Node.js actions when `node:async_hooks` is needed
- Slack integration for admin approval workflows

### Frontend (TanStack Start)

**Authentication Flow:**
- WorkOS AuthKit with redirect-based auth
- SSR token extraction workaround in `src/router.tsx` for hydration
- Protected routes use `_authenticated` layout

**Key Routes:**
- `/` - Landing page
- `/_authenticated/*` - Protected user routes (resumes, invite)
- `/_authenticated/_admin/*` - Admin dashboard
- `/oauth/*` - OAuth2 provider endpoints for Circle.so
- `/apply/$jobId` - Public job application page
- `/employer/*` - Employer portal

**Route Generation:**
- Do NOT manually generate route files with TanStack Router CLI
- The TanStack Start dev server auto-compiles routes on change
- If routes seem stale, verify the dev server is running

**Integrations:**
- Circle.so - Community platform (job posts, SSO)
- Twilio - SMS handling
- OpenAI/Groq - AI job parsing

## Convex Conventions

Follow the rules in `.cursor/rules/convex_rules.mdc`:
- Always include `args` and `returns` validators on all functions
- Use `v.null()` for functions that don't return a value
- Use `withIndex()` instead of `filter()` for queries
- Internal functions use `internalQuery`/`internalMutation`/`internalAction`
- Reference functions via `api.module.fn` or `internal.module.fn`

### Schema Management with Zod

Avoid schema duplication between Convex tables and forms. Use `convex-helpers` to define schemas once with Zod:

```typescript
import { zodToConvex, zodOutputToConvex, zid } from "convex-helpers/server/zod";

// Define schema once with Zod
const profileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  userId: zid("users"), // Type-safe Convex ID
});

// For table definitions (validates output after Zod parsing):
defineTable(zodOutputToConvex(profileSchema))

// For function args (validates input before Zod parsing):
args: zodToConvex(profileSchema)
```

**Key functions:**
- `zodToConvex` - Converts Zod schema to Convex validator (use for args, validates input)
- `zodOutputToConvex` - For table definitions (validates Zod's output)
- `zid("tableName")` - Type-safe ID validator for Convex tables

**Form schemas:** Use Zod's `.partial()`, `.pick()`, `.omit()`, `.extend()` to derive form schemas from base schemas rather than duplicating definitions.

## Forms (TanStack Form + Shadcn)

Use TanStack Form with Zod validation—never raw `useState` with manual handlers.

**Pattern:**
```typescript
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  age: z.number().gte(13, "Must be 13+"),
});

const form = useForm({
  defaultValues: { email: "", age: 0 },
  validators: { onChange: schema },
  onSubmit: async ({ value }) => { /* handle submit */ },
});
```

**Shadcn Integration:**
- Use shadcn form components (`Input`, `Select`, `Checkbox`, etc.) inside `<form.Field>`
- See [shadcn TanStack Form guide](https://ui.shadcn.com/docs/forms/tanstack-form) for component patterns
- Field errors accessible via `field.state.meta.errors`
- Async validation supported with `onChangeAsync` and `onChangeAsyncDebounceMs`

## Styling

- **Use Tailwind exclusively**—no inline styles or style objects
- **Use design tokens**, not magic numbers: `text-sm` not `text-[14px]`, `rounded-md` not `rounded-[6px]`
- **Use shadcn components** before rolling custom ones—especially for forms, dialogs, buttons
- **Keep styles themeable**: use semantic tokens (`bg-primary`, `text-muted-foreground`) so theme changes propagate globally

## TypeScript

- **No `any`**—use `unknown` and narrow with type guards
- **No type casting** (`as Type`)—fix the actual types
- **Catch errors only at boundaries** (UI handlers, API routes) where user feedback is needed
- Let TypeScript infer types when possible; explicit annotations for public APIs

## Error Handling

**Let errors propagate.** Handle them at the edges, if at all.

- **Inngest workflows:** Throw, don't swallow. Inngest retries automatically—catching masks real failures
- **Unrecoverable errors:** Missing env vars, config errors, system defects → crash immediately. Don't hide these behind try/catch
- **Recoverable errors:** Network hiccups, validation failures → catch only when you can meaningfully retry or show user feedback
- **UI:** Surface human-friendly error messages. Never fail silently—users should know when something went wrong

```typescript
// BAD: Swallowing errors
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("Missing API_KEY");
  return; // Silent failure, problem discovered later
}

// GOOD: Crash fast
const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error("API_KEY env var is required");
```

## Design Documentation

Design documents live in `/docs`. When making architectural decisions:
1. Review existing docs for relevance
2. Update outdated sections to reflect current state
3. Add new content to existing docs where logical
4. Only create new docs when the topic doesn't fit existing files

## Convex MCP Server

You have access to a Convex MCP server. **Only connect to development deployments**—never production.

## Path Aliases

```typescript
@/* -> ./src/*
~/* -> ./src/*
```
