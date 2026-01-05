import type { Doc } from '../_generated/dataModel'

type ResumeDoc = Doc<'resumes'>
type ProfileDoc = Doc<'profiles'>

interface PreferencesData {
  maxCommuteMinutes?: number
  preferSecondChance?: boolean
  requireSecondChance?: boolean
  shiftMorning?: boolean
  shiftAfternoon?: boolean
  shiftEvening?: boolean
  shiftOvernight?: boolean
  shiftFlexible?: boolean
  preferredJobTypes?: string[]
}

interface ContextInput {
  resume: ResumeDoc | null
  preferences: PreferencesData | null
  profile: ProfileDoc | null
  searchCount: number
  sessionStarted: Date
}

interface DirectionHint {
  id: string
  label: string
  confidence: 'high' | 'medium'
}

function getResumeText(resume: ResumeDoc): string {
  const parts: string[] = []
  if (resume.summary) parts.push(resume.summary)
  if (resume.skills) parts.push(resume.skills)
  if (resume.workExperience?.length) {
    for (const exp of resume.workExperience) {
      if (exp.position) parts.push(exp.position)
      if (exp.description) parts.push(exp.description)
      if (exp.achievements) parts.push(exp.achievements)
    }
  }
  return parts.join(' ').toLowerCase()
}

function inferDirectionHints(resume: ResumeDoc | null): DirectionHint[] {
  if (!resume) return []

  const text = getResumeText(resume)

  const scores: Record<string, number> = {
    cleaning: 0,
    construction: 0,
    customer_service: 0,
    driving: 0,
    food_service: 0,
    forklift: 0,
    healthcare_support: 0,
    retail: 0,
    warehouse: 0,
  }

  // Warehouse / logistics
  if (text.includes('warehouse')) scores.warehouse += 3
  if (text.includes('shipping') || text.includes('receiving')) scores.warehouse += 2
  if (text.includes('inventory') || text.includes('picker') || text.includes('packing'))
    scores.warehouse += 2

  // Forklift
  if (text.includes('forklift')) scores.forklift += 4
  if (text.includes('pallet') || text.includes('reach truck')) scores.forklift += 2

  // Construction
  if (text.includes('construction') || text.includes('laborer') || text.includes('framing'))
    scores.construction += 3

  // Food service
  if (text.includes('restaurant') || text.includes('kitchen') || text.includes('dishwasher'))
    scores.food_service += 3
  if (text.includes('cook') || text.includes('prep') || text.includes('server'))
    scores.food_service += 2

  // Retail
  if (text.includes('cashier') || text.includes('stocking') || text.includes('merchandising'))
    scores.retail += 3
  if (text.includes('sales') || text.includes('store')) scores.retail += 1

  // Customer service
  if (
    text.includes('customer service') ||
    text.includes('call center') ||
    text.includes('front desk')
  )
    scores.customer_service += 3

  // Driving / delivery
  if (text.includes('driver') || text.includes('delivery') || text.includes('route'))
    scores.driving += 3
  if (text.includes('cdl') || text.includes('truck')) scores.driving += 2

  // Cleaning / maintenance
  if (text.includes('janitor') || text.includes('cleaning') || text.includes('maintenance'))
    scores.cleaning += 3
  if (text.includes('custodian') || text.includes('housekeeping')) scores.cleaning += 2

  // Healthcare support (non-clinical)
  if (text.includes('patient') || text.includes('clinic') || text.includes('hospital'))
    scores.healthcare_support += 2
  if (text.includes('cna') || text.includes('medical assistant')) scores.healthcare_support += 3

  const labelMap: Record<string, string> = {
    cleaning: 'Cleaning / maintenance',
    construction: 'Construction / general labor',
    customer_service: 'Customer service / front desk',
    driving: 'Delivery / driving',
    food_service: 'Food service',
    forklift: 'Forklift operator',
    healthcare_support: 'Healthcare support (non-clinical)',
    retail: 'Retail',
    warehouse: 'Warehouse / logistics',
  }

  const ranked = Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return ranked.map(([key, score]) => ({
    confidence: score >= 4 ? 'high' : 'medium',
    id: key,
    label: labelMap[key] ?? key,
  }))
}

