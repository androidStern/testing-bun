import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, MapPin, Navigation, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { api } from '../../convex/_generated/api'

interface HomeLocationCardProps {
  workosUserId: string
}

export function HomeLocationCard({ workosUserId }: HomeLocationCardProps) {
  const [city, setCity] = useState<string | null>(null)
  const [cityLoading, setCityLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualAddress, setManualAddress] = useState('')
  const [geocoding, setGeocoding] = useState(false)

  const { data: profile } = useQuery(convexQuery(api.profiles.getByWorkosUserId, { workosUserId }))

  const setHomeLocationMutation = useConvexMutation(api.profiles.setHomeLocation)
  const { mutate: updateLocation, isPending } = useMutation({
    mutationFn: setHomeLocationMutation,
    onError: error => {
      toast.error('Error', {
        description: error.message,
      })
    },
    onSuccess: () => {
      toast.success('Location updated', {
        description: 'Computing transit accessibility zones...',
      })
    },
  })

  // Fetch city name when lat/lon changes
  useEffect(() => {
    if (profile?.homeLat != null && profile?.homeLon != null) {
      setCityLoading(true)
      getCityFromCoords(profile.homeLat, profile.homeLon)
        .then(setCity)
        .finally(() => setCityLoading(false))
    } else {
      setCity(null)
    }
  }, [profile?.homeLat, profile?.homeLon])

  async function handleChangeLocation() {
    setLocating(true)
    try {
      const { lat, lon } = await getUserLocation()
      const cityName = await getCityFromCoords(lat, lon)
      updateLocation({ lat, locationName: cityName, lon })
    } catch {
      // Browser geolocation failed - show manual entry dialog
      setShowManualEntry(true)
    } finally {
      setLocating(false)
    }
  }

  async function handleManualSubmit() {
    if (!manualAddress.trim()) return

    setGeocoding(true)
    try {
      const { lat, lon } = await geocodeAddress(manualAddress)
      const cityName = await getCityFromCoords(lat, lon)
      updateLocation({ lat, locationName: cityName, lon })
      setShowManualEntry(false)
      setManualAddress('')
    } catch (error) {
      toast.error('Location error', {
        description: error instanceof Error ? error.message : 'Could not find location',
      })
    } finally {
      setGeocoding(false)
    }
  }

  const hasLocation = profile?.homeLat != null && profile?.homeLon != null
  const hasIsochrones = profile?.isochrones != null
  const isLoading = locating || isPending

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center bg-primary/10'>
              <Navigation className='h-4 w-4 text-primary' />
            </div>
            <div>
              <CardTitle className='text-lg'>Home Location</CardTitle>
              <CardDescription>Find jobs accessible by public transit</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex items-center gap-2'>
              <MapPin className='h-4 w-4 text-muted-foreground' />
              {cityLoading ? (
                <span className='text-sm text-muted-foreground'>Loading...</span>
              ) : city ? (
                <div className='flex flex-col'>
                  <span className='font-medium'>{city}</span>
                  {hasLocation && !hasIsochrones && (
                    <span className='text-xs text-muted-foreground'>
                      Computing transit zones...
                    </span>
                  )}
                  {hasIsochrones && (
                    <span className='text-xs text-muted-foreground'>Transit zones ready</span>
                  )}
                </div>
              ) : (
                <span className='text-sm text-muted-foreground'>No location set</span>
              )}
            </div>

            <div className='flex gap-2'>
              <Button
                disabled={isLoading}
                onClick={handleChangeLocation}
                size='sm'
                variant={hasLocation ? 'outline' : 'default'}
              >
                {isLoading ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Locating...
                  </>
                ) : hasLocation ? (
                  <>
                    <RefreshCw className='h-4 w-4' />
                    Update
                  </>
                ) : (
                  <>
                    <MapPin className='h-4 w-4' />
                    Use my location
                  </>
                )}
              </Button>
              <Button
                disabled={isLoading}
                onClick={() => setShowManualEntry(true)}
                size='sm'
                variant='ghost'
              >
                Enter manually
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog onOpenChange={setShowManualEntry} open={showManualEntry}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter your location</DialogTitle>
            <DialogDescription>
              Enter your city, address, or zip code to find jobs accessible by public transit.
            </DialogDescription>
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
