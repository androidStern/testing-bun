# Autonomous Job Finding Agent: OpenCode-Inspired Architecture

## Overview

This plan transforms the job matcher from a wizard-like flow into an autonomous agent that plans, adapts, and pivots creatively - borrowing proven patterns from OpenCode.

**Core Principles (borrowed from OpenCode):**
1. **Confident expert identity** - "The most helpful job-finding agent"
2. **Professional honesty** - Tell hard truths when needed
3. **Task management as core behavior** - todoWrite is non-negotiable
4. **Investigate before acting** - Load profile first, THEN plan
5. **Dynamic task discovery** - Agent determines tasks based on situation
6. **Explicit tool policies** - Clear guidance on when/how to use each tool
7. **Examples with reasoning** - Show the agent HOW to think

---

## Part 0: Philosophy - Abstract Patterns from OpenCode

### Pattern 1: Confident Expert Identity
**OpenCode:** "You are OpenCode, the best coding agent on the planet."
**Our adaptation:** Strong identity as an expert career assistant, not just a search tool. The agent should feel like talking to a knowledgeable career counselor who specializes in second-chance employment.

### Pattern 2: Professional Objectivity
**OpenCode:** "Prioritize technical accuracy and truthfulness over validating the user's beliefs... disagree when necessary."
**Our adaptation:** Honest career advice, even when it means telling the user their resume needs work, their salary expectations are unrealistic, or they're targeting jobs they're unlikely to get.

### Pattern 3: Task Management as Core Behavior
**OpenCode:** "Use these tools VERY frequently... If you do not use this tool when planning, you may forget to do important tasks - and that is unacceptable."
**Our adaptation:** Same emphasis - todoWrite is non-negotiable for any multi-step interaction. The word "unacceptable" is important - it creates a strong norm.

### Pattern 4: Investigate Before Acting
**OpenCode's examples:** Search/explore first, THEN create todo list based on findings.
**Our adaptation:** Load profile first, THEN create plan based on what's found. The plan should reflect the user's actual situation, not a generic flow.

### Pattern 5: Dynamic Task Discovery
**OpenCode:** Tasks are discovered by the agent based on context, not prescribed by the prompt.
**Our adaptation:** Agent determines what tasks are needed based on user's profile, stated needs, and discovered gaps. A user with a complete profile gets a different plan than one missing their location.

### Pattern 6: Tool Usage Policy
**OpenCode:** Has explicit policies like "When doing X, prefer tool Y..."
**Our adaptation:** Similar explicit policies for our tools - when to use searchJobs vs askQuestion, when to call tools in parallel, etc.

### Pattern 7: Examples with Reasoning
**OpenCode's todowrite.txt:** Includes `<reasoning>` blocks explaining WHY the agent made certain decisions.
**Our adaptation:** Same pattern - show the agent how to think about when to use tools, not just what to do.

### Pattern 8: Know When NOT to Use Tools
**OpenCode:** Explicitly lists scenarios where todoWrite should NOT be used.
**Our adaptation:** Same - simple questions don't need a plan. Conversational responses don't need tools.

---

## Part 1: Schema Changes

**File: `convex/schema.ts`**

Add `plan` field to `jobSearches` table:

```typescript
// In jobSearches table definition
jobSearches: defineTable({
  // existing fields...
  completedAt: v.optional(v.number()),
  initialPrompt: v.string(),
  startedAt: v.number(),
  status: v.union(v.literal('active'), v.literal('completed'), v.literal('cancelled')),
  threadId: v.string(),
  workosUserId: v.string(),

  // NEW: Todo list (OpenCode-style)
  plan: v.optional(v.array(v.object({
    id: v.string(),
    content: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('cancelled'),
    ),
    priority: v.union(v.literal('high'), v.literal('medium'), v.literal('low')),
  }))),
})
```

---

## Part 2: Backend - Plan Mutations/Queries

**File: `convex/jobMatcher/plan.ts`** (NEW)

```typescript
import { v } from 'convex/values'
import { internalMutation, internalQuery, query } from '../_generated/server'

export const todoValidator = v.object({
  id: v.string(),
  content: v.string(),
  status: v.union(
    v.literal('pending'),
    v.literal('in_progress'),
    v.literal('completed'),
    v.literal('cancelled'),
  ),
  priority: v.union(v.literal('high'), v.literal('medium'), v.literal('low')),
})

export const updatePlan = internalMutation({
  args: {
    threadId: v.string(),
    todos: v.array(todoValidator),
  },
  handler: async (ctx, args) => {
    const search = await ctx.db
      .query('jobSearches')
      .withIndex('by_thread_id', q => q.eq('threadId', args.threadId))
      .unique()

    if (search) {
      await ctx.db.patch(search._id, { plan: args.todos })
    }
    return null
  },
  returns: v.null(),
})

export const getPlan = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const search = await ctx.db
      .query('jobSearches')
      .withIndex('by_thread_id', q => q.eq('threadId', args.threadId))
      .unique()

    return search?.plan ?? null
  },
  returns: v.union(v.null(), v.array(todoValidator)),
})

export const getPlanInternal = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const search = await ctx.db
      .query('jobSearches')
      .withIndex('by_thread_id', q => q.eq('threadId', args.threadId))
      .unique()

    return search?.plan ?? null
  },
  returns: v.union(v.null(), v.array(todoValidator)),
})
```

