import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Car, Clock, Loader2, Shield, Zap } from 'lucide-react'
import { useEffect, useId } from 'react'


import { api } from '../../../convex/_generated/api'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '../ui/drawer'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { ReactNode } from 'react'
import type { FilterCategory } from './FilterSummaryBanner'

interface FilterDrawerProps {
  category: FilterCategory | null
  onClose: () => void
}

interface CategoryInfo {
  title: string
  description: string
  icon: ReactNode
}

const categoryInfo: Record<FilterCategory, CategoryInfo> = {
  fairChance: {
    title: 'Fair Chance',
    description: 'Fair-chance employers are open to hiring people with criminal backgrounds.',
    icon: <Shield className='h-5 w-5' />,
  },
  commute: {
    title: 'Commute',
    description: 'Set your maximum commute time and transit preferences.',
    icon: <Car className='h-5 w-5' />,
  },
  schedule: {
    title: 'Schedule',
    description: "Select the shifts you're available to work.",
    icon: <Clock className='h-5 w-5' />,
  },
  quickApply: {
    title: 'Quick Apply',
    description: 'Prioritize jobs that are hiring urgently or have easy applications.',
    icon: <Zap className='h-5 w-5' />,
  },
}

export function FilterDrawer({ category, onClose }: FilterDrawerProps) {
  const formId = useId()
  const queryClient = useQueryClient()

  const { data: preferences } = useQuery(convexQuery(api.jobPreferences.get, {}))

  const { mutate: upsert, isPending } = useMutation({
    mutationFn: useConvexMutation(api.jobPreferences.upsert),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.jobPreferences.get, {}).queryKey,
      })
      toast.success('Saved', {
        description: 'Your preferences have been updated.',
      })
      onClose()
    },
  })

  const form = useForm({
    defaultValues: {
      // Fair Chance
      preferSecondChance: preferences?.preferSecondChance ?? false,
      requireSecondChance: preferences?.requireSecondChance ?? false,
      // Commute
      maxCommuteMinutes: preferences?.maxCommuteMinutes ?? null,
      requirePublicTransit: preferences?.requirePublicTransit ?? false,
      requireBusAccessible: preferences?.requireBusAccessible ?? false,
      requireRailAccessible: preferences?.requireRailAccessible ?? false,
      // Schedule
      shiftMorning: preferences?.shiftMorning ?? false,
      shiftAfternoon: preferences?.shiftAfternoon ?? false,
      shiftEvening: preferences?.shiftEvening ?? false,
      shiftOvernight: preferences?.shiftOvernight ?? false,
      shiftFlexible: preferences?.shiftFlexible ?? false,
      // Quick Apply
      preferUrgent: preferences?.preferUrgent ?? false,
      preferEasyApply: preferences?.preferEasyApply ?? false,
    },
    onSubmit: async ({ value }) => {
      const data: Record<string, unknown> = {}

      if (form.getFieldMeta('maxCommuteMinutes')?.isDirty) {
        data.maxCommuteMinutes = value.maxCommuteMinutes
      }

      const booleanFields = [
        'requirePublicTransit',
        'preferSecondChance',
        'requireSecondChance',
        'shiftMorning',
        'shiftAfternoon',
        'shiftEvening',
        'shiftOvernight',
        'shiftFlexible',
        'requireBusAccessible',
        'requireRailAccessible',
        'preferUrgent',
        'preferEasyApply',
      ] as const

      for (const field of booleanFields) {
        if (form.getFieldMeta(field)?.isDirty) {
          data[field] = value[field]
        }
      }

      if (Object.keys(data).length > 0) {
        upsert(data as Parameters<typeof upsert>[0])
      } else {
        onClose()
      }
    },
  })

  // Reset form when preferences load
  useEffect(() => {
    if (preferences) {
      form.reset({
        preferSecondChance: preferences.preferSecondChance ?? false,
        requireSecondChance: preferences.requireSecondChance ?? false,
        maxCommuteMinutes: preferences.maxCommuteMinutes ?? null,
        requirePublicTransit: preferences.requirePublicTransit ?? false,
        requireBusAccessible: preferences.requireBusAccessible ?? false,
        requireRailAccessible: preferences.requireRailAccessible ?? false,
        shiftMorning: preferences.shiftMorning ?? false,
        shiftAfternoon: preferences.shiftAfternoon ?? false,
        shiftEvening: preferences.shiftEvening ?? false,
        shiftOvernight: preferences.shiftOvernight ?? false,
        shiftFlexible: preferences.shiftFlexible ?? false,
        preferUrgent: preferences.preferUrgent ?? false,
        preferEasyApply: preferences.preferEasyApply ?? false,
      })
    }
  }, [preferences, form])

  const info = category ? categoryInfo[category] : null

  return (
    <Drawer onOpenChange={open => !open && onClose()} open={category !== null}>
      <DrawerContent>
        {info && (
          <>
            <DrawerHeader>
              <DrawerTitle className='flex items-center gap-2'>
                {info.icon}
                {info.title}
              </DrawerTitle>
              <DrawerDescription>{info.description}</DrawerDescription>
            </DrawerHeader>

            <form
              className='px-4 pb-4'
              onSubmit={e => {
                e.preventDefault()
                form.handleSubmit()
              }}
            >
              {/* Fair Chance Fields */}
              {category === 'fairChance' && (
                <div className='space-y-4'>
                  <form.Field name='preferSecondChance'>
                    {field => (
                      <div className='flex items-center space-x-3'>
                        <Checkbox
                          checked={field.state.value}
                          id={`${formId}-preferSecondChance`}
                          onCheckedChange={checked => field.handleChange(!!checked)}
                        />
                        <Label
                          className='leading-normal'
                          htmlFor={`${formId}-preferSecondChance`}
                        >
                          Prioritize fair-chance employers
                        </Label>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name='requireSecondChance'>
                    {field => (
                      <div className='flex items-center space-x-3'>
                        <Checkbox
                          checked={field.state.value}
                          id={`${formId}-requireSecondChance`}
                          onCheckedChange={checked => field.handleChange(!!checked)}
                        />
                        <Label
                          className='leading-normal'
                          htmlFor={`${formId}-requireSecondChance`}
                        >
                          Only show fair-chance employers
                        </Label>
                      </div>
                    )}
                  </form.Field>
                </div>
              )}

              {/* Commute Fields */}
              {category === 'commute' && (
                <div className='space-y-4'>
                  <form.Field name='maxCommuteMinutes'>
                    {field => (
                      <div className='space-y-2'>
                        <Label htmlFor={`${formId}-maxCommute`}>Maximum commute time</Label>
                        <Select
                          onValueChange={v =>
                            field.handleChange(
                              v === 'none' ? null : (parseInt(v) as 10 | 30 | 60)
                            )
                          }
                          value={field.state.value?.toString() ?? 'none'}
                        >
                          <SelectTrigger id={`${formId}-maxCommute`}>
                            <SelectValue placeholder='No limit' />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='none'>No limit</SelectItem>
                            <SelectItem value='10'>10 minutes</SelectItem>
                            <SelectItem value='30'>30 minutes</SelectItem>
                            <SelectItem value='60'>60 minutes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name='requirePublicTransit'>
                    {field => (
                      <div className='flex items-center space-x-3'>
                        <Checkbox
                          checked={field.state.value}
                          id={`${formId}-requirePublicTransit`}
                          onCheckedChange={checked => field.handleChange(!!checked)}
                        />
                        <Label
                          className='leading-normal'
                          htmlFor={`${formId}-requirePublicTransit`}
                        >
                          Only show jobs reachable by public transit
                        </Label>
                      </div>
                    )}
                  </form.Field>

                  <div className='flex gap-6'>
                    <form.Field name='requireBusAccessible'>
                      {field => (
                        <div className='flex items-center space-x-3'>
                          <Checkbox
                            checked={field.state.value}
                            id={`${formId}-requireBusAccessible`}
                            onCheckedChange={checked => field.handleChange(!!checked)}
                          />
                          <Label
                            className='leading-normal'
                            htmlFor={`${formId}-requireBusAccessible`}
                          >
                            Bus
                          </Label>
                        </div>
                      )}
                    </form.Field>

                    <form.Field name='requireRailAccessible'>
                      {field => (
                        <div className='flex items-center space-x-3'>
                          <Checkbox
                            checked={field.state.value}
                            id={`${formId}-requireRailAccessible`}
                            onCheckedChange={checked => field.handleChange(!!checked)}
                          />
                          <Label
                            className='leading-normal'
                            htmlFor={`${formId}-requireRailAccessible`}
                          >
                            Rail
                          </Label>
                        </div>
                      )}
                    </form.Field>
                  </div>
                </div>
              )}

              {/* Schedule Fields */}
              {category === 'schedule' && (
                <div className='grid grid-cols-2 gap-4'>
                  <form.Field name='shiftMorning'>
                    {field => (
                      <div className='flex items-center space-x-3'>
                        <Checkbox
                          checked={field.state.value}
                          id={`${formId}-shiftMorning`}
                          onCheckedChange={checked => field.handleChange(!!checked)}
                        />
                        <Label className='leading-normal' htmlFor={`${formId}-shiftMorning`}>
                          Morning
                        </Label>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name='shiftAfternoon'>
                    {field => (
                      <div className='flex items-center space-x-3'>
                        <Checkbox
                          checked={field.state.value}
                          id={`${formId}-shiftAfternoon`}
                          onCheckedChange={checked => field.handleChange(!!checked)}
                        />
                        <Label className='leading-normal' htmlFor={`${formId}-shiftAfternoon`}>
                          Afternoon
                        </Label>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name='shiftEvening'>
                    {field => (
                      <div className='flex items-center space-x-3'>
                        <Checkbox
                          checked={field.state.value}
                          id={`${formId}-shiftEvening`}
                          onCheckedChange={checked => field.handleChange(!!checked)}
                        />
                        <Label className='leading-normal' htmlFor={`${formId}-shiftEvening`}>
                          Evening
                        </Label>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name='shiftOvernight'>
                    {field => (
                      <div className='flex items-center space-x-3'>
                        <Checkbox
                          checked={field.state.value}
                          id={`${formId}-shiftOvernight`}
                          onCheckedChange={checked => field.handleChange(!!checked)}
                        />
                        <Label className='leading-normal' htmlFor={`${formId}-shiftOvernight`}>
                          Overnight
                        </Label>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name='shiftFlexible'>
                    {field => (
                      <div className='col-span-2 flex items-center space-x-3'>
                        <Checkbox
                          checked={field.state.value}
                          id={`${formId}-shiftFlexible`}
                          onCheckedChange={checked => field.handleChange(!!checked)}
                        />
                        <Label className='leading-normal' htmlFor={`${formId}-shiftFlexible`}>
                          Flexible schedule
                        </Label>
                      </div>
                    )}
                  </form.Field>
                </div>
              )}

              {/* Quick Apply Fields */}
              {category === 'quickApply' && (
                <div className='space-y-4'>
                  <form.Field name='preferUrgent'>
                    {field => (
                      <div className='flex items-center space-x-3'>
                        <Checkbox
                          checked={field.state.value}
                          id={`${formId}-preferUrgent`}
                          onCheckedChange={checked => field.handleChange(!!checked)}
                        />
                        <Label className='leading-normal' htmlFor={`${formId}-preferUrgent`}>
                          Prioritize urgent hiring
                        </Label>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name='preferEasyApply'>
                    {field => (
                      <div className='flex items-center space-x-3'>
                        <Checkbox
                          checked={field.state.value}
                          id={`${formId}-preferEasyApply`}
                          onCheckedChange={checked => field.handleChange(!!checked)}
                        />
                        <Label className='leading-normal' htmlFor={`${formId}-preferEasyApply`}>
                          Prioritize easy apply jobs
                        </Label>
                      </div>
                    )}
                  </form.Field>
                </div>
              )}

              <DrawerFooter className='px-0'>
                <Button disabled={isPending} type='submit'>
                  {isPending ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Saving...
                    </>
                  ) : (
                    'Apply'
                  )}
                </Button>
                <DrawerClose asChild>
                  <Button type='button' variant='outline'>
                    Cancel
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </form>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
