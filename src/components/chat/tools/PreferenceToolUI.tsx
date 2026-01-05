'use client'

import { makeAssistantToolUI } from '@assistant-ui/react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import { useId, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import { Button } from '../../ui/button'
import { Card } from '../../ui/card'
import { Checkbox } from '../../ui/checkbox'
import { Label } from '../../ui/label'
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group'

type PreferenceType = 'shift' | 'commute' | 'fairChance'

interface PreferenceArgs {
  preference: PreferenceType
  context?: string
}

interface ShiftResult {
  type: 'shift'
  shiftMorning: boolean
  shiftAfternoon: boolean
  shiftEvening: boolean
  shiftOvernight: boolean
  shiftFlexible: boolean
}

interface CommuteResult {
  type: 'commute'
  maxCommuteMinutes: 10 | 30 | 60 | null
  requirePublicTransit: boolean
}

interface FairChanceResult {
  type: 'fairChance'
  requireSecondChance: boolean
  preferSecondChance: boolean
}

type PreferenceResult = ShiftResult | CommuteResult | FairChanceResult

const SHIFT_OPTIONS = [
  { description: '6am – 12pm', key: 'shiftMorning' as const, label: 'Morning' },
  { description: '12pm – 6pm', key: 'shiftAfternoon' as const, label: 'Afternoon' },
  { description: '6pm – 12am', key: 'shiftEvening' as const, label: 'Evening' },
  { description: '12am – 6am', key: 'shiftOvernight' as const, label: 'Overnight' },
  { description: 'Any shift works', key: 'shiftFlexible' as const, label: 'Flexible' },
] as const

const COMMUTE_OPTIONS = [
  { description: 'Very close to home', label: '10 minutes', minutes: 10 as const },
  { description: 'Moderate commute', label: '30 minutes', minutes: 30 as const },
  { description: 'Willing to travel further', label: '60 minutes', minutes: 60 as const },
] as const

const FAIR_CHANCE_OPTIONS = [
  {
    description: 'Only show fair-chance employers',
    label: 'Required',
    mode: 'require' as const,
  },
  {
    description: 'Prioritize fair-chance, but show all',
    label: 'Preferred',
    mode: 'prefer' as const,
  },
  {
    description: 'Show all employers',
    label: 'No preference',
    mode: 'none' as const,
  },
] as const

interface ShiftFormProps {
  onSubmit: (result: ShiftResult) => void
}

function ShiftForm({ onSubmit }: ShiftFormProps) {
  const formId = useId()
  const [selected, setSelected] = useState<Record<string, boolean>>({
    shiftAfternoon: false,
    shiftEvening: false,
    shiftFlexible: false,
    shiftMorning: false,
    shiftOvernight: false,
  })

  const handleSubmit = () => {
    onSubmit({
      shiftAfternoon: selected.shiftAfternoon,
      shiftEvening: selected.shiftEvening,
      shiftFlexible: selected.shiftFlexible,
      shiftMorning: selected.shiftMorning,
      shiftOvernight: selected.shiftOvernight,
      type: 'shift',
    })
  }

  const hasSelection = Object.values(selected).some(Boolean)

  return (
    <div className='space-y-3'>
      <p className='text-sm font-medium'>Select all shifts you can work:</p>
      <div className='space-y-2'>
        {SHIFT_OPTIONS.map(opt => (
          <div className='flex items-center space-x-3' key={opt.key}>
            <Checkbox
              checked={selected[opt.key]}
              id={`${formId}-${opt.key}`}
              onCheckedChange={checked => setSelected(prev => ({ ...prev, [opt.key]: !!checked }))}
            />
            <Label className='flex-1 cursor-pointer' htmlFor={`${formId}-${opt.key}`}>
              <span className='font-medium'>{opt.label}</span>
              <span className='text-muted-foreground text-sm ml-2'>{opt.description}</span>
            </Label>
          </div>
        ))}
      </div>
      <Button className='w-full' disabled={!hasSelection} onClick={handleSubmit}>
        Save Shift Preferences
      </Button>
    </div>
  )
}

