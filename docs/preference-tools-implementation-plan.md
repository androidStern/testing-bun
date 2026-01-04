# Preference Tools Implementation Plan

## Problem

When the AI agent uses `askQuestion` to collect search preferences (shift, commute, fair-chance), user selections are stored only in the chat thread history. The top bar filter UI reads from `jobPreferences` table, which is NOT updated by `askQuestion`. This creates a disconnect where the agent "knows" the preferences but the UI doesn't reflect them.

## Solution

Create two new tools that write directly to `jobPreferences`:

| Tool | Purpose | Has UI? | When to Use |
|------|---------|---------|-------------|
| `askPreference` | Prompt user with deterministic form | ✅ Yes | Need to ask user to choose |
| `savePreference` | Silently save stated preference | ❌ No | User already stated preference in chat |

Both tools write to `jobPreferences`, causing the `FilterToolbar` to update immediately via its reactive query.

**Additionally:** Deprecate existing `saveUserPreference` tool (line 593 in tools.ts) since `savePreference` is a superset.

---

## Schema Reference

The `jobPreferences` table (from `convex/schema.ts` lines 66-93):

```typescript
jobPreferences: defineTable({
  // Commute preferences
  maxCommuteMinutes: v.optional(v.union(v.literal(10), v.literal(30), v.literal(60))),
  
  // Transit accessibility requirements
  requirePublicTransit: v.optional(v.boolean()),
  requireBusAccessible: v.optional(v.boolean()),
  requireRailAccessible: v.optional(v.boolean()),
  
  // Second-chance employer preferences
  preferSecondChance: v.optional(v.boolean()),
  requireSecondChance: v.optional(v.boolean()),
  
  // Shift preferences
  shiftMorning: v.optional(v.boolean()),
  shiftAfternoon: v.optional(v.boolean()),
  shiftEvening: v.optional(v.boolean()),
  shiftOvernight: v.optional(v.boolean()),
  shiftFlexible: v.optional(v.boolean()),
  
  // Job type preferences (not part of this feature)
  preferUrgent: v.optional(v.boolean()),
  preferEasyApply: v.optional(v.boolean()),
  
  updatedAt: v.number(),
  workosUserId: v.string(),
}).index('by_workos_user_id', ['workosUserId']),
```

---

## Implementation Tasks

### Task 1: Extend `upsertInternal` mutation

**File:** `convex/jobPreferences.ts`

The existing `upsertInternal` (lines 97-125) only accepts `maxCommuteMinutes` and `requirePublicTransit`. Extend it to accept ALL preference fields:

```typescript
export const upsertInternal = internalMutation({
  args: {
    workosUserId: v.string(),
    // Commute
    maxCommuteMinutes: v.optional(v.union(v.literal(10), v.literal(30), v.literal(60))),
    requirePublicTransit: v.optional(v.boolean()),
    requireBusAccessible: v.optional(v.boolean()),
    requireRailAccessible: v.optional(v.boolean()),
    // Fair chance
    preferSecondChance: v.optional(v.boolean()),
    requireSecondChance: v.optional(v.boolean()),
    // Shifts
    shiftMorning: v.optional(v.boolean()),
    shiftAfternoon: v.optional(v.boolean()),
    shiftEvening: v.optional(v.boolean()),
    shiftOvernight: v.optional(v.boolean()),
    shiftFlexible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { workosUserId, ...updates } = args

    // Filter out undefined values to only patch what's provided
    const filteredUpdates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value
      }
    }

    const existing = await ctx.db
      .query('jobPreferences')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', workosUserId))
      .unique()

    const data = {
      ...filteredUpdates,
      updatedAt: Date.now(),
      workosUserId,
    }

    if (existing) {
      await ctx.db.patch(existing._id, data)
      return existing._id
    }

    return await ctx.db.insert('jobPreferences', data)
  },
  returns: v.id('jobPreferences'),
})
```

---

### Task 2: Add `savePreference` tool

**File:** `convex/jobMatcher/tools.ts`

Add this new tool (uses `createTool` because it has an execute handler):

