# Job Search Onboarding Wizard

## Overview

Transform the job search initiation from a 2-step flow (input → resume) into a guided 3-step wizard that ensures users have their preferences configured before searching.

## Problem Statement

Currently, users type a search query, may get interrupted for resume upload, then land directly in chat where the AI agent must collect preferences via tool calls. This creates friction and uncertainty:
- Users don't know what data affects their search
- Preferences are collected piecemeal during search
- No visual indication of what's been configured
- Users may skip resume and get poor results

## Solution

A deterministic 3-step onboarding wizard with progress indication:

```
[1. Search Query] → [2. Resume] → [3. Preferences] → Search Begins
```

---

## Design Principles

### 1. Visual Continuity
All three steps share:
- Same max-width container (`max-w-2xl`)
- Same Card component with identical padding/margins
- Consistent header treatment (icon + title + description)
- Unified stepper component at the top of every step
- Same button placement patterns (primary right, ghost skip left)

### 2. Progressive Disclosure
- Show the user's pending search throughout (keeps context)
- Each step reveals only what's needed for that step
- Clear indication of what's been completed vs what's ahead

### 3. Respectful Defaults
- Pre-populate with existing preferences
- Show meaningful defaults (not empty states)
- "Looks Good" is just as valid as editing

### 4. No Dead Ends
- Back button on every step (except first)
- Skip is always available but subtly styled
- Clear primary action on every screen

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  ○ Search  ─────  ○ Resume  ─────  ○ Preferences           │
│  ● (current)      ○ (next)         ○ (next)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Step Content Card - same container for all steps]        │
│                                                             │
│  Step 1: Query Input                                       │
│  Step 2: Resume (conditional)                              │
│  Step 3: Preferences Check                                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Footer actions - consistent placement]                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Step Details

### Step 1: Search Query

**Stepper State:** `[● Search] ── [○ Resume] ── [○ Preferences]`

**Card Content:**
```
┌──────────────────────────────────────────────────────────┐
│  🔍  What are you looking for?                           │
│                                                          │
│  Tell us about the job you want - your skills,          │
│  interests, or the type of work you're seeking.         │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ I'm looking for warehouse or forklift jobs near    │ │
│  │ downtown Tampa. I have 3 years experience and      │ │
│  │ prefer morning shifts...                           │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│                                      [Continue →]        │
└──────────────────────────────────────────────────────────┘
```

**Behavior:**
- Textarea with placeholder guidance
- "Continue" disabled until text entered
- On continue: Update URL with `?prompt=...`, advance to Step 2 or 3

---

### Step 2: Resume (Conditional)

**Stepper State:** `[✓ Search] ── [● Resume] ── [○ Preferences]`

**When shown:** No resume OR resume is incomplete (< 100 chars substantive content)

**Card Content (No Resume):**
```
┌──────────────────────────────────────────────────────────┐
│  📄  Upload Your Resume                                  │
│                                                          │
│  We'll use it to find jobs that match your experience.  │
│                                                          │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │                                                    │  │
│  │        📤  Drag & drop your resume here           │  │
│  │            or click to browse                     │  │
│  │                                                    │  │
│  │            PDF or DOCX, up to 10MB                │  │
│  │                                                    │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 🔍 Your search: "warehouse forklift jobs..."      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  [← Back]                    [Skip for now →]            │
└──────────────────────────────────────────────────────────┘
```

**Card Content (Incomplete Resume):**
```
┌──────────────────────────────────────────────────────────┐
│  ✏️  Your Resume Needs More Detail                       │
│                                                          │
│  Add work experience or skills for better matches.      │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 🔍 Your search: "warehouse forklift jobs..."      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  [← Back]    [Skip for now]    [Complete My Resume →]   │
└──────────────────────────────────────────────────────────┘
```

**Behavior:**
- Back button returns to Step 1 (query preserved in URL)
- Skip advances to Step 3
- Upload success or "Complete My Resume" (external link) advances to Step 3

---

### Step 3: Preferences Check

**Stepper State:** `[✓ Search] ── [✓ Resume] ── [● Preferences]`