---

## Part 3: Backend - TodoWrite Tool

**File: `convex/jobMatcher/todowrite.txt`** (NEW - COMPREHENSIVE)

```text
Use this tool to create and manage a structured task list for your current job search session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.
It also helps the user understand the progress of their request and gives them visibility into what you're doing.

## When to Use This Tool

Use this tool proactively in these scenarios:

1. **Complex job search tasks** - When helping someone find jobs requires multiple steps (profile review, preference gathering, searching, etc.)
2. **User provides multiple requirements** - "I need a warehouse job near Miami that's fair-chance friendly and pays at least $18/hr"
3. **After discovering what needs to be done** - Once you've reviewed the user's profile and know what steps are needed
4. **When the plan changes** - User gives new info, changes requirements, or you discover something that changes the approach
5. **After completing any task** - Mark it complete IMMEDIATELY and add any follow-up tasks discovered
6. **When you start working on something** - Mark it as in_progress so the user knows what you're doing

## When NOT to Use This Tool

Skip using this tool when:
1. Answering a simple question ("What's a fair-chance employer?")
2. The interaction is purely conversational
3. The task is trivial and can be done in one step
4. You're just clarifying something the user said

NOTE: If the user just wants to chat or asks a quick question, just answer directly. Don't create a todo list for everything.

## Examples of When to Use the Todo List

<example>
User: Help me find warehouse jobs
Assistant: I'll help you find warehouse jobs. Let me first check your profile to understand your situation better.
*Calls getMyResume and getMyJobPreferences*
Assistant: I see you have warehouse experience but no location set. Let me create a plan to help you.
*Creates todo list:*
1. Get your location preferences
2. Search warehouse jobs in your area
3. Filter for the best matches
4. Present top opportunities

<reasoning>
The assistant used the todo list because:
1. First, it investigated (loaded profile) to understand the scope
2. Found that location was missing - a multi-step process is needed
3. The todo list tracks the specific steps needed for THIS user's situation
4. Tasks were discovered based on profile, not prescribed in advance
</reasoning>
</example>

<example>
User: I just got out and need work ASAP. I'll take anything.
Assistant: I understand the urgency. Let me check your profile and find opportunities quickly.
*Calls getMyResume and getMyJobPreferences*
Assistant: I see you have forklift certification - that's valuable! Let me create a focused plan.
*Creates todo list:*
1. Search immediate-hire warehouse jobs (leverage forklift cert)
2. Search general labor positions (backup options)
3. Check for fair-chance employers specifically
4. Present jobs with fastest hiring processes first

<reasoning>
The assistant used the todo list because:
1. Urgency requires a focused, efficient approach
2. Discovered an asset (forklift cert) that changes the search strategy
3. Multiple search strategies needed (targeted + backup)
4. Plan reflects the user's specific situation, not a generic flow
</reasoning>
</example>

<example>
User: I want to work in healthcare but I don't have any certifications
Assistant: Healthcare is a great field with lots of growth. Let me see your background.
*Calls getMyResume*
Assistant: I notice you have customer service experience, which transfers well to patient-facing roles. However, I want to be honest - most healthcare jobs require certifications. Let me create a plan that addresses both short-term and long-term options.
*Creates todo list:*
1. Search entry-level healthcare jobs (no cert required)
2. Find patient transport / hospital support roles
3. Research CNA certification programs in your area
4. Present options with career progression paths

*After searching, updates plan:*
1. ✓ Search entry-level healthcare jobs - Found 3 options
2. ✓ Find patient transport roles - Found 5 options  
3. Research CNA programs - IN PROGRESS
4. Present options with career paths

<reasoning>
The assistant used the todo list because:
1. This is a complex situation requiring honest career advice
2. User's goal may not be immediately achievable - need alternatives
3. Multiple angles: immediate jobs AND career development
4. Plan evolves as the assistant discovers options
</reasoning>
</example>

<example>
User: Find jobs that pay at least $25/hour, are within 30 minutes of downtown, and are second-chance friendly
Assistant: That's a specific set of requirements. Let me check your profile and build a search strategy.
*Calls getMyResume and getMyJobPreferences*
*Creates todo list:*
1. Search fair-chance jobs in downtown area
2. Filter for $25+/hr positions
3. Verify commute times for matches
4. If few results, suggest adjustments to criteria
5. Present best matches with salary/commute details

<reasoning>
The assistant used the todo list because:
1. User provided multiple specific criteria
2. Each criterion needs to be addressed
3. Included a contingency (step 4) in case criteria are too restrictive
4. Plan shows user their requirements are being tracked
</reasoning>
</example>

<example>
User: Can you also check if there are any training programs I could do while working?
Assistant: Great thinking - upskilling while working is a smart move.
*Updates existing todo list to add:*
5. Research part-time training programs
6. Find employers with tuition assistance

<reasoning>
The assistant UPDATED the existing plan rather than creating a new one. When the user adds requirements mid-conversation, extend the current plan rather than starting over.
</reasoning>
</example>

## Examples of When NOT to Use the Todo List

<example>
User: What does "fair-chance employer" mean?
Assistant: A fair-chance employer is a company that has committed to giving people with criminal records a fair opportunity at employment. They typically delay background checks until later in the hiring process and evaluate candidates individually rather than having blanket policies against hiring people with records.

<reasoning>
The assistant did not use the todo list because this is a simple informational question. No multi-step task is being performed.
</reasoning>
</example>

<example>
User: Thanks, that helps!
Assistant: You're welcome! Let me know when you're ready to search for jobs, or if you have any other questions.

<reasoning>
The assistant did not use the todo list because this is conversational. The user is just acknowledging information.
</reasoning>
</example>

<example>
User: Can you change my search to food service instead?
Assistant: Absolutely! Let me update the search criteria and find food service positions for you.
*Updates existing todo list to reflect the pivot, cancelling warehouse-specific tasks*

<reasoning>
The assistant did not CREATE a new todo list, but UPDATED the existing one. When the user pivots, update the current plan (cancel irrelevant tasks, add new ones) rather than starting fresh - unless starting over makes more sense for clarity.
</reasoning>
</example>

<example>
User: What time do most warehouse shifts start?
Assistant: Most warehouse shifts start early - first shift typically begins between 5-7 AM. Second shift usually starts around 2-4 PM, and overnight/third shift around 10 PM - midnight. Many warehouses also offer flexible scheduling for part-time positions.

<reasoning>
The assistant did not use the todo list because this is a factual question that can be answered directly. No planning or multi-step work is needed.
</reasoning>
</example>

## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully
   - cancelled: Task no longer needed (user changed direction)

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Only have ONE task in_progress at any time
   - Complete current tasks before starting new ones
   - Cancel tasks that become irrelevant when the user pivots
   - ADD new tasks when you discover them mid-process

3. **Task Breakdown**:
   - Create specific, actionable items
   - Break complex requests into smaller, manageable steps
   - Use clear, descriptive task names (but keep them short: 3-8 words)
   - Include contingency tasks when appropriate ("If X, then Y")

4. **Dynamic Planning**:
   - Your initial plan is a hypothesis - it WILL change
   - Add tasks as you discover what's needed
   - Remove or cancel tasks that become unnecessary
   - The plan reflects YOUR understanding of what needs to happen
   - Don't be afraid to restructure the plan as you learn more

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.

**CRITICAL: If you do not use this tool for complex tasks, you may forget important steps - and that is unacceptable.**
```

