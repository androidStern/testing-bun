export interface GeocoderOptions {
  apiKey: string
  dailyLimit?: number
  requestsPerSecond?: number
}

export interface GeocoderResult {
  lat: number | null
  lng: number | null
  confidence?: 'high' | 'medium' | 'low'
  source?: string
  placeName?: string
  placeType?: string
  relevance?: number
  raw?: unknown
  error?: string
  notFound?: boolean
}

export interface GeocoderStats {
  requestsToday: number
  dailyLimit: number
  remainingToday: number | string
  currentDay: string | null
}

export function initialize(options: GeocoderOptions): void
export function geocode(location: string): Promise<GeocoderResult | null>
export function batchGeocode(locations: string[]): Promise<Map<string, GeocoderResult | null>>
export function getStats(): GeocoderStats
export function isDailyLimitReached(): boolean