**Card Content:**
```
┌──────────────────────────────────────────────────────────┐
│  ⚙️  Check Your Preferences                              │
│                                                          │
│  Make sure your filters are right before we search.    │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 🔍 Your search: "warehouse forklift jobs..."      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  📍 Location                                       │ │
│  │                                                    │ │
│  │  ✓ Tampa, FL                    [Change]          │ │
│  │    Transit zones ready                            │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  🛡️ Fair Chance                                    │ │
│  │                                                    │ │
│  │  ○ Required   ● Preferred   ○ No preference       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  🚗 Commute                                        │ │
│  │                                                    │ │
│  │  ○ 10 min   ● 30 min   ○ 60 min   ○ No limit     │ │
│  │                                                    │ │
│  │  ☐ Public transit only                            │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  🕐 Schedule                                       │ │
│  │                                                    │ │
│  │  ☑ Morning   ☑ Afternoon   ☐ Evening             │ │
│  │  ☐ Overnight   ☐ Flexible                         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  [← Back]    [Skip]              [Looks Good, Search!]  │
└──────────────────────────────────────────────────────────┘
```

**Behavior:**
- All preferences visible (no accordion, no collapse)
- Location section: Shows current value or "Not set". "Change" triggers existing `LocationSetupCard` flow as a modal/overlay
- Other sections: Inline editing with RadioGroup/Checkbox
- Changes save immediately via `api.jobPreferences.upsert`
- Back returns to Step 2 (or Step 1 if resume was skipped)
- "Looks Good, Search!" starts the search

---

## Visual Cohesion Specifications

### Unified Container

Every step renders inside the same wrapper:

```tsx
<div className="flex flex-1 items-center justify-center p-4">
  <div className="w-full max-w-2xl flex flex-col gap-6">
    <OnboardingProgress step={currentStep} />
    <Card>
      {/* Step content */}
    </Card>
  </div>
</div>
```

### Progress Stepper Design

Horizontal 3-step indicator with:
- **Circles** for each step (not just numbers)
- **Lines** connecting steps
- **States:** 
  - Completed: Filled circle with checkmark, solid line before
  - Current: Filled primary circle, pulsing subtle glow
  - Upcoming: Hollow circle, dashed line before

```
[✓]━━━━━[●]╌╌╌╌╌[○]
Search    Resume    Prefs
```

**Implementation:**
```tsx
<div className="flex items-center justify-center gap-0">
  {steps.map((step, i) => (
    <Fragment key={step.id}>
      {i > 0 && (
        <div className={cn(
          "h-px w-12 sm:w-16",
          i <= currentIndex ? "bg-primary" : "bg-border border-dashed"
        )} />
      )}
      <div className="flex flex-col items-center gap-1.5">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-all",
          step.status === 'complete' && "border-primary bg-primary text-primary-foreground",
          step.status === 'current' && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
          step.status === 'upcoming' && "border-muted-foreground/30 text-muted-foreground"
        )}>
          {step.status === 'complete' ? <Check className="h-4 w-4" /> : step.number}
        </div>
        <span className={cn(
          "text-xs font-medium",
          step.status === 'current' ? "text-foreground" : "text-muted-foreground"
        )}>
          {step.label}
        </span>
      </div>
    </Fragment>
  ))}
</div>
```

### Card Header Pattern

Consistent across all steps:

```tsx
<CardHeader className="text-center pb-2">
  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
    <Icon className="h-6 w-6 text-primary" />
  </div>
  <CardTitle className="text-xl">{title}</CardTitle>
  <CardDescription className="text-sm">
    {description}
  </CardDescription>
</CardHeader>
```

### Pending Search Display

Shown on Steps 2 and 3 to maintain context:

```tsx
<div className="rounded-lg border bg-muted/30 p-3">
  <div className="flex items-start gap-2 text-sm">
    <Search className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
    <div>
      <p className="text-muted-foreground text-xs">Your search</p>
      <p className="font-medium line-clamp-2">"{pendingSearch}"</p>
    </div>
  </div>
</div>
```

### Footer Actions

Consistent layout:

