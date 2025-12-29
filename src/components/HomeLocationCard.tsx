import { useMutation, useQuery } from '@tanstack/react-query';
import { useConvexMutation, convexQuery } from '@convex-dev/react-query';
import { api } from '@/convex/_generated/api';
import { getUserLocation, getCityFromCoords } from '@/lib/geo';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MapPin, Loader2, RefreshCw, Navigation } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HomeLocationCardProps {
  workosUserId: string;
}

export function HomeLocationCard({ workosUserId }: HomeLocationCardProps) {
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
        description: 'Computing transit accessibility zones...',
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Navigation className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Home Location</CardTitle>
            <CardDescription>
              Find jobs accessible by public transit
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {cityLoading ? (
              <span className="text-sm text-muted-foreground">Loading...</span>
            ) : city ? (
              <div className="flex flex-col">
                <span className="font-medium">{city}</span>
                {hasLocation && !hasIsochrones && (
                  <span className="text-xs text-muted-foreground">
                    Computing transit zones...
                  </span>
                )}
                {hasIsochrones && (
                  <span className="text-xs text-muted-foreground">
                    Transit zones ready
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                No location set
              </span>
            )}
          </div>

          <Button
            variant={hasLocation ? 'outline' : 'default'}
            size="sm"
            onClick={handleChangeLocation}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Locating...
              </>
            ) : hasLocation ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Update Location
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4" />
                Set Location
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