**File: `convex/jobMatcher/tools.ts`** - Add todoWrite and todoRead tools

```typescript
// Add at top of file
import TODOWRITE_DESCRIPTION from './todowrite.txt'

// Add these tools (replace showPlan)

export const todoWrite = createTool({
  args: z.object({
    todos: z.array(z.object({
      id: z.string().describe('Unique identifier for the todo item'),
      content: z.string().describe('Brief description of the task (3-8 words)'),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled'])
        .describe('Current status: pending, in_progress, completed, cancelled'),
      priority: z.enum(['high', 'medium', 'low'])
        .describe('Priority: high, medium, low'),
    })).describe('The complete updated todo list'),
  }),
  description: TODOWRITE_DESCRIPTION,
  handler: async (ctx, args) => {
    if (!ctx.threadId) throw new Error('No thread context')
    
    await ctx.runMutation(internal.jobMatcher.plan.updatePlan, {
      threadId: ctx.threadId,
      todos: args.todos,
    })
    
    const remaining = args.todos.filter(t => t.status !== 'completed').length
    console.log(`[Tool:todoWrite] Updated plan: ${remaining} remaining of ${args.todos.length}`)
    
    return {
      updated: true,
      total: args.todos.length,
      remaining,
    }
  },
})

export const todoRead = createTool({
  args: z.object({}),
  description: 'Read your current todo list to see what tasks are pending. Use this if you need to check your plan status.',
  handler: async (ctx) => {
    if (!ctx.threadId) throw new Error('No thread context')
    
    const plan = await ctx.runQuery(internal.jobMatcher.plan.getPlanInternal, {
      threadId: ctx.threadId,
    })
    
    console.log(`[Tool:todoRead] Read plan: ${plan?.length ?? 0} todos`)
    return plan ?? []
  },
})

// Update tools export
export const tools = {
  askQuestion,
  collectLocation,
  getMyJobPreferences,
  getMyResume,
  saveUserPreference,
  searchJobs,
  todoRead,
  todoWrite,
  // Remove: showPlan
}
```

---

## Part 4: Agent Instructions (COMPLETELY REWRITTEN)

**File: `convex/jobMatcher/agent.ts`**

```typescript
import { createGroq } from '@ai-sdk/groq'
import { Agent } from '@convex-dev/agent'

import { components } from '../_generated/api'
import { tools } from './tools'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export const jobMatcherAgent = new Agent(components.agent, {
  instructions: `You are the Recovery Jobs career assistant - the most helpful job-finding agent for people rebuilding their lives.

You help job seekers find work, with special expertise in second-chance employment. Many of your users have criminal records and need fair-chance employers. You understand their challenges and help them succeed.

IMPORTANT: You must NEVER generate fake job listings or make up employer information. Only present real jobs from your search results. If you're unsure about something, say so honestly.

# Tone and Style

- Be warm but direct. These users need real help, not corporate speak.
- Write at an 8th-grade reading level. Many users have limited formal education.
- Keep responses short and scannable. Use bullets, not paragraphs.
- No emojis unless the user uses them first.
- Be honest, even when the truth is hard. If someone's expectations are unrealistic, say so kindly.
- Celebrate wins. Finding work after incarceration is a big deal - acknowledge their progress.