```tsx
<CardFooter className="flex justify-between gap-3 pt-4">
  {/* Left: Back button (ghost, subtle) */}
  {showBack && (
    <Button variant="ghost" onClick={onBack}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back
    </Button>
  )}
  
  {/* Spacer */}
  <div className="flex-1" />
  
  {/* Right: Skip (ghost) + Primary action */}
  {showSkip && (
    <Button variant="ghost" onClick={onSkip}>
      Skip
    </Button>
  )}
  <Button onClick={onContinue} disabled={!canContinue}>
    {primaryLabel}
    <ArrowRight className="ml-2 h-4 w-4" />
  </Button>
</CardFooter>
```

---

## Preference Sections Detail

### Location Section

When set:
```tsx
<div className="rounded-lg border p-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        <MapPin className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="font-medium">Tampa, FL</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Check className="h-3 w-3 text-green-600" />
          Transit zones ready
        </p>
      </div>
    </div>
    <Button variant="ghost" size="sm" onClick={openLocationSetup}>
      Change
    </Button>
  </div>
</div>
```

When not set:
```tsx
<div className="rounded-lg border border-dashed p-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <MapPin className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-muted-foreground">Location not set</p>
        <p className="text-xs text-muted-foreground">Will search all areas</p>
      </div>
    </div>
    <Button variant="outline" size="sm" onClick={openLocationSetup}>
      Set Location
    </Button>
  </div>
</div>
```

### Fair Chance Section

```tsx
<div className="rounded-lg border p-4 space-y-3">
  <div className="flex items-center gap-3">
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
      <Shield className="h-5 w-5 text-primary" />
    </div>
    <div>
      <p className="font-medium">Fair Chance Employers</p>
      <p className="text-xs text-muted-foreground">Open to candidates with records</p>
    </div>
  </div>
  <RadioGroup value={fairChanceMode} onValueChange={setFairChanceMode} className="flex gap-4">
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="require" id="fc-require" />
      <Label htmlFor="fc-require">Required</Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="prefer" id="fc-prefer" />
      <Label htmlFor="fc-prefer">Preferred</Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="none" id="fc-none" />
      <Label htmlFor="fc-none">No preference</Label>
    </div>
  </RadioGroup>
</div>
```

### Commute Section

```tsx
<div className="rounded-lg border p-4 space-y-3">
  <div className="flex items-center gap-3">
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
      <Car className="h-5 w-5 text-primary" />
    </div>
    <div>
      <p className="font-medium">Maximum Commute</p>
      <p className="text-xs text-muted-foreground">How far are you willing to travel?</p>
    </div>
  </div>
  <RadioGroup value={commute} onValueChange={setCommute} className="flex flex-wrap gap-3">
    {[
      { value: '10', label: '10 min' },
      { value: '30', label: '30 min' },
      { value: '60', label: '60 min' },
      { value: 'none', label: 'No limit' },
    ].map(opt => (
      <div key={opt.value} className="flex items-center space-x-2">
        <RadioGroupItem value={opt.value} id={`commute-${opt.value}`} />
        <Label htmlFor={`commute-${opt.value}`}>{opt.label}</Label>
      </div>
    ))}
  </RadioGroup>
  <div className="flex items-center space-x-2 pt-2 border-t">
    <Checkbox id="transit-only" checked={transitOnly} onCheckedChange={setTransitOnly} />
    <Label htmlFor="transit-only" className="text-sm">Public transit only</Label>
  </div>
</div>
```

### Schedule Section

```tsx
<div className="rounded-lg border p-4 space-y-3">
  <div className="flex items-center gap-3">
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
      <Clock className="h-5 w-5 text-primary" />
    </div>
    <div>
      <p className="font-medium">Available Shifts</p>
      <p className="text-xs text-muted-foreground">Select all that work for you</p>
    </div>
  </div>
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
    {[
      { key: 'shiftMorning', label: 'Morning', desc: '6am–12pm' },
      { key: 'shiftAfternoon', label: 'Afternoon', desc: '12pm–6pm' },
      { key: 'shiftEvening', label: 'Evening', desc: '6pm–12am' },
      { key: 'shiftOvernight', label: 'Overnight', desc: '12am–6am' },
      { key: 'shiftFlexible', label: 'Flexible', desc: 'Any shift' },
    ].map(shift => (
      <div key={shift.key} className="flex items-start space-x-2">
        <Checkbox 
          id={shift.key} 
          checked={shifts[shift.key]} 
          onCheckedChange={(c) => setShifts(prev => ({ ...prev, [shift.key]: !!c }))} 
        />
        <div>
          <Label htmlFor={shift.key} className="text-sm font-medium">{shift.label}</Label>
          <p className="text-xs text-muted-foreground">{shift.desc}</p>
        </div>
      </div>
    ))}
  </div>
</div>
```

