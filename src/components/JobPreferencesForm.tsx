import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Save } from 'lucide-react'
import { useEffect, useId } from 'react'
import { useToast } from '~/hooks/use-toast'
import { api } from '../../convex/_generated/api'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

export function JobPreferencesForm() {
  const { toast } = useToast()
  const formId = useId()

  const { data: preferences, isLoading } = useQuery(convexQuery(api.jobPreferences.get, {}))

  const { mutate: upsert, isPending } = useMutation({
    mutationFn: useConvexMutation(api.jobPreferences.upsert),
    onSuccess: () => {
      toast({
        description: 'Your job search preferences have been updated.',
        title: 'Preferences saved',
      })
    },
  })

  const form = useForm({
    defaultValues: {
      maxCommuteMinutes: preferences?.maxCommuteMinutes ?? undefined,
      preferEasyApply: preferences?.preferEasyApply ?? false,
      preferSecondChance: preferences?.preferSecondChance ?? false,
      preferUrgent: preferences?.preferUrgent ?? false,
      requireBusAccessible: preferences?.requireBusAccessible ?? false,
      requirePublicTransit: preferences?.requirePublicTransit ?? false,
      requireRailAccessible: preferences?.requireRailAccessible ?? false,
      requireSecondChance: preferences?.requireSecondChance ?? false,
      shiftAfternoon: preferences?.shiftAfternoon ?? false,
      shiftEvening: preferences?.shiftEvening ?? false,
      shiftFlexible: preferences?.shiftFlexible ?? false,
      shiftMorning: preferences?.shiftMorning ?? false,
      shiftOvernight: preferences?.shiftOvernight ?? false,
    },
    onSubmit: async ({ value }) => {
      // Only send fields the user actually modified (isDirty)
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
      }
    },
  })

  // Reset form when preferences data loads (defaultValues only applies on initial render)
  useEffect(() => {
    if (preferences) {
      form.reset({
        maxCommuteMinutes: preferences.maxCommuteMinutes ?? undefined,
        preferEasyApply: preferences.preferEasyApply ?? false,
        preferSecondChance: preferences.preferSecondChance ?? false,
        preferUrgent: preferences.preferUrgent ?? false,
        requireBusAccessible: preferences.requireBusAccessible ?? false,
        requirePublicTransit: preferences.requirePublicTransit ?? false,
        requireRailAccessible: preferences.requireRailAccessible ?? false,
        requireSecondChance: preferences.requireSecondChance ?? false,
        shiftAfternoon: preferences.shiftAfternoon ?? false,
        shiftEvening: preferences.shiftEvening ?? false,
        shiftFlexible: preferences.shiftFlexible ?? false,
        shiftMorning: preferences.shiftMorning ?? false,
        shiftOvernight: preferences.shiftOvernight ?? false,
      })
    }
  }, [preferences, form])

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <div className='space-y-6'>
        {/* Commute Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Commute</CardTitle>
            <CardDescription>
              Set your maximum commute time and transit preferences. Make sure to set your home
              location on your profile first!
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <form.Field name='maxCommuteMinutes'>
              {field => (
                <div className='space-y-2'>
                  <Label htmlFor={`${formId}-maxCommute`}>Maximum commute time</Label>
                  <Select
                    onValueChange={v =>
                      field.handleChange(v === 'none' ? undefined : (parseInt(v) as 10 | 30 | 60))
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
                <div className='flex items-center space-x-2'>
                  <Checkbox
                    checked={field.state.value}
                    id={`${formId}-requirePublicTransit`}
                    onCheckedChange={checked => field.handleChange(!!checked)}
                  />
                  <Label htmlFor={`${formId}-requirePublicTransit`}>
                    Only show jobs reachable by public transit
                  </Label>
                </div>
              )}
            </form.Field>

            <div className='flex gap-4'>
              <form.Field name='requireBusAccessible'>
                {field => (
                  <div className='flex items-center space-x-2'>
                    <Checkbox
                      checked={field.state.value}
                      id={`${formId}-requireBusAccessible`}
                      onCheckedChange={checked => field.handleChange(!!checked)}
                    />
                    <Label htmlFor={`${formId}-requireBusAccessible`}>Require bus access</Label>
                  </div>
                )}
              </form.Field>

              <form.Field name='requireRailAccessible'>
                {field => (
                  <div className='flex items-center space-x-2'>
                    <Checkbox
                      checked={field.state.value}
                      id={`${formId}-requireRailAccessible`}
                      onCheckedChange={checked => field.handleChange(!!checked)}
                    />
                    <Label htmlFor={`${formId}-requireRailAccessible`}>Require rail access</Label>
                  </div>
                )}
              </form.Field>
            </div>
          </CardContent>
        </Card>

        {/* Second Chance Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Second Chance Employers</CardTitle>
            <CardDescription>
              Second-chance employers are open to hiring people with criminal backgrounds.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <form.Field name='preferSecondChance'>
              {field => (
                <div className='flex items-center space-x-2'>
                  <Checkbox
                    checked={field.state.value}
                    id={`${formId}-preferSecondChance`}
                    onCheckedChange={checked => field.handleChange(!!checked)}
                  />
                  <Label htmlFor={`${formId}-preferSecondChance`}>
                    Prioritize second-chance employers in results
                  </Label>
                </div>
              )}
            </form.Field>

            <form.Field name='requireSecondChance'>
              {field => (
                <div className='flex items-center space-x-2'>
                  <Checkbox
                    checked={field.state.value}
                    id={`${formId}-requireSecondChance`}
                    onCheckedChange={checked => field.handleChange(!!checked)}
                  />
                  <Label htmlFor={`${formId}-requireSecondChance`}>
                    Only show second-chance employers
                  </Label>
                </div>
              )}
            </form.Field>
          </CardContent>
        </Card>

        {/* Shift Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Shift Availability</CardTitle>
            <CardDescription>
              Select the shifts you're available to work. Leave all unchecked for no preference.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 gap-4'>
              <form.Field name='shiftMorning'>
                {field => (
                  <div className='flex items-center space-x-2'>
                    <Checkbox
                      checked={field.state.value}
                      id={`${formId}-shiftMorning`}
                      onCheckedChange={checked => field.handleChange(!!checked)}
                    />
                    <Label htmlFor={`${formId}-shiftMorning`}>Morning</Label>
                  </div>
                )}
              </form.Field>

              <form.Field name='shiftAfternoon'>
                {field => (
                  <div className='flex items-center space-x-2'>
                    <Checkbox
                      checked={field.state.value}
                      id={`${formId}-shiftAfternoon`}
                      onCheckedChange={checked => field.handleChange(!!checked)}
                    />
                    <Label htmlFor={`${formId}-shiftAfternoon`}>Afternoon</Label>
                  </div>
                )}
              </form.Field>

              <form.Field name='shiftEvening'>
                {field => (
                  <div className='flex items-center space-x-2'>
                    <Checkbox
                      checked={field.state.value}
                      id={`${formId}-shiftEvening`}
                      onCheckedChange={checked => field.handleChange(!!checked)}
                    />
                    <Label htmlFor={`${formId}-shiftEvening`}>Evening</Label>
                  </div>
                )}
              </form.Field>

              <form.Field name='shiftOvernight'>
                {field => (
                  <div className='flex items-center space-x-2'>
                    <Checkbox
                      checked={field.state.value}
                      id={`${formId}-shiftOvernight`}
                      onCheckedChange={checked => field.handleChange(!!checked)}
                    />
                    <Label htmlFor={`${formId}-shiftOvernight`}>Overnight</Label>
                  </div>
                )}
              </form.Field>

              <form.Field name='shiftFlexible'>
                {field => (
                  <div className='flex items-center space-x-2'>
                    <Checkbox
                      checked={field.state.value}
                      id={`${formId}-shiftFlexible`}
                      onCheckedChange={checked => field.handleChange(!!checked)}
                    />
                    <Label htmlFor={`${formId}-shiftFlexible`}>Flexible</Label>
                  </div>
                )}
              </form.Field>
            </div>
          </CardContent>
        </Card>

        {/* Other Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Other Preferences</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <form.Field name='preferUrgent'>
              {field => (
                <div className='flex items-center space-x-2'>
                  <Checkbox
                    checked={field.state.value}
                    id={`${formId}-preferUrgent`}
                    onCheckedChange={checked => field.handleChange(!!checked)}
                  />
                  <Label htmlFor={`${formId}-preferUrgent`}>Prioritize urgent hiring</Label>
                </div>
              )}
            </form.Field>

            <form.Field name='preferEasyApply'>
              {field => (
                <div className='flex items-center space-x-2'>
                  <Checkbox
                    checked={field.state.value}
                    id={`${formId}-preferEasyApply`}
                    onCheckedChange={checked => field.handleChange(!!checked)}
                  />
                  <Label htmlFor={`${formId}-preferEasyApply`}>Prioritize easy apply jobs</Label>
                </div>
              )}
            </form.Field>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button className='w-full' disabled={isPending} type='submit'>
          {isPending ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Saving...
            </>
          ) : (
            <>
              <Save className='mr-2 h-4 w-4' />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