```typescript
/**
 * Silently save user preferences discovered during conversation.
 * This tool executes immediately (no UI) and writes to jobPreferences.
 */
export const savePreference = createTool({
  args: z.object({
    // Shift preferences
    shiftMorning: z.boolean().optional().describe('Morning shift (6am-12pm)'),
    shiftAfternoon: z.boolean().optional().describe('Afternoon shift (12pm-6pm)'),
    shiftEvening: z.boolean().optional().describe('Evening shift (6pm-12am)'),
    shiftOvernight: z.boolean().optional().describe('Overnight shift (12am-6am)'),
    shiftFlexible: z.boolean().optional().describe('Flexible/any shift'),
    // Commute preferences
    maxCommuteMinutes: z
      .union([z.literal(10), z.literal(30), z.literal(60)])
      .optional()
      .describe('Maximum commute time in minutes'),
    requirePublicTransit: z.boolean().optional().describe('Must be accessible by public transit'),
    // Fair chance preferences
    requireSecondChance: z.boolean().optional().describe('Only show fair-chance employers'),
    preferSecondChance: z.boolean().optional().describe('Prioritize fair-chance employers'),
  }),
  description: `Silently save user preferences discovered during conversation.

Use when the user STATES a preference (don't ask again, just save):
- "I can only work nights" → savePreference({ shiftOvernight: true })
- "I take the bus" → savePreference({ requirePublicTransit: true })
- "I have a record" → savePreference({ preferSecondChance: true })
- "30 minute commute max" → savePreference({ maxCommuteMinutes: 30 })

RULES:
- Only save what user explicitly mentioned
- Can set multiple fields at once
- Runs silently - no UI, but top bar updates immediately
- Can be called alongside other tools (not interactive)
- Do NOT use this for job type/industry preferences (those aren't saved)`,
  handler: async (ctx, args) => {
    if (!ctx.userId) throw new Error('Not authenticated')

    // Filter out undefined values
    const updates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined) {
        updates[key] = value
      }
    }

    if (Object.keys(updates).length === 0) {
      console.log('[Tool:savePreference] No preferences to save')
      return { saved: false, reason: 'no_values' }
    }

    console.log(`[Tool:savePreference] Saving: ${Object.keys(updates).join(', ')}`)

    await ctx.runMutation(internal.jobPreferences.upsertInternal, {
      workosUserId: ctx.userId,
      ...updates,
    })

    return { saved: true, fields: Object.keys(updates) }
  },
})
```

---

### Task 3: Add `askPreference` tool

**File:** `convex/jobMatcher/tools.ts`

Add this new tool (uses `tool` from 'ai' because it has NO execute handler - waits for UI):

```typescript
/**
 * UI tool for collecting specific preference with deterministic options.
 * NO execute function - stops execution and waits for user input via submitToolResult.
 */
