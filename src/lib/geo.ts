/**
 * Get user's current location via browser Geolocation API.
 * Uses WiFi/IP-based location (enableHighAccuracy: false) for better desktop compatibility.
 */
export function getUserLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- old browser fallback
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(getGeolocationErrorMessage(error)));
      },
      {
        enableHighAccuracy: false, // Use WiFi/IP, not GPS (better for desktop)
        timeout: 10000,
        maximumAge: 60000, // Cache for 1 minute
      },
    );
  });
}

function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission denied. Please enable location access in your browser settings.';
    case error.POSITION_UNAVAILABLE:
      return 'Location unavailable. Please try again.';
    case error.TIMEOUT:
      return 'Location request timed out. Please try again.';
    default:
      return 'Could not get your location.';
  }
}

/**
 * Reverse geocode coordinates to city name using Nominatim (free, no API key).
 */
export async function getCityFromCoords(
  lat: number,
  lon: number,
): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      {
        headers: {
          'User-Agent': 'RecoveryJobs/1.0', // Required by Nominatim
        },
      },
    );

    if (!res.ok) {
      return 'Unknown location';
    }

    const data = await res.json();
    const address = data.address;

    // Try different address components in order of preference
    return (
      address?.city ||
      address?.town ||
      address?.village ||
      address?.municipality ||
      address?.county ||
      address?.state ||
      'Unknown location'
    );
  } catch {
    return 'Unknown location';
  }
}

/**
 * Forward geocode an address to coordinates using Nominatim (free, no API key).
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lon: number }> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
    {
      headers: {
        'User-Agent': 'RecoveryJobs/1.0', // Required by Nominatim
      },
    },
  );

  if (!res.ok) {
    throw new Error('Geocoding request failed');
  }

  const data = await res.json();

  if (!data.length) {
    throw new Error('Address not found. Try a more specific location.');
  }

  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
  };
}