# Professional Honesty

Prioritize being genuinely helpful over making the user feel good. If their resume needs work, tell them. If their salary expectations are too high for their experience, explain the market reality. If they're targeting jobs they're unlikely to get, suggest alternatives.

Honest guidance and respectful reality-checks are more valuable than false encouragement. Your job is to help them actually get hired, not just feel good about searching.

However, always deliver hard truths with empathy. These users have often faced a lot of rejection. Be direct but kind.

# Task Management (CRITICAL)

You have the todoWrite tool to manage and plan tasks. Use it VERY frequently to ensure you're tracking your work and giving the user visibility into your progress.

This tool is EXTREMELY helpful for:
- Planning what steps are needed for each user's unique situation
- Breaking down complex requests into manageable pieces
- Showing the user what you're doing and why
- Keeping yourself on track when conversations get long

**If you do not use this tool when working on multi-step tasks, you may forget important steps or lose track of what you promised to do - and that is unacceptable.**

It is critical that you mark todos as completed as soon as you finish them. Do not batch completions. Update the plan in real-time.

## Task Management Examples

<example>
user: I need a job fast, I just got released
assistant: I understand the urgency. Let me check your profile first.
*Calls getMyResume and getMyJobPreferences*

I see you have construction experience. Let me create a plan:
*Calls todoWrite with:*
- Check for immediate-hire construction jobs (in_progress)
- Search general labor as backup (pending)
- Focus on fair-chance employers (pending)
- Present fastest-hiring options first (pending)

I'm searching for construction jobs now...
*Calls searchJobs*

Found 8 matches. Marking search complete, moving to present results.
*Updates todoWrite - marks tasks completed, "Present results" now in_progress*

Here are your best options for quick hiring...
</example>

<example>
user: Help me find something in healthcare
assistant: Healthcare is a growing field with lots of opportunity. Let me see your background.
*Calls getMyResume*

I see customer service experience but no healthcare certifications. I want to be honest - most clinical roles require certifications. But there ARE entry points. Let me plan this out:
*Calls todoWrite with:*
- Search entry-level healthcare roles (in_progress)
- Find non-clinical hospital jobs (pending)
- Research certification programs nearby (pending)
- Present short-term AND long-term options (pending)

Starting with entry-level healthcare searches...
*Calls searchJobs multiple times*

I found several options. Let me update the plan and show you what matches.
*Updates todoWrite - marks searches complete*
</example>

# Doing Tasks

Users will ask you to help with job searching, resume questions, career advice, and related topics. For these tasks:

1. **Investigate first** - Call getMyResume and getMyJobPreferences to understand the user's situation before making a plan. Don't assume - look at what they actually have.

2. **Plan based on what you find** - Use todoWrite to create a plan that fits THIS user's specific situation. A user missing their location needs different steps than one with a complete profile.

3. **Execute the plan** - Work through tasks one at a time, updating status as you go. Mark things in_progress when you start, completed when you finish.

4. **Adapt when things change** - If the user pivots, adds requirements, or you discover something new, update your plan. Cancel irrelevant tasks, add new ones.

5. **Be thorough** - Don't skip steps. Don't mark things complete until they're actually done. If a search returns no results, that's still valuable information to report.

# Tool Usage Policy

- **todoWrite / todoRead**: Use VERY frequently. Any multi-step task needs a visible plan. Update it as you work.

- **getMyResume**: Call early to understand the user's work history, skills, and background. This informs your entire approach.

- **getMyJobPreferences**: Call early to understand what they're looking for - job types, commute, fair-chance requirements, etc.

- **searchJobs**: Use when you have enough info to search effectively. Run multiple searches with different keywords for better coverage. Don't just search once - try variations.

- **collectLocation**: Use when you need precise location for commute calculations. Only call if the user hasn't set a location yet. This is an interactive tool - STOP after calling it.

- **askQuestion**: Use when you need specific information from the user. Present clear options when possible. This is an interactive tool - STOP after calling it.

- **saveUserPreference**: Use to save important preferences for future sessions when the user expresses clear preferences.

You can call multiple tools in parallel when they don't depend on each other. For example, getMyResume and getMyJobPreferences can be called together at the start.

# Interactive Tools - CRITICAL

askQuestion and collectLocation require user input to continue.

**After calling EITHER of these tools, you MUST STOP.** Do not call any other tools. Do not continue your response. Do not write additional text. Wait for the user to respond.

The UI displays the question/form from these tools. If you write text too, it creates confusing duplicates. Just call the tool and stop.

# When to Ask vs When to Act

**Ask the user when:**
- You need information that isn't in their profile (location, job type preferences)
- They could go multiple directions and you need their preference
- You want to confirm before making a significant assumption
- The search returned unexpected results and you need guidance

**Just act when:**
- You have enough info to proceed reasonably
- The next step is obvious from context
- You're executing an established plan
- The user has given you clear direction

Don't over-ask. If you can reasonably proceed with the information you have, do so. Users want results, not twenty questions. But also don't make wild assumptions - find the balance.

# Going Beyond Basic Search

You're not just a search engine. You're a career assistant. You can and should:

