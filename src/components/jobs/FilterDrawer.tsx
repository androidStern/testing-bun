import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { Car, Clock, Loader2, MapPin, Shield, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { geocodeAddress, getCityFromCoords, getUserLocation } from '@/lib/geo'
import { api } from '../../../convex/_generated/api'
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
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
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
  commute: {
    description: 'Set your maximum commute time and transit preferences.',
    icon: <Car className='h-5 w-5' />,
    title: 'Commute',
  },
  fairChance: {
    description: 'Fair-chance employers are open to hiring people with criminal backgrounds.',
    icon: <Shield className='h-5 w-5' />,
    title: 'Fair Chance',
  },
  location: {
    description: 'Set your home location to find jobs near you.',
    icon: <MapPin className='h-5 w-5' />,
    title: 'Location',
  },
  quickApply: {
    description: 'Prioritize jobs that are hiring urgently or have easy applications.',
    icon: <Zap className='h-5 w-5' />,
    title: 'Quick Apply',
  },
  schedule: {
    description: "Select the shifts you're available to work.",
    icon: <Clock className='h-5 w-5' />,
    title: 'Schedule',
  },
}

export function FilterDrawer({ category, onClose }: FilterDrawerProps) {
  const formId = useId()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: preferences } = useQuery(convexQuery(api.jobPreferences.get, {}))
  const { data: profile } = useQuery(
    convexQuery(api.profiles.getByWorkosUserId, user?.id ? { workosUserId: user.id } : 'skip'),
  )

  const [manualAddress, setManualAddress] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)

  const setLocationMutation = useConvexMutation(api.profiles.setHomeLocation)
  const { mutate: setLocation, isPending: isSettingLocation } = useMutation({
    mutationFn: setLocationMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.profiles.getByWorkosUserId, { workosUserId: user?.id ?? '' })
          .queryKey,
      })
      toast.success('Location updated', {
        description: 'Computing transit accessibility zones...',
      })
      onClose()
    },
  })

  const handleUseMyLocation = async () => {
    setIsLocating(true)
    try {
      const coords = await getUserLocation()
      const cityName = await getCityFromCoords(coords.lat, coords.lon)
      setLocation({ lat: coords.lat, locationName: cityName, lon: coords.lon })
    } catch {
      toast.error('Could not detect location', {
        description: 'Please enter your address manually.',
      })
    } finally {
      setIsLocating(false)
    }
  }

  const handleManualAddress = async () => {
    if (!manualAddress.trim()) return
    setIsGeocoding(true)
    try {
      const coords = await geocodeAddress(manualAddress)
      const cityName = await getCityFromCoords(coords.lat, coords.lon)
      setLocation({ lat: coords.lat, locationName: cityName, lon: coords.lon })
    } catch (error) {
      toast.error('Location not found', {
        description: error instanceof Error ? error.message : 'Please try a different address.',
      })
    } finally {
      setIsGeocoding(false)
    }
  }

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
      // Commute
      maxCommuteMinutes: preferences?.maxCommuteMinutes ?? null,
      preferEasyApply: preferences?.preferEasyApply ?? false,
      // Fair Chance
      preferSecondChance: preferences?.preferSecondChance ?? false,
      // Quick Apply
      preferUrgent: preferences?.preferUrgent ?? false,
      requireBusAccessible: preferences?.requireBusAccessible ?? false,
      requirePublicTransit: preferences?.requirePublicTransit ?? false,
      requireRailAccessible: preferences?.requireRailAccessible ?? false,
      requireSecondChance: preferences?.requireSecondChance ?? false,
      shiftAfternoon: preferences?.shiftAfternoon ?? false,
      shiftEvening: preferences?.shiftEvening ?? false,
      shiftFlexible: preferences?.shiftFlexible ?? false,
      // Schedule
      shiftMorning: preferences?.shiftMorning ?? false,
      shiftOvernight: preferences?.shiftOvernight ?? false,
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
        maxCommuteMinutes: preferences.maxCommuteMinutes ?? null,
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

            {category === 'location' && (
              <div className='space-y-4 px-4 pb-4'>
                {profile?.homeLat && profile?.homeLon ? (
                  <div className='rounded-lg border bg-muted/50 p-3'>
                    <p className='text-sm font-medium'>Current location</p>
                    <p className='text-muted-foreground text-sm'>
                      {profile.location ?? 'Location set'}
                    </p>
                    {profile.isochrones ? (
                      <p className='mt-1 text-xs text-green-600'>✓ Transit zones ready</p>
                    ) : (
                      <p className='mt-1 text-xs text-amber-600'>Computing transit zones...</p>
                    )}
                  </div>
                ) : (
                  <div className='rounded-lg border border-dashed p-3'>
                    <p className='text-muted-foreground text-sm'>No location set</p>
                  </div>
                )}

                <Button
                  className='w-full'
                  disabled={isLocating || isSettingLocation}
                  onClick={handleUseMyLocation}
                  type='button'
                  variant='outline'
                >
                  {isLocating ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Detecting location...
                    </>
                  ) : (
                    <>
                      <MapPin className='mr-2 h-4 w-4' />
                      Use my current location
                    </>
                  )}
                </Button>

                <div className='space-y-2'>
                  <Label htmlFor={`${formId}-manual-address`}>Or enter your address</Label>
                  <div className='flex gap-2'>
                    <Input
                      className='flex-1'
                      id={`${formId}-manual-address`}
                      onChange={e => setManualAddress(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleManualAddress()
                        }
                      }}
                      placeholder='123 Main St, City, State'
                      value={manualAddress}
                    />
                    <Button
                      disabled={!manualAddress.trim() || isGeocoding || isSettingLocation}
                      onClick={handleManualAddress}
                      type='button'
                    >
                      {isGeocoding ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Set'}
                    </Button>
                  </div>
                </div>

                <DrawerFooter className='px-0'>
                  <DrawerClose asChild>
                    <Button type='button' variant='outline'>
                      Close
                    </Button>
                  </DrawerClose>
                </DrawerFooter>
              </div>
            )}

            {category !== 'location' && (
              <form
                className='px-4 pb-4'
                onSubmit={e => {
                  e.preventDefault()
                  form.handleSubmit()
                }}
              >
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
                                v === 'none' ? null : (parseInt(v) as 10 | 30 | 60),
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
            )}
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
