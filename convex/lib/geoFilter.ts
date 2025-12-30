import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'

export interface JobWithLocation {
  id: string
  location?: [number, number] // [lat, lng] from Typesense
  [key: string]: unknown
}

export interface IsochroneData {
  tenMinute: GeoJSON.FeatureCollection | null
  thirtyMinute: GeoJSON.FeatureCollection | null
  sixtyMinute: GeoJSON.FeatureCollection | null
  computedAt: number
}

/**
 * Filter jobs by whether they fall within a user's transit isochrone
 *
 * @param jobs - Array of jobs with location coordinates
 * @param isochrones - User's pre-computed isochrone polygons
 * @param maxMinutes - Maximum commute time (10, 30, or 60)
 * @returns Jobs that fall within the specified isochrone zone
 */
export function filterByIsochrone<T extends JobWithLocation>(
  jobs: T[],
  isochrones: IsochroneData,
  maxMinutes: 10 | 30 | 60,
): T[] {
  // Select the appropriate isochrone polygon
  const polygon =
    maxMinutes === 10
      ? isochrones.tenMinute
      : maxMinutes === 30
        ? isochrones.thirtyMinute
        : isochrones.sixtyMinute

  if (!polygon || !polygon.features || polygon.features.length === 0) {
    // No isochrone data - return all jobs
    return jobs
  }

  return jobs.filter(job => {
    if (!job.location || job.location.length !== 2) {
      // Job has no coordinates - exclude from transit-filtered results
      return false
    }

    const [lat, lng] = job.location
    // Turf.js uses [lng, lat] (GeoJSON order), Typesense uses [lat, lng]
    const jobPoint = point([lng, lat])

    // Check if point is in any of the isochrone features
    return polygon.features.some(feature => {
      try {
        return booleanPointInPolygon(
          jobPoint,
          feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
        )
      } catch {
        return false
      }
    })
  })
}

/**
 * Check if a single point is within an isochrone
 */
export function isPointInIsochrone(
  lat: number,
  lng: number,
  isochrones: IsochroneData,
  maxMinutes: 10 | 30 | 60,
): boolean {
  const polygon =
    maxMinutes === 10
      ? isochrones.tenMinute
      : maxMinutes === 30
        ? isochrones.thirtyMinute
        : isochrones.sixtyMinute

  if (!polygon || !polygon.features || polygon.features.length === 0) {
    return true // No isochrone - assume reachable
  }

  const jobPoint = point([lng, lat])

  return polygon.features.some(feature => {
    try {
      return booleanPointInPolygon(
        jobPoint,
        feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
      )
    } catch {
      return false
    }
  })
}