- **Suggest resume improvements** if you spot issues or gaps
- **Recommend realistic salary expectations** based on their experience level
- **Explain what fair-chance employers look for** in candidates
- **Help users understand why they might not be getting callbacks** if they share frustrations
- **Suggest alternative career paths** if their current target isn't yielding results
- **Provide encouragement and practical next steps** - job searching is hard
- **Point out strengths they might not recognize** in their background

Don't be afraid to offer advice that wasn't explicitly requested if it would genuinely help the user succeed.

# Rules Summary

1. **Always investigate before planning** - Load profile first, then create a plan based on what you find
2. **Use todoWrite for ANY multi-step task** - No exceptions. It's how the user sees your progress.
3. **Update todos in real-time** - Mark in_progress when starting, completed IMMEDIATELY when done
4. **Be honest even when it's hard** - Deliver with empathy, but don't sugarcoat
5. **Keep responses short and scannable** - Bullets over paragraphs, simple words
6. **STOP after interactive tools** - askQuestion and collectLocation require waiting for user response
7. **Never fabricate job listings** - Only present real results from searches
8. **Adapt your plan as you learn** - Plans are hypotheses that evolve`,
  languageModel: groq('moonshotai/kimi-k2-instruct-0905'),
  maxSteps: 20,
  name: 'Job Matcher',
  tools,
})
```

---

## Part 5: Dynamic Context Injection

Borrow OpenCode's pattern of injecting runtime context into the system prompt before each LLM call.

**File: `convex/jobMatcher/context.ts`** (NEW)

```typescript
import type { Doc } from '../_generated/dataModel'

type ResumeDoc = Doc<'resumes'>
type ProfileDoc = Doc<'profiles'>

interface PreferencesData {
  maxCommuteMinutes?: number
  preferSecondChance?: boolean
  requireSecondChance?: boolean
  preferredShifts?: string[]
  preferredJobTypes?: string[]
}

interface ContextInput {
  resume: ResumeDoc | null
  preferences: PreferencesData | null
  profile: ProfileDoc | null
  searchCount: number
  sessionStarted: Date
}

/**
 * Build dynamic context to inject into the system prompt.
 * This gives the agent awareness of the user's current state
 * without needing to call tools.
 */
export function buildUserContext(data: ContextInput): string {
  const sections: string[] = []
  
  sections.push('<user-context>')
  sections.push('This is automatically injected context about the current user. Use this to inform your approach.')
  sections.push('')
  
  // Resume summary
  if (data.resume) {
    const skills = data.resume.skills?.slice(0, 6).join(', ') || 'None listed'
    const experienceCount = data.resume.workExperience?.length || 0
    const recentJob = data.resume.workExperience?.[0]
    
    sections.push('## Resume')
    sections.push(`- Work history: ${experienceCount} position${experienceCount !== 1 ? 's' : ''} listed`)
    if (recentJob) {
      sections.push(`- Most recent: ${recentJob.title || 'Untitled'} at ${recentJob.company || 'Unknown'}`)
    }
    sections.push(`- Skills: ${skills}`)
    if (data.resume.summary) {
      sections.push(`- Summary: ${data.resume.summary.slice(0, 150)}${data.resume.summary.length > 150 ? '...' : ''}`)
    }
  } else {
    sections.push('## Resume')
    sections.push('- Status: Not uploaded yet')
    sections.push('- Note: You may want to encourage them to add a resume for better matches')
  }
  
  sections.push('')
  
  // Location status
  sections.push('## Location')
  if (data.profile?.homeLat && data.profile?.homeLon) {
    const city = data.profile.city || 'Location set'
    const state = data.profile.state || ''
    sections.push(`- Home location: ${city}${state ? ', ' + state : ''} (coordinates available)`)
    sections.push('- Commute calculations: Available')
  } else {
    sections.push('- Home location: NOT SET')
    sections.push('- Action needed: Use collectLocation to get their location before searching')
  }
  
  sections.push('')
  
  // Preferences summary
  sections.push('## Preferences')
  if (data.preferences) {
    if (data.preferences.requireSecondChance) {
      sections.push('- Fair-chance employers: REQUIRED (only show second-chance friendly)')
    } else if (data.preferences.preferSecondChance) {
      sections.push('- Fair-chance employers: Preferred (prioritize but show others too)')
    } else {
      sections.push('- Fair-chance employers: No specific preference')
    }
    
    if (data.preferences.maxCommuteMinutes) {
      sections.push(`- Max commute: ${data.preferences.maxCommuteMinutes} minutes`)
    }
    
    if (data.preferences.preferredShifts?.length) {
      sections.push(`- Preferred shifts: ${data.preferences.preferredShifts.join(', ')}`)
    }
    
    if (data.preferences.preferredJobTypes?.length) {
      sections.push(`- Job types interested in: ${data.preferences.preferredJobTypes.join(', ')}`)
    }
  } else {
    sections.push('- Status: No preferences saved yet')
    sections.push('- Will use defaults or need to ask')
  }
  
  sections.push('')
  
  // Session context
  sections.push('## This Session')
  sections.push(`- Searches performed: ${data.searchCount}`)
  
  const minutesElapsed = Math.floor((Date.now() - data.sessionStarted.getTime()) / 60000)
  if (minutesElapsed > 5) {
    sections.push(`- Session duration: ${minutesElapsed} minutes`)
  }
  
  sections.push('</user-context>')
  
  return sections.join('\n')
}
```

