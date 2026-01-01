# Fix Job Matcher - Use Groq SDK Directly

## Solution
Use `@ai-sdk/groq` directly with `moonshotai/kimi-k2-instruct-0905` for everything. Bypass OpenRouter entirely.

## Changes

### 1. Install @ai-sdk/groq
```bash
bun add @ai-sdk/groq
```

### 2. Update `convex/jobMatcher/agent.ts`
- Remove OpenRouter
- Use Groq SDK directly
- Single agent with Kimi K2 for both tools and structured output

```typescript
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export const jobMatcherAgent = new Agent(components.agent, {
  languageModel: groq('moonshotai/kimi-k2-instruct-0905'),
  // ... rest of config
})

// Remove formatterAgent - use single agent for everything
```

### 3. Update `convex/jobMatcher/actions.ts`
- Remove two-phase approach
- Use single `streamText` + `generateObject` on same agent

## Files
- `package.json` - add @ai-sdk/groq
- `convex/jobMatcher/agent.ts` - use Groq SDK, single agent
- `convex/jobMatcher/actions.ts` - simplify to single agent