interface CommuteFormProps {
  onSubmit: (result: CommuteResult) => void
}

function CommuteForm({ onSubmit }: CommuteFormProps) {
  const formId = useId()
  const [minutes, setMinutes] = useState<10 | 30 | 60 | null>(null)
  const [requireTransit, setRequireTransit] = useState(false)

  const handleSubmit = () => {
    onSubmit({
      maxCommuteMinutes: minutes,
      requirePublicTransit: requireTransit,
      type: 'commute',
    })
  }

  return (
    <div className='space-y-4'>
      <div className='space-y-3'>
        <p className='text-sm font-medium'>Maximum commute time:</p>
        <RadioGroup
          onValueChange={v => setMinutes(parseInt(v, 10) as 10 | 30 | 60)}
          value={minutes?.toString() ?? ''}
        >
          {COMMUTE_OPTIONS.map(opt => (
            <div className='flex items-center space-x-3' key={opt.minutes}>
              <RadioGroupItem
                id={`${formId}-commute-${opt.minutes}`}
                value={opt.minutes.toString()}
              />
              <Label className='flex-1 cursor-pointer' htmlFor={`${formId}-commute-${opt.minutes}`}>
                <span className='font-medium'>{opt.label}</span>
                <span className='text-muted-foreground text-sm ml-2'>{opt.description}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className='flex items-center space-x-3 pt-2 border-t'>
        <Checkbox
          checked={requireTransit}
          id={`${formId}-require-transit`}
          onCheckedChange={checked => setRequireTransit(!!checked)}
        />
        <Label className='cursor-pointer' htmlFor={`${formId}-require-transit`}>
          I need public transit access
        </Label>
      </div>

      <Button className='w-full' disabled={!minutes} onClick={handleSubmit}>
        Save Commute Preferences
      </Button>
    </div>
  )
}

interface FairChanceFormProps {
  onSubmit: (result: FairChanceResult) => void
}

function FairChanceForm({ onSubmit }: FairChanceFormProps) {
  const formId = useId()
  const [mode, setMode] = useState<'require' | 'prefer' | 'none' | null>(null)

  const handleSubmit = () => {
    if (!mode) return
    onSubmit({
      preferSecondChance: mode === 'prefer',
      requireSecondChance: mode === 'require',
      type: 'fairChance',
    })
  }

  return (
    <div className='space-y-3'>
      <p className='text-sm font-medium'>Fair-chance employer preference:</p>
      <RadioGroup onValueChange={v => setMode(v as typeof mode)} value={mode ?? ''}>
        {FAIR_CHANCE_OPTIONS.map(opt => (
          <div className='flex items-center space-x-3' key={opt.mode}>
            <RadioGroupItem id={`${formId}-fc-${opt.mode}`} value={opt.mode} />
            <Label className='flex-1 cursor-pointer' htmlFor={`${formId}-fc-${opt.mode}`}>
              <span className='font-medium'>{opt.label}</span>
              <span className='text-muted-foreground text-sm ml-2'>{opt.description}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
      <Button className='w-full' disabled={!mode} onClick={handleSubmit}>
        Save Preference
      </Button>
    </div>
  )
}

function CompletedShift({ result }: { result: ShiftResult }) {
  const shifts = SHIFT_OPTIONS.filter(opt => result[opt.key]).map(opt => opt.label)
  return (
    <div className='flex items-center gap-2 text-sm'>
      <Check className='h-4 w-4 text-green-600' />
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
    <div className='flex items-center gap-2 text-sm'>
      <Check className='h-4 w-4 text-green-600' />
      <span>Commute: {parts.length > 0 ? parts.join(', ') : 'No limit'}</span>
    </div>
  )
}

function CompletedFairChance({ result }: { result: FairChanceResult }) {
  let text = 'No preference'
  if (result.requireSecondChance) text = 'Required'
  else if (result.preferSecondChance) text = 'Preferred'
  return (
    <div className='flex items-center gap-2 text-sm'>
      <Check className='h-4 w-4 text-green-600' />
      <span>Fair Chance: {text}</span>
    </div>
  )
}

function PendingPreference({
  preference,
  selections,
}: {
  preference: PreferenceType
  selections: string
}) {
  const title =
    preference === 'shift' ? 'Shifts' : preference === 'commute' ? 'Commute' : 'Fair Chance'
  return (
    <Card className='p-4 bg-muted/30'>
      <div className='flex items-center gap-2 text-sm'>
        <Loader2 className='h-4 w-4 animate-spin' />
        <span>
          {title}: {selections}
        </span>
      </div>
      <p className='mt-3 text-xs text-muted-foreground flex items-center gap-1.5'>
        <span className='inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse' />
        Processing your selection...
      </p>
    </Card>
  )
}

export const PreferenceToolUI = makeAssistantToolUI<PreferenceArgs, PreferenceResult>({
  render: ({ args, result, addResult }) => {
    const [isPending, setIsPending] = useState(false)
    const [pendingSelections, setPendingSelections] = useState('')
    const queryClient = useQueryClient()
    const upsertMutation = useConvexMutation(api.jobPreferences.upsert)

    const { mutateAsync: saveToDb } = useMutation({
      mutationFn: upsertMutation,
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: convexQuery(api.jobPreferences.get, {}).queryKey,
        })
      },
    })

    const handleSubmit = async (preferenceResult: PreferenceResult) => {
      let selections = ''
      if (preferenceResult.type === 'shift') {
        const shifts = SHIFT_OPTIONS.filter(opt => preferenceResult[opt.key]).map(opt => opt.label)
        selections = shifts.length > 0 ? shifts.join(', ') : 'Any'
      } else if (preferenceResult.type === 'commute') {
        const parts = []
        if (preferenceResult.maxCommuteMinutes) {
          parts.push(`${preferenceResult.maxCommuteMinutes} min max`)
        }
        if (preferenceResult.requirePublicTransit) {
          parts.push('transit required')
        }
        selections = parts.length > 0 ? parts.join(', ') : 'No limit'
      } else if (preferenceResult.type === 'fairChance') {
        if (preferenceResult.requireSecondChance) selections = 'Required'
        else if (preferenceResult.preferSecondChance) selections = 'Preferred'
        else selections = 'No preference'
      }

      setPendingSelections(selections)
      setIsPending(true)

      if (preferenceResult.type === 'shift') {
        await saveToDb({
          shiftAfternoon: preferenceResult.shiftAfternoon,
          shiftEvening: preferenceResult.shiftEvening,
          shiftFlexible: preferenceResult.shiftFlexible,
          shiftMorning: preferenceResult.shiftMorning,
          shiftOvernight: preferenceResult.shiftOvernight,
        })
      } else if (preferenceResult.type === 'commute') {
        await saveToDb({
          maxCommuteMinutes: preferenceResult.maxCommuteMinutes,
          requirePublicTransit: preferenceResult.requirePublicTransit,
        })
      } else if (preferenceResult.type === 'fairChance') {
        await saveToDb({
          preferSecondChance: preferenceResult.preferSecondChance,
          requireSecondChance: preferenceResult.requireSecondChance,
        })
      }

      addResult(preferenceResult)
    }

    if (result) {
      return (
        <Card className='p-3 bg-muted/50'>
          {result.type === 'shift' && <CompletedShift result={result} />}
          {result.type === 'commute' && <CompletedCommute result={result} />}
          {result.type === 'fairChance' && <CompletedFairChance result={result} />}
        </Card>
      )
    }

    const preference = args?.preference
    const context = args?.context

    if (isPending && preference) {
      return <PendingPreference preference={preference} selections={pendingSelections} />
    }

    return (
      <Card className='p-4'>
        {context && <p className='text-sm text-muted-foreground mb-3'>{context}</p>}
        {preference === 'shift' && <ShiftForm onSubmit={handleSubmit} />}
        {preference === 'commute' && <CommuteForm onSubmit={handleSubmit} />}
        {preference === 'fairChance' && <FairChanceForm onSubmit={handleSubmit} />}
      </Card>
    )
  },
  toolName: 'askPreference',
})