**File: `convex/jobMatcher/actions.ts`** - Update to inject context

```typescript
// Add import
import { buildUserContext } from './context'

// In the action that starts/continues the agent, add context injection:

export const sendMessage = action({
  args: {
    message: v.string(),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    
    const userId = identity.subject

    // Pre-fetch user data for context injection
    const [resume, preferences, profile, searchRecord] = await Promise.all([
      ctx.runQuery(internal.resumes.getByWorkosUserIdInternal, { workosUserId: userId }),
      ctx.runQuery(internal.jobPreferences.getByWorkosUserIdInternal, { workosUserId: userId }),
      ctx.runQuery(internal.profiles.getByWorkosUserIdInternal, { workosUserId: userId }),
      args.threadId 
        ? ctx.runQuery(internal.jobMatcher.queries.getSearchByThreadId, { threadId: args.threadId })
        : null,
    ])
    
    // Build dynamic context
    const userContext = buildUserContext({
      resume,
      preferences: preferences ? {
        maxCommuteMinutes: preferences.maxCommuteMinutes,
        preferSecondChance: preferences.preferSecondChance,
        requireSecondChance: preferences.requireSecondChance,
        preferredShifts: preferences.preferredShifts,
        preferredJobTypes: preferences.preferredJobTypes,
      } : null,
      profile,
      searchCount: searchRecord?.searchCount ?? 0,
      sessionStarted: searchRecord ? new Date(searchRecord.startedAt) : new Date(),
    })
    
    // Continue or create thread...
    if (args.threadId) {
      const { thread } = await jobMatcherAgent.continueThread(ctx, {
        threadId: args.threadId,
        userId,
      })

      // Inject user context into the system prompt for this call
      await thread.streamText({
        prompt: args.message,
        system: userContext,
      }, { saveStreamDeltas: true })

      return { threadId: args.threadId }
    }

    // Create new thread...
    const { thread, threadId } = await jobMatcherAgent.createThread(ctx, { userId })

    // Record the search
    await ctx.runMutation(internal.jobMatcher.queries.createSearchRecord, {
      initialPrompt: args.message,
      threadId,
      workosUserId: userId,
    })

    // Inject user context into the system prompt
    await thread.streamText({
      prompt: args.message,
      system: userContext,
    }, { saveStreamDeltas: true })

    return { threadId }
  },
  returns: v.object({ threadId: v.string() }),
})
```

---

## Part 6: System Reminders (Optional Enhancement)

Like OpenCode's `<system-reminder>` pattern, we can inject reminders at key moments.

**File: `convex/jobMatcher/reminders.ts`** (NEW)

```typescript
/**
 * System reminders that can be injected into the conversation at key moments.
 * These follow OpenCode's pattern of using <system-reminder> tags.
 */

export const REMINDERS = {
  /**
   * When conversation has gone 5+ turns without a plan update
   */
  STALE_PLAN: `<system-reminder>
Your todo list may be stale. If you've completed tasks or the situation has changed, update your plan with todoWrite now.
</system-reminder>`,

  /**
   * When user seems frustrated or conversation is going in circles
   */
  REFOCUS: `<system-reminder>
The conversation may be going in circles. Consider:
1. Summarizing what you've tried so far
2. Asking the user directly what would be most helpful right now
3. Suggesting a different approach entirely
</system-reminder>`,

  /**
   * When max steps is approaching
   */
  MAX_STEPS_WARNING: `<system-reminder>
You're approaching the maximum number of steps for this turn. Prioritize:
1. Complete any in-progress tasks
2. Present results if you have them
3. Summarize what's been done and what remains
4. Let the user know they can continue the conversation
</system-reminder>`,

  /**
   * When user returns after being away
   */
  SESSION_RESUME: `<system-reminder>
The user is returning to an existing conversation. Briefly remind them where you left off before continuing.
</system-reminder>`,

  /**
   * When search returned zero results
   */
  NO_RESULTS: `<system-reminder>
The search returned no results. Consider:
1. Suggesting the user broaden their criteria
2. Trying alternative search terms
3. Being honest that this combination of requirements may be difficult to fill
4. Offering to adjust specific criteria
</system-reminder>`,

  /**
   * When user's expectations seem unrealistic
   */
  REALITY_CHECK: `<system-reminder>
The user's requirements may be difficult to meet in the current job market. Be honest but kind. Suggest realistic alternatives while respecting their goals.
</system-reminder>`,
}

/**
 * Determine if any reminders should be injected based on conversation state
 */
export function getApplicableReminders(state: {
  turnsSincePlanUpdate: number
  isApproachingMaxSteps: boolean
  lastSearchHadResults: boolean
  isReturningUser: boolean
}): string[] {
  const reminders: string[] = []
  
  if (state.turnsSincePlanUpdate >= 5) {
    reminders.push(REMINDERS.STALE_PLAN)
  }
  
  if (state.isApproachingMaxSteps) {
    reminders.push(REMINDERS.MAX_STEPS_WARNING)
  }
  
  if (state.lastSearchHadResults === false) {
    reminders.push(REMINDERS.NO_RESULTS)
  }
  
  if (state.isReturningUser) {
    reminders.push(REMINDERS.SESSION_RESUME)
  }
  
  return reminders
}
```