export const askPreference = tool({
  description: `Ask user to select a specific preference using a deterministic form.

Use when you NEED to ask (user hasn't stated preference):
- Need shift info → askPreference({ preference: "shift" })
- Need commute tolerance → askPreference({ preference: "commute" })
- Need fair-chance preference → askPreference({ preference: "fairChance" })

RULES:
- Only ONE askPreference per turn
- Must be FINAL tool call - STOP after calling
- Do NOT use if user already stated the preference (use savePreference instead)
- Do NOT use askQuestion for shift/commute/fairChance (use this tool)

The UI shows a hardcoded form matching our database schema. Selections are saved automatically.`,
  inputSchema: z.object({
    preference: z
      .enum(['shift', 'commute', 'fairChance'])
      .describe('Which preference to collect'),
    context: z
      .string()
      .max(200)
      .optional()
      .describe('Brief context explaining why you need this (shown to user)'),
  }),
  // NO execute function - waits for user input
})
```

---

### Task 4: Update tools export and deprecate `saveUserPreference`

**File:** `convex/jobMatcher/tools.ts`

1. Remove or comment out the existing `saveUserPreference` tool (around line 593)
2. Update the `tools` export at the bottom of the file:

```typescript
export const tools = {
  askPreference,      // NEW - interactive, shows UI
  askQuestion,
  collectLocation,
  getMyJobPreferences,
  getMyResume,
  savePreference,     // NEW - silent, immediate (replaces saveUserPreference)
  searchJobs,
  todoRead,
  todoWrite,
}
```

---

### Task 5: Create `PreferenceToolUI` component

**File:** `src/components/chat/tools/PreferenceToolUI.tsx` (NEW FILE)

```typescript
import { makeAssistantToolUI } from '@assistant-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { Check } from 'lucide-react'
import { useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import { Button } from '../../ui/button'
import { Card } from '../../ui/card'
import { Checkbox } from '../../ui/checkbox'
import { Label } from '../../ui/label'
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group'

// ============================================================================
// Types - Match schema exactly
// ============================================================================

type PreferenceType = 'shift' | 'commute' | 'fairChance'

interface PreferenceArgs {
  preference: PreferenceType
  context?: string
}

// Shift result
interface ShiftResult {
  type: 'shift'
  shiftMorning: boolean
  shiftAfternoon: boolean
  shiftEvening: boolean
  shiftOvernight: boolean
  shiftFlexible: boolean
}

// Commute result
interface CommuteResult {
  type: 'commute'
  maxCommuteMinutes: 10 | 30 | 60 | null
  requirePublicTransit: boolean
}

// Fair chance result
interface FairChanceResult {
  type: 'fairChance'
  requireSecondChance: boolean
  preferSecondChance: boolean
}

type PreferenceResult = ShiftResult | CommuteResult | FairChanceResult

// ============================================================================
// Hardcoded Options - Schema Compatible
// ============================================================================

const SHIFT_OPTIONS = [
  { key: 'shiftMorning' as const, label: 'Morning', description: '6am – 12pm' },
  { key: 'shiftAfternoon' as const, label: 'Afternoon', description: '12pm – 6pm' },
  { key: 'shiftEvening' as const, label: 'Evening', description: '6pm – 12am' },
  { key: 'shiftOvernight' as const, label: 'Overnight', description: '12am – 6am' },
  { key: 'shiftFlexible' as const, label: 'Flexible', description: 'Any shift works' },
]

const COMMUTE_OPTIONS = [
  { minutes: 10 as const, label: '10 minutes', description: 'Very close to home' },
  { minutes: 30 as const, label: '30 minutes', description: 'Moderate commute' },
  { minutes: 60 as const, label: '60 minutes', description: 'Willing to travel further' },
]

const FAIR_CHANCE_OPTIONS = [
  { 
    mode: 'require' as const, 
    label: 'Required', 
    description: 'Only show fair-chance employers' 
  },
  { 
    mode: 'prefer' as const, 
    label: 'Preferred', 
    description: 'Prioritize fair-chance, but show all' 
  },
  { 
    mode: 'none' as const, 
    label: 'No preference', 
    description: 'Show all employers' 
  },
]

// ============================================================================
// Sub-components for each preference type
// ============================================================================

interface ShiftFormProps {
  onSubmit: (result: ShiftResult) => void
}

function ShiftForm({ onSubmit }: ShiftFormProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({
    shiftMorning: false,
    shiftAfternoon: false,
    shiftEvening: false,
    shiftOvernight: false,
    shiftFlexible: false,
  })

  const handleSubmit = () => {
    onSubmit({
      type: 'shift',
      shiftMorning: selected.shiftMorning,
      shiftAfternoon: selected.shiftAfternoon,
      shiftEvening: selected.shiftEvening,
      shiftOvernight: selected.shiftOvernight,
      shiftFlexible: selected.shiftFlexible,
    })
  }

  const hasSelection = Object.values(selected).some(Boolean)

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Select all shifts you can work:</p>
      <div className="space-y-2">
        {SHIFT_OPTIONS.map(opt => (
          <div key={opt.key} className="flex items-center space-x-3">
            <Checkbox
              id={opt.key}
              checked={selected[opt.key]}
              onCheckedChange={checked => 
                setSelected(prev => ({ ...prev, [opt.key]: !!checked }))
              }
            />
            <Label htmlFor={opt.key} className="flex-1 cursor-pointer">
              <span className="font-medium">{opt.label}</span>
              <span className="text-muted-foreground text-sm ml-2">{opt.description}</span>
            </Label>
          </div>
        ))}
      </div>
      <Button onClick={handleSubmit} disabled={!hasSelection} className="w-full">
        Save Shift Preferences
      </Button>
    </div>
  )
}

