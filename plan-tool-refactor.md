Final Architecture Plan: OpenCode-Style Todo for Job Matcher
Overview
Borrowing from OpenCode's proven approach:
1. Simple todoWrite tool - Agent updates entire todo list at once
2. Thread-scoped storage - Stored in jobSearches.plan in Convex
3. Collapsible sticky header - Expanded when agent running, collapsed to summary when done
4. Existing Plan design - Reuse the nice styling, adapt for collapsible behavior
---
Part 1: Schema Changes
File: convex/schema.ts
Add plan field to jobSearches table:
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
---
Part 2: Backend - Plan Mutations/Queries
File: convex/jobMatcher/plan.ts (NEW)
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
---
Part 3: Backend - TodoWrite Tool
File: convex/jobMatcher/todowrite.txt (NEW)
Use this tool to create and manage a structured task list for your job search session. This helps you track progress and show the user what you're doing.
## When to Use This Tool
Use this tool proactively in these scenarios:
1. **At the START of every search** - Create your initial plan
2. **When starting a task** - Mark it as in_progress  
3. **After completing a task** - Mark it as completed IMMEDIATELY (don't batch)
4. **When the situation changes** - Add new tasks or adjust priorities
## When NOT to Use This Tool
Skip using this tool when:
1. Answering a simple question (no search needed)
2. The task is trivial and doesn't need tracking
## Task States
- **pending**: Task not yet started
- **in_progress**: Currently working on (limit to ONE at a time)
- **completed**: Task finished successfully
- **cancelled**: Task no longer needed
## Priority Levels
- **high**: Must be done for the search to work
- **medium**: Important but not blocking
- **low**: Nice to have
## Examples
<example>
User: Find me warehouse jobs
Assistant: I'll help find warehouse jobs. Let me create a plan.
*Calls todoWrite:*
[
  {"id": "1", "content": "Check your profile", "status": "in_progress", "priority": "high"},
  {"id": "2", "content": "Review preferences", "status": "pending", "priority": "high"},
  {"id": "3", "content": "Search for jobs", "status": "pending", "priority": "high"},
  {"id": "4", "content": "Show results", "status": "pending", "priority": "medium"}
]
*After checking profile, updates:*
[
  {"id": "1", "content": "Check your profile", "status": "completed", "priority": "high"},
  {"id": "2", "content": "Review preferences", "status": "in_progress", "priority": "high"},
  {"id": "3", "content": "Search for jobs", "status": "pending", "priority": "high"},
  {"id": "4", "content": "Show results", "status": "pending", "priority": "medium"}
]
</example>
<example>
User: I need second-chance employers only
Assistant: Got it - filtering for fair-chance employers.
*Updates plan to reflect the new requirement:*
[
  {"id": "1", "content": "Check your profile", "status": "completed", "priority": "high"},
  {"id": "2", "content": "Review preferences", "status": "completed", "priority": "high"},
  {"id": "3", "content": "Search fair-chance jobs", "status": "in_progress", "priority": "high"},
  {"id": "4", "content": "Show results", "status": "pending", "priority": "medium"}
]
</example>
## Rules
1. **Mark tasks complete IMMEDIATELY** after finishing - don't wait
2. **Only ONE task in_progress** at a time
3. **Keep content short** - 3-6 words per task
4. **Update when things change** - don't let the plan get stale
5. **Always send the full list** - include all tasks, not just changes
File: convex/jobMatcher/tools.ts - Add todoWrite and todoRead tools
// Add at top of file
import TODOWRITE_DESCRIPTION from './todowrite.txt'
// Add these tools (replace showPlan)
export const todoWrite = createTool({
  args: z.object({
    todos: z.array(z.object({
      id: z.string().describe('Unique identifier for the todo item'),
      content: z.string().describe('Brief description of the task (3-6 words)'),
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
  description: 'Read your current todo list to see what tasks are pending',
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
---
Part 4: Update Agent Instructions
File: convex/jobMatcher/agent.ts
export const jobMatcherAgent = new Agent(components.agent, {
  instructions: `You are a job matching assistant for Recovery Jobs. You help people find work. Many users need second-chance employers.
## Writing Style
- Be VERY short. Use simple words.
- Write for 8th grade reading level.
- No fluff. No filler. Just facts.
- 1-2 sentences max per point.
## Task Management (CRITICAL)
You have the todoWrite tool to track your progress. Use it VERY frequently:
- At the START of every search to create your plan
- Mark tasks as in_progress when you begin them
- Mark tasks as completed IMMEDIATELY when done
- Update when the situation changes
This shows the user what you're doing. They can see your progress in real-time.
Example plan for a typical search:
1. "Check your profile" → in_progress → completed
2. "Review preferences" → in_progress → completed  
3. "Search for jobs" → in_progress → completed
4. "Show results" → in_progress → completed
## Tools
- todoWrite - Update your task list (use frequently!)
- todoRead - Check your current tasks
- getMyResume - Get user's resume
- getMyJobPreferences - Get user's preferences
- collectLocation - Get location (if needed)
- searchJobs - Find jobs
- askQuestion - Ask user questions
- saveUserPreference - Save preferences
## Workflow
### Step 1: Create Plan
Call todoWrite with your initial tasks. Mark first task as in_progress.
### Step 2: Load Profile  
Call getMyResume and getMyJobPreferences.
Update plan: mark "Check profile" completed, next task in_progress.
### Step 3: Check Readiness
Do you have: location, job type, shifts?
If missing something, ask ONE question or use collectLocation.
Update plan as you go.
### Step 4: Search
Run 2-3 searches with good keywords.
Update plan: mark "Search" in_progress then completed.
### Step 5: Show Results
Tell user WHY each job fits them.
Update plan: mark "Show results" completed.
## CRITICAL: Interactive Tools
askQuestion and collectLocation require user input.
After calling EITHER tool, STOP. Wait for user response.
DO NOT write text when calling these - the UI shows the question.
## Rules
- Update the plan after EVERY significant action
- Only ONE task should be in_progress at a time
- Mark tasks complete IMMEDIATELY (don't batch)
- Keep task descriptions short (3-6 words)`,
  languageModel: groq('moonshotai/kimi-k2-instruct-0905'),
  maxSteps: 15,
  name: 'Job Matcher',
  tools,
})
---
Part 5: Frontend - Collapsible Plan Header
File: src/components/chat/PlanHeader.tsx (NEW)
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
  const totalCount = plan.length
  const allComplete = completedCount === totalCount
  const progress = (completedCount / totalCount) * 100
  
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
              {completedCount}/{totalCount}
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
            {plan.map(todo => (
              <TodoItem key={todo.id} todo={todo} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
---
Part 6: Integrate into JobMatcherChat
File: src/components/chat/JobMatcherChat.tsx
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
---
Part 7: Remove Obsolete Tool UI
File: src/components/chat/tools/index.tsx
Remove ShowPlanToolUI from the file and from the jobMatcherToolUIs export array.
---
Files to Modify/Create Summary
| File | Action | Description |
|------|--------|-------------|
| convex/schema.ts | Modify | Add plan array field to jobSearches |
| convex/jobMatcher/plan.ts | Create | Plan mutations and queries |
| convex/jobMatcher/todowrite.txt | Create | Detailed tool description (prompt engineering) |
| convex/jobMatcher/tools.ts | Modify | Add todoWrite, todoRead; remove showPlan |
| convex/jobMatcher/agent.ts | Modify | Update instructions to emphasize todoWrite usage |
| convex/jobMatcher/index.ts | Modify | Export plan module |
| src/components/chat/PlanHeader.tsx | Create | Collapsible plan header component |
| src/components/chat/JobMatcherChat.tsx | Modify | Add PlanHeader, remove ShowPlanToolUI |
| src/components/chat/tools/index.tsx | Modify | Remove ShowPlanToolUI |
---
Key UX Behaviors
1. Auto-expand when agent running - Plan header expands automatically when the agent starts
2. Auto-collapse when done - Collapses to summary ~1.5s after agent stops
3. Click to expand - User can tap/click to re-expand and inspect the plan
4. Progress indicator - Shows X/Y completed count
5. Current task highlight - Shows the in_progress task in primary color
6. Smooth transitions - Progress bar animates, chevron rotates