---

## Part 7: Frontend - Collapsible Plan Header

**File: `src/components/chat/PlanHeader.tsx`** (NEW)

```tsx
'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDotDashed,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'
import { api } from '../../../convex/_generated/api'

interface PlanHeaderProps {
  threadId: string | null
  isAgentRunning: boolean
}

type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

interface Todo {
  id: string
  content: string
  status: TodoStatus
  priority: 'high' | 'medium' | 'low'
}

const STATUS_ICONS = {
  pending: Circle,
  in_progress: CircleDotDashed,
  completed: CheckCircle2,
  cancelled: XCircle,
}

const STATUS_STYLES = {
  pending: {
    icon: 'text-muted-foreground',
    text: '',
  },
  in_progress: {
    icon: 'text-primary animate-spin',
    text: 'text-primary font-medium',
  },
  completed: {
    icon: 'text-emerald-500',
    text: 'text-muted-foreground line-through',
  },
  cancelled: {
    icon: 'text-destructive/70',
    text: 'text-muted-foreground line-through',
  },
}

function TodoItem({ todo }: { todo: Todo }) {
  const Icon = STATUS_ICONS[todo.status]
  const styles = STATUS_STYLES[todo.status]
  
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className={cn('h-4 w-4 shrink-0', styles.icon)} />
      <span className={cn('text-sm truncate', styles.text)}>
        {todo.content}
      </span>
    </div>
  )
}

export function PlanHeader({ threadId, isAgentRunning }: PlanHeaderProps) {
  const { data: plan } = useQuery(
    convexQuery(api.jobMatcher.plan.getPlan, threadId ? { threadId } : 'skip')
  )

  // Auto-expand when agent starts running, collapse when done
  const [isExpanded, setIsExpanded] = useState(false)
  
  useEffect(() => {
    if (isAgentRunning) {
      setIsExpanded(true)
    } else if (plan && plan.length > 0) {
      // Collapse after a short delay when agent stops
      const timer = setTimeout(() => setIsExpanded(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [isAgentRunning, plan])

  // Don't render if no plan
  if (!plan || plan.length === 0) return null

  const completedCount = plan.filter(t => t.status === 'completed').length
  const cancelledCount = plan.filter(t => t.status === 'cancelled').length
  const activeCount = plan.length - cancelledCount
  const totalCount = plan.length
  const allComplete = completedCount === activeCount && activeCount > 0
  const progress = activeCount > 0 ? (completedCount / activeCount) * 100 : 0
  
  // Find current in-progress task for summary
  const currentTask = plan.find(t => t.status === 'in_progress')
  const nextPending = plan.find(t => t.status === 'pending')

  return (
    <div className="border-b bg-muted/30">
      {/* Collapsed summary - always visible, clickable to expand */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 shrink-0">
            {allComplete ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : isAgentRunning ? (
              <CircleDotDashed className="h-4 w-4 text-primary animate-spin" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">
              {completedCount}/{activeCount}
            </span>
          </div>

          {/* Current/summary text */}
          <span className="text-sm truncate">
            {allComplete ? (
              <span className="text-emerald-600">All tasks complete</span>
            ) : currentTask ? (
              <span className="text-primary">{currentTask.content}</span>
            ) : nextPending ? (
              <span className="text-muted-foreground">Next: {nextPending.content}</span>
            ) : null}
          </span>
        </div>

        {/* Expand/collapse chevron */}
        <ChevronDown 
          className={cn(
            'h-4 w-4 text-muted-foreground shrink-0 transition-transform',
            isExpanded && 'rotate-180'
          )} 
        />
      </button>

      {/* Expanded todo list */}
      {isExpanded && (
        <div className="px-4 pb-3">
          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
            <div
              className={cn(
                'h-full transition-all duration-500',
                allComplete ? 'bg-emerald-500' : 'bg-primary'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Todo items */}
          <div className="space-y-0.5">
            {plan
              .filter(todo => todo.status !== 'cancelled')
              .map(todo => (
                <TodoItem key={todo.id} todo={todo} />
              ))}
            
            {/* Show cancelled items collapsed */}
            {cancelledCount > 0 && (
              <div className="text-xs text-muted-foreground mt-2">
                {cancelledCount} task{cancelledCount !== 1 ? 's' : ''} cancelled
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Part 8: Integrate into JobMatcherChat

**File: `src/components/chat/JobMatcherChat.tsx`**

```tsx
// Add import
import { PlanHeader } from './PlanHeader'

// In the component, add state for tracking if agent is running
// The existing isForceSearching state can be used, or track via session status

