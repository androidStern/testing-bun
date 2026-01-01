import { env } from './env';

const BASE_URL = 'https://api.geoapify.com/v1/isoline';

// Minimal GeoJSON types for Geoapify isochrone responses
export type GeoJSONFeature = {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: unknown;
};

export type GeoJSONFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
};

export type IsochroneResult = {
  done: boolean;
  data?: GeoJSONFeatureCollection;
  jobId?: string;
};

export type ParsedIsochrones = {
  tenMinute: GeoJSONFeatureCollection | null;
  thirtyMinute: GeoJSONFeatureCollection | null;
  sixtyMinute: GeoJSONFeatureCollection | null;
};

/**
 * Fetch transit isochrones for a location.
 * Returns immediately if data is ready (200), or returns a jobId for polling (202).
 */
export async function fetchIsochrones(
  lat: number,
  lon: number,
): Promise<IsochroneResult> {
  const apiKey = env.GEOAPIFY_API_KEY;
  const url = `${BASE_URL}?lat=${lat}&lon=${lon}&type=time&mode=approximated_transit&range=600,1800,3600&apiKey=${apiKey}`;

  const res = await fetch(url);

  if (res.status === 200) {
    return { done: true, data: await res.json() };
  }

  if (res.status === 202) {
    const body = await res.json();
    return { done: false, jobId: body.properties?.id };
  }

  throw new Error(`Geoapify error: ${res.status} ${await res.text()}`);
}

/**
 * Poll for async isochrone calculation result.
 * Throws if still pending (so Inngest can retry the step).
 */
export async function pollIsochrones(
  jobId: string,
): Promise<GeoJSONFeatureCollection> {
  const apiKey = env.GEOAPIFY_API_KEY;
  const url = `${BASE_URL}?id=${jobId}&apiKey=${apiKey}`;

  const res = await fetch(url);

  if (res.status === 200) {
    return res.json();
  }

  if (res.status === 202) {
    throw new Error('Still pending'); // Inngest retries this step
  }

  throw new Error(`Geoapify poll error: ${res.status}`);
}

/**
 * Parse Geoapify response into separate isochrone zones by range.
 */
export function parseIsochrones(
  data: GeoJSONFeatureCollection,
): ParsedIsochrones {
  const byRange = (range: number): GeoJSONFeatureCollection | null => {
    const feature = data.features.find((f) => f.properties?.range === range);
    return feature ? { type: 'FeatureCollection', features: [feature] } : null;
  };

  return {
    tenMinute: byRange(600),
    thirtyMinute: byRange(1800),
    sixtyMinute: byRange(3600),
  };
}
