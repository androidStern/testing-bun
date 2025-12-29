import { useMutation, useQuery } from '@tanstack/react-query';
import { useConvexMutation, convexQuery } from '@convex-dev/react-query';
import { api } from '@/convex/_generated/api';
import { getUserLocation, getCityFromCoords } from '@/lib/geo';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HomeLocationProps {
  workosUserId: string;
}

export function HomeLocation({ workosUserId }: HomeLocationProps) {
  const { toast } = useToast();
  const [city, setCity] = useState<string | null>(null);
  const [cityLoading, setCityLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const { data: profile } = useQuery(
    convexQuery(api.profiles.getByWorkosUserId, { workosUserId }),
  );

  const { mutate: updateLocation, isPending } = useMutation({
    mutationFn: useConvexMutation(api.profiles.setHomeLocation),
    onSuccess: () => {
      toast({
        title: 'Location updated',
        description: 'Computing transit accessibility...',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Fetch city name when lat/lon changes
  useEffect(() => {
    if (profile?.homeLat != null && profile?.homeLon != null) {
      setCityLoading(true);
      getCityFromCoords(profile.homeLat, profile.homeLon)
        .then(setCity)
        .finally(() => setCityLoading(false));
    } else {
      setCity(null);
    }
  }, [profile?.homeLat, profile?.homeLon]);

  async function handleChangeLocation() {
    setLocating(true);
    try {
      const { lat, lon } = await getUserLocation();
      updateLocation({ lat, lon });
    } catch (error) {
      toast({
        title: 'Location error',
        description:
          error instanceof Error ? error.message : 'Could not get location',
        variant: 'destructive',
      });
    } finally {
      setLocating(false);
    }
  }

  const hasLocation = profile?.homeLat != null && profile?.homeLon != null;
  const hasIsochrones = profile?.isochrones != null;
  const isLoading = locating || isPending;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        {cityLoading ? (
          <span className="text-muted-foreground">Loading...</span>
        ) : city ? (
          <span>{city}</span>
        ) : (
          <span className="text-muted-foreground">No location set</span>
        )}
      </div>

      {hasLocation && !hasIsochrones && (
        <span className="text-xs text-muted-foreground">
          (computing transit zones...)
        </span>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={handleChangeLocation}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Locating...
          </>
        ) : hasLocation ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Update
          </>
        ) : (
          'Set Home Location'
        )}
      </Button>
    </div>
  );
}