---

## State Management

### URL State
- `?prompt=<encoded query>` - Persists across navigation/refresh

### Component State
```typescript
type OnboardingStep = 'query' | 'resume' | 'preferences'

interface OnboardingState {
  step: OnboardingStep
  resumeSkipped: boolean
  // Derived from existing queries:
  // - existingResume from api.resumes.getByWorkosUserId
  // - preferences from api.jobPreferences.get
  // - profile (location) from api.profiles.getByWorkosUserId
}
```

### Step Navigation Logic
```typescript
function computeSteps(hasResume: boolean, resumeComplete: boolean, resumeSkipped: boolean) {
  return {
    showResume: !hasResume || !resumeComplete,
    resumeCompleted: resumeSkipped || (hasResume && resumeComplete),
  }
}

function canGoBack(step: OnboardingStep, showResume: boolean): boolean {
  if (step === 'query') return false
  if (step === 'resume') return true // back to query
  if (step === 'preferences') return showResume // back to resume if it was shown
  return false
}
```

---

## Location Setup Integration

When user clicks "Change" or "Set Location":
1. Open `LocationSetupCard` in a **Dialog/Modal overlay**
2. Let the existing multi-step flow run (location → transport → commute → waiting → complete)
3. On complete, close dialog, refresh profile data
4. User returns to preferences step with updated location

```tsx
<Dialog open={showLocationSetup} onOpenChange={setShowLocationSetup}>
  <DialogContent className="max-w-lg p-0 overflow-hidden">
    <LocationSetupCard 
      reason="Set your location for better job matches"
      onComplete={(result) => {
        setShowLocationSetup(false)
        // Profile query will auto-refresh
      }}
    />
  </DialogContent>
</Dialog>
```

---

## File Structure

```
src/components/onboarding/
├── OnboardingWizard.tsx      # Main orchestrator
├── OnboardingProgress.tsx    # Step indicator
├── steps/
│   ├── QueryStep.tsx         # Step 1
│   ├── ResumeStep.tsx        # Step 2 (wraps existing cards)
│   └── PreferencesStep.tsx   # Step 3
└── PreferenceSection.tsx     # Reusable section component
```

---

## Implementation Order

1. **OnboardingProgress.tsx** - Step indicator component
2. **QueryStep.tsx** - Refactor current textarea into step format
3. **PreferencesStep.tsx** - New consolidated preferences view
4. **ResumeStep.tsx** - Wrap existing resume cards with back button
5. **OnboardingWizard.tsx** - Orchestrate the flow
6. **Update JobMatcherChat.tsx** - Replace current welcome flow
7. **Update jobs.tsx route** - Ensure URL param handling

---

## Design Decisions

| Question | Decision |
|----------|----------|
| Quick Apply in preferences? | No - only 4 categories (location, fair chance, commute, schedule) |
| Location edit UX? | Use existing `LocationSetupCard` in modal |
| Back navigation? | Yes, from preferences → resume → query |
| Pending search persistence? | URL param `?prompt=...` |
| Mobile layout? | All preferences visible (no accordion/collapse) |

---

## Technical Notes

### No New Backend Work Required
- Reuses `api.jobPreferences.upsert` for preference saves
- Reuses `api.profiles.setHomeLocation` for location
- Reuses existing resume queries and mutations

### Existing Components to Reuse
- `ResumeUploadCard` - for no-resume state
- `ResumeIncompleteCard` - for incomplete resume state  
- `LocationSetupCard` - for location setup flow (in modal)
- `Card`, `Button`, `Checkbox`, `RadioGroup` - shadcn/ui primitives

### Route Already Supports URL Param
`jobs.tsx` has `validateSearch` for `prompt` parameter - just need to update it on step transitions.