interface CommuteFormProps {
  onSubmit: (result: CommuteResult) => void
}

function CommuteForm({ onSubmit }: CommuteFormProps) {
  const [minutes, setMinutes] = useState<10 | 30 | 60 | null>(null)
  const [requireTransit, setRequireTransit] = useState(false)

  const handleSubmit = () => {
    onSubmit({
      type: 'commute',
      maxCommuteMinutes: minutes,
      requirePublicTransit: requireTransit,
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm font-medium">Maximum commute time:</p>
        <RadioGroup
          value={minutes?.toString() ?? ''}
          onValueChange={v => setMinutes(parseInt(v) as 10 | 30 | 60)}
        >
          {COMMUTE_OPTIONS.map(opt => (
            <div key={opt.minutes} className="flex items-center space-x-3">
              <RadioGroupItem value={opt.minutes.toString()} id={`commute-${opt.minutes}`} />
              <Label htmlFor={`commute-${opt.minutes}`} className="flex-1 cursor-pointer">
                <span className="font-medium">{opt.label}</span>
                <span className="text-muted-foreground text-sm ml-2">{opt.description}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="flex items-center space-x-3 pt-2 border-t">
        <Checkbox
          id="require-transit"
          checked={requireTransit}
          onCheckedChange={checked => setRequireTransit(!!checked)}
        />
        <Label htmlFor="require-transit" className="cursor-pointer">
          I need public transit access
        </Label>
      </div>

      <Button onClick={handleSubmit} disabled={!minutes} className="w-full">
        Save Commute Preferences
      </Button>
    </div>
  )
}

interface FairChanceFormProps {
  onSubmit: (result: FairChanceResult) => void
}

function FairChanceForm({ onSubmit }: FairChanceFormProps) {
  const [mode, setMode] = useState<'require' | 'prefer' | 'none' | null>(null)

  const handleSubmit = () => {
    if (!mode) return
    onSubmit({
      type: 'fairChance',
      requireSecondChance: mode === 'require',
      preferSecondChance: mode === 'prefer',
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Fair-chance employer preference:</p>
      <RadioGroup value={mode ?? ''} onValueChange={v => setMode(v as typeof mode)}>
        {FAIR_CHANCE_OPTIONS.map(opt => (
          <div key={opt.mode} className="flex items-center space-x-3">
            <RadioGroupItem value={opt.mode} id={`fc-${opt.mode}`} />
            <Label htmlFor={`fc-${opt.mode}`} className="flex-1 cursor-pointer">
              <span className="font-medium">{opt.label}</span>
              <span className="text-muted-foreground text-sm ml-2">{opt.description}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
      <Button onClick={handleSubmit} disabled={!mode} className="w-full">
        Save Preference
      </Button>
    </div>
  )
}

// ============================================================================
// Completed State Display
// ============================================================================

function CompletedShift({ result }: { result: ShiftResult }) {
  const shifts = SHIFT_OPTIONS.filter(opt => result[opt.key]).map(opt => opt.label)
  return (
    <div className="flex items-center gap-2 text-sm">
      <Check className="h-4 w-4 text-green-600" />
      <span>Shifts: {shifts.length > 0 ? shifts.join(', ') : 'Any'}</span>
    </div>
  )
}

function CompletedCommute({ result }: { result: CommuteResult }) {
  const parts = []
  if (result.maxCommuteMinutes) {
    parts.push(`${result.maxCommuteMinutes} min max`)
  }
  if (result.requirePublicTransit) {
    parts.push('transit required')
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <Check className="h-4 w-4 text-green-600" />
      <span>Commute: {parts.length > 0 ? parts.join(', ') : 'No limit'}</span>
    </div>
  )
}

function CompletedFairChance({ result }: { result: FairChanceResult }) {
  let text = 'No preference'
  if (result.requireSecondChance) text = 'Required'
  else if (result.preferSecondChance) text = 'Preferred'
  return (
    <div className="flex items-center gap-2 text-sm">
      <Check className="h-4 w-4 text-green-600" />
      <span>Fair Chance: {text}</span>
    </div>
  )
}

// ============================================================================
// Main Tool UI Component
// ============================================================================

export const PreferenceToolUI = makeAssistantToolUI<PreferenceArgs, PreferenceResult>({
  toolName: 'askPreference',
  render: ({ args, result, addResult }) => {
    const queryClient = useQueryClient()
    const upsertMutation = useConvexMutation(api.jobPreferences.upsert)
    
    const { mutateAsync: saveToDb } = useMutation({
      mutationFn: upsertMutation,
      onSuccess: () => {
        // Invalidate the preferences query so FilterToolbar updates
        queryClient.invalidateQueries({
          queryKey: convexQuery(api.jobPreferences.get, {}).queryKey,
        })
      },
    })

    const handleSubmit = async (preferenceResult: PreferenceResult) => {
      // Save to database first
      if (preferenceResult.type === 'shift') {
        await saveToDb({
          shiftMorning: preferenceResult.shiftMorning,
          shiftAfternoon: preferenceResult.shiftAfternoon,
          shiftEvening: preferenceResult.shiftEvening,
          shiftOvernight: preferenceResult.shiftOvernight,
          shiftFlexible: preferenceResult.shiftFlexible,
        })
      } else if (preferenceResult.type === 'commute') {
        await saveToDb({
          maxCommuteMinutes: preferenceResult.maxCommuteMinutes,
          requirePublicTransit: preferenceResult.requirePublicTransit,
        })
      } else if (preferenceResult.type === 'fairChance') {
        await saveToDb({
          requireSecondChance: preferenceResult.requireSecondChance,
          preferSecondChance: preferenceResult.preferSecondChance,
        })
      }

      // Then notify the agent
      addResult(preferenceResult)
    }

    // Show completed state
    if (result) {
      return (
        <Card className="p-3 bg-muted/50">
          {result.type === 'shift' && <CompletedShift result={result} />}
          {result.type === 'commute' && <CompletedCommute result={result} />}
          {result.type === 'fairChance' && <CompletedFairChance result={result} />}
        </Card>
      )
    }

    // Show form based on preference type
    const preference = args?.preference
    const context = args?.context

    return (
      <Card className="p-4">
        {context && (
          <p className="text-sm text-muted-foreground mb-3">{context}</p>
        )}
        {preference === 'shift' && <ShiftForm onSubmit={handleSubmit} />}
        {preference === 'commute' && <CommuteForm onSubmit={handleSubmit} />}
        {preference === 'fairChance' && <FairChanceForm onSubmit={handleSubmit} />}
      </Card>
    )
  },
})
```

---

### Task 6: Register the new tool UI

**File:** `src/components/chat/tools/index.tsx`

1. Import the new component at the top:
```typescript
import { PreferenceToolUI } from './PreferenceToolUI'
```

2. Add to the `jobMatcherToolUIs` array (around line 594):
```typescript
export const jobMatcherToolUIs = [
  ResumeToolUI,
  PreferencesToolUI,
  SearchJobsToolUI,
  QuestionToolUI,
  CollectLocationToolUI,
  PreferenceToolUI,  // ADD THIS
]
```

---

### Task 7: Add to interactive tools list

**File:** `src/components/chat/JobMatcherRuntimeProvider.tsx`

Update the `interactiveTools` array in `handleAddToolResult` (around line 61):

```typescript
const interactiveTools = ['collectLocation', 'askQuestion', 'askPreference']
```

---

### Task 8: Update agent system prompt

**File:** `convex/jobMatcher/agent.ts`

Find the system prompt and add this section (look for where tool usage is documented):

```markdown
## Preference Tools

Two tools for handling shift, commute, and fair-chance preferences:

### savePreference (silent, immediate)
Use when the user STATES a preference in their message:
- "I work nights" → savePreference({ shiftEvening: true, shiftOvernight: true })
- "I need to take the bus" → savePreference({ requirePublicTransit: true })
- "I have a criminal record" → savePreference({ preferSecondChance: true })
- "30 minute commute max" → savePreference({ maxCommuteMinutes: 30 })

This saves immediately with no UI. Can be called alongside other tools.

### askPreference (shows form, waits for response)
Use when you NEED to ask the user to choose:
- No shift info provided → askPreference({ preference: "shift" })
- Unclear commute tolerance → askPreference({ preference: "commute" })
- Need fair-chance preference → askPreference({ preference: "fairChance" })

This shows a deterministic form and STOPS execution until user responds.

### Decision Tree
1. Did user state a specific preference? → savePreference (silent)
2. Do you need to ask? → askPreference (shows form)
3. Is it about job TYPE (warehouse, retail)? → askQuestion (not a saved preference)

NEVER:
- Use askPreference after user already stated preference (use savePreference)
- Use askQuestion for shift/commute/fairChance (use preference tools instead)
- Call both savePreference AND askPreference for same preference in one turn
```

Also update any existing documentation that mentions `saveUserPreference` to reference `savePreference` instead.

---

## Data Flow Diagrams

### savePreference Flow (silent)
```
User: "I can only work nights"
         ↓
Agent calls: savePreference({ shiftOvernight: true, shiftEvening: true })
         ↓
Tool handler executes immediately
         ↓
Calls internal.jobPreferences.upsertInternal
         ↓
jobPreferences table updated
         ↓
FilterToolbar query reactively updates
         ↓
Top bar shows "Eve/Night" in Schedule filter
         ↓
Agent receives { saved: true, fields: ['shiftOvernight', 'shiftEvening'] }
         ↓
Agent continues with response
```

### askPreference Flow (with UI)
```
Agent calls: askPreference({ preference: "shift", context: "What shifts work?" })
         ↓
Tool has no execute() - message saved to thread
         ↓
PreferenceToolUI renders shift checkboxes
         ↓
User selects shifts, clicks "Save"
         ↓
Component calls api.jobPreferences.upsert directly
         ↓
FilterToolbar updates immediately
         ↓
Component calls addResult() with selection
         ↓
submitToolResult action receives result
         ↓
Result stored in thread, agent continues
```

---

## Testing Checklist

1. **savePreference silent save:**
   - [ ] User says "I work nights" → top bar shows Evening in Schedule
   - [ ] User says "I take the bus" → Commute filter shows "transit"
   - [ ] User says "I have a record" → Fair Chance shows "Preferred"
   - [ ] Multiple preferences in one message work

2. **askPreference form:**
   - [ ] Shift form shows 5 checkbox options
   - [ ] Commute form shows 3 radio options + transit checkbox
   - [ ] Fair Chance form shows 3 radio options
   - [ ] Clicking Save updates top bar immediately
   - [ ] Agent receives result and continues

3. **Regression:**
   - [ ] askQuestion still works for non-preference questions
   - [ ] collectLocation still works
   - [ ] searchJobs uses saved preferences correctly

---

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `convex/jobPreferences.ts` | MODIFY | Extend `upsertInternal` args |
| `convex/jobMatcher/tools.ts` | MODIFY | Add `askPreference`, `savePreference`; remove `saveUserPreference`; update exports |
| `convex/jobMatcher/agent.ts` | MODIFY | Add preference tools to system prompt |
| `src/components/chat/tools/PreferenceToolUI.tsx` | CREATE | New UI component |
| `src/components/chat/tools/index.tsx` | MODIFY | Export `PreferenceToolUI`, add to array |
| `src/components/chat/JobMatcherRuntimeProvider.tsx` | MODIFY | Add `askPreference` to interactive tools |