export function JobMatcherChat() {
  // ... existing state ...

  // Track if agent is actively running (for plan expansion)
  const isAgentRunning = isForceSearching // or derive from session status

  // ... rest of existing code ...

  // Active thread - show chat interface
  return (
    <div className='flex flex-col h-dvh'>
      <ChatHeader
        filtersChanged={filtersChanged}
        hasActiveThread={true}
        isSearching={isForceSearching}
        onForceSearch={handleForceSearch}
        onNewChat={handleNewChat}
        onRedoSearch={handleRedoSearch}
      />

      {/* Plan Header - sticky below ChatHeader, auto-expands when running */}
      <PlanHeader threadId={threadId} isAgentRunning={isAgentRunning} />

      <JobMatcherRuntimeProvider onThreadCreated={handleThreadCreated} threadId={threadId}>
        {/* Remove ShowPlanToolUI - no longer needed */}
        {/* <ShowPlanToolUI /> */}
        
        <ResumeToolUI />
        <PreferencesToolUI />
        <CollectLocationToolUI />
        <SearchJobsToolUI />
        <QuestionToolUI />

        <div className='flex-1 overflow-hidden min-h-0'>
          <Thread />
        </div>
      </JobMatcherRuntimeProvider>
    </div>
  )
}
```

---

## Part 9: Remove Obsolete Tool UI

**File: `src/components/chat/tools/index.tsx`**

Remove `ShowPlanToolUI` from the file and from the `jobMatcherToolUIs` export array.

---

## Files to Modify/Create Summary

| File | Action | Description |
|------|--------|-------------|
| `convex/schema.ts` | Modify | Add `plan` array field to `jobSearches` table |
| `convex/jobMatcher/plan.ts` | Create | Plan mutations (`updatePlan`) and queries (`getPlan`, `getPlanInternal`) |
| `convex/jobMatcher/todowrite.txt` | Create | Comprehensive tool description (180+ lines with examples and reasoning) |
| `convex/jobMatcher/tools.ts` | Modify | Add `todoWrite`, `todoRead`; remove `showPlan` |
| `convex/jobMatcher/agent.ts` | Modify | **Completely rewritten** autonomous agent instructions |
| `convex/jobMatcher/context.ts` | Create | Dynamic user context builder for system prompt injection |
| `convex/jobMatcher/actions.ts` | Modify | Inject dynamic user context before each LLM call |
| `convex/jobMatcher/reminders.ts` | Create | System reminder templates for key moments |
| `convex/jobMatcher/index.ts` | Modify | Export new modules (plan, context, reminders) |
| `src/components/chat/PlanHeader.tsx` | Create | Collapsible plan header component |
| `src/components/chat/JobMatcherChat.tsx` | Modify | Add `PlanHeader`, remove `ShowPlanToolUI` |
| `src/components/chat/tools/index.tsx` | Modify | Remove `ShowPlanToolUI` |

---

## Key UX Behaviors

1. **Auto-expand when agent running** - Plan header expands automatically when the agent starts working
2. **Auto-collapse when done** - Collapses to summary ~1.5s after agent stops
3. **Click to expand** - User can tap/click to re-expand and inspect the full plan
4. **Progress indicator** - Shows X/Y completed count (excludes cancelled)
5. **Current task highlight** - Shows the in_progress task in primary color with spinning icon
6. **Cancelled tasks hidden** - Collapsed by default, shown as count
7. **Smooth transitions** - Progress bar animates, chevron rotates

---

## Key Differences from Original Wizard Approach

| Aspect | Original (Wizard) | New (Autonomous) |
|--------|-------------------|------------------|
| **Agent identity** | "Job matching assistant" | "The most helpful job-finding agent for people rebuilding their lives" |
| **Tone** | Generic helpful | Warm, direct, honest, celebratory |
| **Workflow** | Fixed 5-step wizard | Dynamic - agent discovers steps based on user's situation |
| **todowrite.txt** | 55 lines, 2 examples | 180+ lines, 6 examples with `<reasoning>` blocks |
| **Agent instructions** | 50 lines, procedural | 200+ lines, philosophical + practical |
| **Examples** | Show WHAT to do | Show WHAT + WHY (reasoning) |
| **Honesty** | Not addressed | Explicit: "be honest even when hard" |
| **Pivoting** | Not addressed | Explicit: cancel tasks, add new ones, adapt |
| **Career advice** | Not addressed | Explicit: go beyond search, offer advice |
| **Context injection** | Not included | Dynamic user context before each LLM call |
| **System reminders** | Not included | Templates for stale plans, max steps, etc. |
| **maxSteps** | 15 | 20 (more room for complex interactions) |
| **Interactive tools** | Mentioned | CRITICAL section with clear STOP instruction |

---

## Implementation Order

1. **Schema** - Add plan field to jobSearches
2. **Plan module** - Create plan.ts with mutations/queries
3. **Tool description** - Create todowrite.txt (this is the most important file for agent behavior)
4. **Tools** - Add todoWrite/todoRead, remove showPlan
5. **Agent instructions** - Update agent.ts with new comprehensive instructions
6. **Context injection** - Create context.ts and update actions.ts
7. **Reminders** - Create reminders.ts (optional, can defer)
8. **Frontend** - Create PlanHeader.tsx
9. **Integration** - Update JobMatcherChat.tsx
10. **Cleanup** - Remove ShowPlanToolUI

---

## Testing Checklist

- [ ] Agent creates plan at start of multi-step tasks
- [ ] Agent updates plan in real-time (in_progress → completed)
- [ ] Agent adapts plan when user pivots
- [ ] Agent doesn't create plan for simple questions
- [ ] PlanHeader expands when agent runs
- [ ] PlanHeader collapses when agent stops
- [ ] PlanHeader shows correct progress count
- [ ] User can click to expand/collapse manually
- [ ] Context injection shows in agent behavior (knows profile state)
- [ ] Agent stops after calling interactive tools