export function buildUserContext(data: ContextInput): string {
  const sections: string[] = []

  sections.push('<user-context>')
  sections.push(
    'This is automatically injected context about the current user. Use this to decide your next step.',
  )
  sections.push('')

  // Profile Completeness section
  const resumeUploaded = Boolean(data.resume)
  const locationSet = Boolean(data.profile?.homeLat && data.profile?.homeLon)

  sections.push('## Profile Completeness')
  sections.push(`- Resume: ${resumeUploaded ? 'Uploaded' : 'NOT UPLOADED'}`)
  sections.push(
    `- Location: ${locationSet ? `Set (${data.profile?.location ?? 'coordinates available'})` : 'NOT SET'}`,
  )
  sections.push(`- Preferences: ${data.preferences ? 'Some saved' : 'None saved'}`)
  sections.push('')

  // Derived Hints section (new)
  const hints = inferDirectionHints(data.resume)
  const topHint = hints[0] // Highest-scoring hint (if any)
  const hasAnyHint = hints.length > 0
  const fairChanceRequired = Boolean(data.preferences?.requireSecondChance)

  sections.push('## Derived Hints')
  if (hints.length === 0) {
    sections.push('- Job direction hints: None (resume missing or unclear)')
    sections.push('- auto_pick_direction: None available')
  } else {
    sections.push('- Job direction hints:')
    for (const h of hints) {
      sections.push(`  - ${h.label} (${h.confidence})`)
    }
    // Provide explicit auto-pick instruction for when user defers
    sections.push(`- auto_pick_direction: "${topHint.label}" (use this if user defers to you)`)
  }
  sections.push('- Search readiness:')
  sections.push(
    `  - direction_ready: ${hasAnyHint ? `YES - use "${topHint.label}" if user defers` : 'NO (need to ask or search broad)'}`,
  )
  sections.push(`  - location_ready: ${locationSet ? 'YES' : 'NO'}`)
  sections.push(`  - fair_chance_required: ${fairChanceRequired ? 'YES' : 'NO/UNKNOWN'}`)
  sections.push('')

  // Resume section
  sections.push('## Resume')
  if (data.resume) {
    const skills = data.resume.skills?.slice(0, 100) || 'None listed'
    const experienceCount = data.resume.workExperience?.length || 0
    const recentJob = data.resume.workExperience?.[0]

    sections.push(
      `- Work history: ${experienceCount} position${experienceCount !== 1 ? 's' : ''} listed`,
    )
    if (recentJob) {
      sections.push(
        `- Most recent: ${recentJob.position || 'Untitled'} at ${recentJob.company || 'Unknown'}`,
      )
    }
    sections.push(`- Skills: ${skills}`)
    if (data.resume.summary) {
      sections.push(
        `- Summary: ${data.resume.summary.slice(0, 150)}${data.resume.summary.length > 150 ? '...' : ''}`,
      )
    }
  } else {
    sections.push('- Status: Not uploaded yet')
  }
  sections.push('')

  // Location section
  sections.push('## Location')
  if (locationSet) {
    const city = data.profile?.location || 'Location set'
    sections.push(`- Home location: ${city}`)
  } else {
    sections.push('- Home location: NOT SET')
  }
  sections.push('')

  // Preferences section
  sections.push('## Preferences')
  if (data.preferences) {
    if (data.preferences.requireSecondChance) {
      sections.push('- Fair-chance employers: REQUIRED')
    } else if (data.preferences.preferSecondChance) {
      sections.push('- Fair-chance employers: Preferred')
    } else {
      sections.push('- Fair-chance employers: No specific preference')
    }

    if (data.preferences.maxCommuteMinutes) {
      sections.push(`- Max commute: ${data.preferences.maxCommuteMinutes} minutes`)
    }

    const shifts: string[] = []
    if (data.preferences.shiftMorning) shifts.push('morning')
    if (data.preferences.shiftAfternoon) shifts.push('afternoon')
    if (data.preferences.shiftEvening) shifts.push('evening')
    if (data.preferences.shiftOvernight) shifts.push('overnight')
    if (data.preferences.shiftFlexible) shifts.push('flexible')

    if (shifts.length > 0) {
      sections.push(`- Preferred shifts: ${shifts.join(', ')}`)
    }

    if (data.preferences.preferredJobTypes?.length) {
      sections.push(`- Job types interested in: ${data.preferences.preferredJobTypes.join(', ')}`)
    }
  } else {
    sections.push('- Status: No preferences saved yet')
  }
  sections.push('')

  // Session section
  sections.push('## This Session')
  sections.push(`- Searches performed: ${data.searchCount}`)

  const minutesElapsed = Math.floor((Date.now() - data.sessionStarted.getTime()) / 60000)
  if (minutesElapsed > 5) {
    sections.push(`- Session duration: ${minutesElapsed} minutes`)
  }

  sections.push('</user-context>')

  return sections.join('\n')
}
