'use client'

import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import {
  Bus,
  Car,
  Check,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Shuffle,
  SkipForward,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { geocodeAddress, getCityFromCoords, getUserLocation } from '@/lib/geo'
import { cn } from '@/lib/utils'
import { api } from '../../../../convex/_generated/api'

type TransportMode = 'car' | 'transit' | 'flexible'
type CommuteTime = 10 | 30 | 60

type Step = 'location' | 'transport' | 'commute' | 'waiting' | 'complete' | 'skipped'

interface LocationSetupCardProps {
  reason: string
  onComplete: (result: LocationResult) => void
}

export interface LocationResult {
  skipped?: boolean
  location?: {
    lat: number
    lon: number
    city: string
  }
  transportMode?: TransportMode
  maxCommuteMinutes?: CommuteTime
  hasTransitZones?: boolean
  savedToProfile?: boolean
}

const ISOCHRONE_TIMEOUT_MS = 90_000

export function LocationSetupCard({ reason, onComplete }: LocationSetupCardProps) {
  const { user } = useAuth()
  const workosUserId = user?.id

  const [step, setStep] = useState<Step>('location')

  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [city, setCity] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualAddress, setManualAddress] = useState('')
  const [geocoding, setGeocoding] = useState(false)

  const [transportMode, setTransportMode] = useState<TransportMode | null>(null)
  const [maxCommute, setMaxCommute] = useState<CommuteTime | null>(null)

  const [waitStartTime, setWaitStartTime] = useState<number | null>(null)
  const [timedOut, setTimedOut] = useState(false)

  const setHomeLocationMutation = useConvexMutation(api.profiles.setHomeLocation)
  const { mutateAsync: updateLocation, isPending: isSavingLocation } = useMutation({
    mutationFn: setHomeLocationMutation,
  })

  const { data: profile } = useQuery({
    ...convexQuery(api.profiles.getByWorkosUserId, workosUserId ? { workosUserId } : 'skip'),
    refetchInterval: step === 'waiting' ? 2000 : false,
  })

  useEffect(() => {
    if (step !== 'waiting') return

    if (profile?.isochrones) {
      setStep('complete')
      return
    }

    if (waitStartTime && Date.now() - waitStartTime > ISOCHRONE_TIMEOUT_MS) {
      setTimedOut(true)
    }
  }, [step, profile?.isochrones, waitStartTime])

  useEffect(() => {
    if (location) {
      getCityFromCoords(location.lat, location.lon)
        .then(setCity)
        .catch(() => setCity('Unknown location'))
    }
  }, [location])

  const handleUseMyLocation = useCallback(async () => {
    setLocating(true)
    try {
      const coords = await getUserLocation()
      setLocation(coords)
      setStep('transport')
    } catch {
      setShowManualEntry(true)
    } finally {
      setLocating(false)
    }
  }, [])

  const handleManualSubmit = useCallback(async () => {
    if (!manualAddress.trim()) return

    setGeocoding(true)
    try {
      const coords = await geocodeAddress(manualAddress)
      setLocation(coords)
      setShowManualEntry(false)
      setManualAddress('')
      setStep('transport')
    } catch (error) {
      toast.error('Location error', {
        description: error instanceof Error ? error.message : 'Could not find location',
      })
    } finally {
      setGeocoding(false)
    }
  }, [manualAddress])

  const handleTransportSelect = useCallback((mode: TransportMode) => {
    setTransportMode(mode)
    if (mode === 'transit') {
      setStep('commute')
    } else {
      setStep('complete')
    }
  }, [])

  const handleCommuteSelect = useCallback(
    async (time: CommuteTime) => {
      setMaxCommute(time)

      if (!location || !city) return

      try {
        await updateLocation({ lat: location.lat, locationName: city, lon: location.lon })
        setWaitStartTime(Date.now())
        setStep('waiting')
      } catch (error) {
        toast.error('Error saving location', {
          description: error instanceof Error ? error.message : 'Please try again',
        })
      }
    },
    [location, city, updateLocation],
  )

  const handleSkip = useCallback(() => {
    setStep('skipped')
    onComplete({ skipped: true })
  }, [onComplete])

  const handleUseForSearch = useCallback(() => {
    if (!location || !city) return

    onComplete({
      hasTransitZones: !!profile?.isochrones,
      location: { ...location, city },
      maxCommuteMinutes: maxCommute ?? undefined,
      savedToProfile: false,
      transportMode: transportMode ?? undefined,
    })
  }, [location, city, transportMode, maxCommute, profile?.isochrones, onComplete])

  const handleSaveToProfile = useCallback(async () => {
    if (!location || !city) return

    onComplete({
      hasTransitZones: !!profile?.isochrones,
      location: { ...location, city },
      maxCommuteMinutes: maxCommute ?? undefined,
      savedToProfile: true,
      transportMode: transportMode ?? undefined,
    })
  }, [location, city, transportMode, maxCommute, profile?.isochrones, onComplete])

  const handleProceedWithoutTransit = useCallback(() => {
    if (!location || !city) return

    onComplete({
      hasTransitZones: false,
      location: { ...location, city },
      maxCommuteMinutes: maxCommute ?? undefined,
      savedToProfile: true,
      transportMode: transportMode ?? undefined,
    })
  }, [location, city, transportMode, maxCommute, onComplete])

  if (step === 'location') {
    return (
      <>
        <Card className='mb-4'>
          <CardHeader className='pb-3'>
            <div className='flex items-center gap-2'>
              <Navigation className='h-5 w-5 text-primary' />
              <CardTitle className='text-lg'>Set Your Location</CardTitle>
            </div>
            <p className='text-sm text-muted-foreground'>{reason}</p>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex flex-col gap-3 sm:flex-row'>
              <Button
                className='flex-1'
                disabled={locating || isSavingLocation}
                onClick={handleUseMyLocation}
              >
                {locating ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Detecting...
                  </>
                ) : (
                  <>
                    <MapPin className='h-4 w-4' />
                    Use my location
                  </>
                )}
              </Button>
              <Button
                className='flex-1'
                disabled={locating || isSavingLocation}
                onClick={() => setShowManualEntry(true)}
                variant='outline'
              >
                Enter manually
              </Button>
            </div>

            <Button className='w-full text-muted-foreground' onClick={handleSkip} variant='ghost'>
              <SkipForward className='h-4 w-4' />
              Skip - search all locations
            </Button>
          </CardContent>
        </Card>

        <Dialog onOpenChange={setShowManualEntry} open={showManualEntry}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enter your location</DialogTitle>
              <DialogDescription>Enter your city, address, or zip code.</DialogDescription>
            </DialogHeader>
            <Input
              onChange={e => setManualAddress(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleManualSubmit()
              }}
              placeholder='e.g. Tampa, FL or 33602'
              value={manualAddress}
            />
            <DialogFooter>
              <Button
                disabled={geocoding}
                onClick={() => setShowManualEntry(false)}
                variant='outline'
              >
                Cancel
              </Button>
              <Button disabled={geocoding} onClick={handleManualSubmit}>
                {geocoding ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Finding...
                  </>
                ) : (
                  'Use this location'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  if (step === 'transport') {
    return (
      <Card className='mb-4'>
        <CardHeader className='pb-3'>
          <div className='flex items-center gap-2'>
            <Car className='h-5 w-5 text-primary' />
            <CardTitle className='text-lg'>How do you get to work?</CardTitle>
          </div>
          {city && (
            <p className='text-sm text-muted-foreground flex items-center gap-1'>
              <MapPin className='h-3 w-3' />
              {city}
            </p>
          )}
        </CardHeader>
        <CardContent className='space-y-3'>
          <TransportOption
            description='Search by distance'
            icon={<Car className='h-5 w-5' />}
            label='I drive'
            onClick={() => handleTransportSelect('car')}
          />
          <TransportOption
            description='Filter by bus/rail accessibility'
            icon={<Bus className='h-5 w-5' />}
            label='Public transit'
            onClick={() => handleTransportSelect('transit')}
          />
          <TransportOption
            description='I can use either'
            icon={<Shuffle className='h-5 w-5' />}
            label='Flexible'
            onClick={() => handleTransportSelect('flexible')}
          />
        </CardContent>
      </Card>
    )
  }

  if (step === 'commute') {
    return (
      <Card className='mb-4'>
        <CardHeader className='pb-3'>
          <div className='flex items-center gap-2'>
            <Clock className='h-5 w-5 text-primary' />
            <CardTitle className='text-lg'>Max commute time?</CardTitle>
          </div>
          {city && (
            <p className='text-sm text-muted-foreground flex items-center gap-1'>
              <MapPin className='h-3 w-3' />
              {city} • Public transit
            </p>
          )}
        </CardHeader>
        <CardContent className='space-y-3'>
          <CommuteOption
            description='Walking distance to transit'
            disabled={isSavingLocation}
            label='10 minutes'
            minutes={10}
            onClick={() => handleCommuteSelect(10)}
          />
          <CommuteOption
            description='Recommended'
            disabled={isSavingLocation}
            label='30 minutes'
            minutes={30}
            onClick={() => handleCommuteSelect(30)}
          />
          <CommuteOption
            description='Maximum range'
            disabled={isSavingLocation}
            label='60 minutes'
            minutes={60}
            onClick={() => handleCommuteSelect(60)}
          />
        </CardContent>
      </Card>
    )
  }

  if (step === 'waiting') {
    return (
      <Card className='mb-4'>
        <CardHeader className='pb-3'>
          <div className='flex items-center gap-2'>
            <Loader2 className='h-5 w-5 text-primary animate-spin' />
            <CardTitle className='text-lg'>Computing transit zones...</CardTitle>
          </div>
          {city && (
            <p className='text-sm text-muted-foreground flex items-center gap-1'>
              <MapPin className='h-3 w-3' />
              {city} • {maxCommute} min by transit
            </p>
          )}
        </CardHeader>
        <CardContent>
          {timedOut ? (
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Transit zone computation is taking longer than expected. You can:
              </p>
              <div className='flex flex-col gap-2 sm:flex-row'>
                <Button className='flex-1' onClick={handleProceedWithoutTransit}>
                  Continue without transit filter
                </Button>
                <Button
                  className='flex-1'
                  onClick={() => {
                    setTimedOut(false)
                    setWaitStartTime(Date.now())
                  }}
                  variant='outline'
                >
                  Keep waiting
                </Button>
              </div>
            </div>
          ) : (
            <div className='flex items-center gap-3'>
              <div className='h-2 flex-1 bg-muted overflow-hidden rounded-full'>
                <div className='h-full bg-primary animate-pulse w-2/3' />
              </div>
              <span className='text-sm text-muted-foreground'>Please wait...</span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (step === 'complete') {
    const hasIsochrones = !!profile?.isochrones

    return (
      <Card className='mb-4'>
        <CardHeader className='pb-3'>
          <div className='flex items-center gap-2'>
            <Check className='h-5 w-5 text-green-600' />
            <CardTitle className='text-lg'>Location set</CardTitle>
          </div>
          <div className='text-sm text-muted-foreground space-y-1'>
            {city && (
              <p className='flex items-center gap-1'>
                <MapPin className='h-3 w-3' />
                {city}
              </p>
            )}
            {transportMode && (
              <p className='flex items-center gap-1'>
                {transportMode === 'transit' ? (
                  <Bus className='h-3 w-3' />
                ) : (
                  <Car className='h-3 w-3' />
                )}
                {transportMode === 'car' && 'Driving'}
                {transportMode === 'transit' && `Transit • ${maxCommute} min max`}
                {transportMode === 'flexible' && 'Flexible'}
              </p>
            )}
            {transportMode === 'transit' && (
              <p className='flex items-center gap-1'>
                {hasIsochrones ? (
                  <>
                    <Check className='h-3 w-3 text-green-600' />
                    Transit zones ready
                  </>
                ) : (
                  <>
                    <Clock className='h-3 w-3' />
                    Transit zones still computing...
                  </>
                )}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Button className='flex-1' onClick={handleUseForSearch} variant='outline'>
              Use for this search
            </Button>
            <Button className='flex-1' onClick={handleSaveToProfile}>
              Save for future searches
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}

function TransportOption({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'w-full flex items-center gap-4 p-4 border bg-card rounded-lg',
        'hover:bg-muted/50 hover:border-primary/50 transition-colors',
        'text-left',
      )}
      onClick={onClick}
      type='button'
    >
      <div className='text-primary'>{icon}</div>
      <div>
        <p className='font-medium'>{label}</p>
        <p className='text-sm text-muted-foreground'>{description}</p>
      </div>
    </button>
  )
}

function CommuteOption({
  minutes,
  label,
  description,
  onClick,
  disabled,
}: {
  minutes: number
  label: string
  description: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      className={cn(
        'w-full flex items-center gap-4 p-4 border bg-card rounded-lg',
        'hover:bg-muted/50 hover:border-primary/50 transition-colors',
        'text-left',
        'disabled:opacity-50 disabled:cursor-not-allowed',
      )}
      disabled={disabled}
      onClick={onClick}
      type='button'
    >
      <div className='flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold'>
        {minutes}
      </div>
      <div>
        <p className='font-medium'>{label}</p>
        <p className='text-sm text-muted-foreground'>{description}</p>
      </div>
    </button>
  )
}
