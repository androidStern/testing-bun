'use node'

/**
 * Scraped Jobs Search - Typesense-dependent action
 *
 * Separated from scrapedJobs.ts because it requires Node.js runtime
 * for the Typesense npm package.
 */

import { v } from 'convex/values'
import Typesense from 'typesense'
import { internalAction } from './_generated/server'
import { adminAction } from './functions'

/**
 * Search scraped jobs via Typesense
 * Admin-only action for the admin dashboard
 */
export const search = adminAction({
  args: {
    filters: v.optional(
      v.object({
        bus_accessible: v.optional(v.boolean()),
        city: v.optional(v.string()),
        is_easy_apply: v.optional(v.boolean()),
        is_urgent: v.optional(v.boolean()),
        rail_accessible: v.optional(v.boolean()),
        second_chance_tier: v.optional(v.string()),
        shift_afternoon: v.optional(v.boolean()),
        shift_evening: v.optional(v.boolean()),
        shift_flexible: v.optional(v.boolean()),
        shift_morning: v.optional(v.boolean()),
        shift_overnight: v.optional(v.boolean()),
        source: v.optional(v.string()),
        state: v.optional(v.string()),
      }),
    ),
    page: v.optional(v.number()),
    perPage: v.optional(v.number()),
    query: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const typesenseUrl = process.env.TYPESENSE_URL
    const apiKey = process.env.TYPESENSE_API_KEY

    if (!typesenseUrl) {
      throw new Error('TYPESENSE_URL environment variable is required')
    }
    if (!apiKey) {
      throw new Error('TYPESENSE_API_KEY environment variable is required')
    }

    const url = new URL(typesenseUrl)

    const client = new Typesense.Client({
      apiKey,
      connectionTimeoutSeconds: 5,
      nodes: [
        {
          host: url.hostname,
          port: url.port ? parseInt(url.port) : url.protocol === 'https:' ? 443 : 80,
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
        },
      ],
    })

    // Whitelist of allowed filter keys to prevent injection
    const ALLOWED_FILTERS = new Set([
      'source',
      'city',
      'state',
      'second_chance_tier',
      'bus_accessible',
      'rail_accessible',
      'shift_morning',
      'shift_afternoon',
      'shift_evening',
      'shift_overnight',
      'shift_flexible',
      'is_urgent',
      'is_easy_apply',
    ])

    // Sanitize string values for Typesense filter syntax
    const sanitizeFilterValue = (value: string): string => {
      // Escape backticks and special Typesense filter characters
      return value.replace(/[`\\:=<>&|()[\]]/g, '')
    }

    // Build filter string from facets
    const filterParts: Array<string> = []
    if (args.filters) {
      for (const [key, value] of Object.entries(args.filters)) {
        // Only allow whitelisted keys
        if (!ALLOWED_FILTERS.has(key)) continue

        if (typeof value === 'boolean') {
          filterParts.push(`${key}:=${value}`)
        } else if (value !== '') {
          // Sanitize string values
          const sanitized = sanitizeFilterValue(String(value))
          if (sanitized) {
            filterParts.push(`${key}:=${sanitized}`)
          }
        }
      }
    }

    const results = await client
      .collections('jobs')
      .documents()
      .search({
        exclude_fields: 'embedding',
        facet_by:
          'source,city,state,second_chance_tier,bus_accessible,rail_accessible,shift_morning,shift_afternoon,shift_evening,shift_overnight,shift_flexible,is_urgent,is_easy_apply',
        filter_by: filterParts.length > 0 ? filterParts.join(' && ') : undefined,
        page: args.page || 1,
        per_page: args.perPage || 25,
        prefix: false,
        q: args.query || '*',
        query_by: 'embedding',
      })

    return results
  },
  // Typesense search response structure - using any for external API response
  returns: v.any(),
})

// Shared helper functions
const ALLOWED_FILTERS_FOR_GEO = new Set([
  'source',
  'city',
  'state',
  'second_chance',
  'second_chance_tier',
  'bus_accessible',
  'rail_accessible',
  'shift_morning',
  'shift_afternoon',
  'shift_evening',
  'shift_overnight',
  'shift_flexible',
  'is_urgent',
  'is_easy_apply',
])

function sanitizeFilterValueForGeo(value: string): string {
  return value.replace(/[`\\:=<>&|()[\]]/g, '')
}

function buildFilterStringForGeo(filters: Record<string, unknown>): string {
  const filterParts: string[] = []

  for (const [key, value] of Object.entries(filters)) {
    if (!ALLOWED_FILTERS_FOR_GEO.has(key)) continue
    if (value === undefined || value === null) continue

    if (typeof value === 'boolean') {
      filterParts.push(`${key}:=${value}`)
    } else if (typeof value === 'string' && value !== '') {
      const sanitized = sanitizeFilterValueForGeo(value)
      if (sanitized) {
        filterParts.push(`${key}:=\`${sanitized}\``)
      }
    }
  }

  return filterParts.join(' && ')
}

function getTypesenseClient() {
  const typesenseUrl = process.env.TYPESENSE_URL
  const apiKey = process.env.TYPESENSE_API_KEY

  if (!typesenseUrl) throw new Error('TYPESENSE_URL environment variable is required')
  if (!apiKey) throw new Error('TYPESENSE_API_KEY environment variable is required')

  const url = new URL(typesenseUrl)

  return new Typesense.Client({
    apiKey,
    connectionTimeoutSeconds: 10,
    nodes: [
      {
        host: url.hostname,
        port: url.port ? parseInt(url.port) : url.protocol === 'https:' ? 443 : 80,
        protocol: url.protocol.replace(':', '') as 'http' | 'https',
      },
    ],
  })
}

/**
 * Internal search with geo-filtering for agent tools
 * Returns raw Typesense results for further processing
 */
export const searchWithGeo = internalAction({
  args: {
    filters: v.optional(
      v.object({
        bus_accessible: v.optional(v.boolean()),
        city: v.optional(v.string()),
        is_easy_apply: v.optional(v.boolean()),
        is_urgent: v.optional(v.boolean()),
        rail_accessible: v.optional(v.boolean()),
        second_chance: v.optional(v.boolean()),
        second_chance_tier: v.optional(v.string()),
        state: v.optional(v.string()),
      }),
    ),
    geoFilter: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        radiusKm: v.number(),
      }),
    ),
    limit: v.optional(v.number()),
    query: v.string(),
    // Shift preferences use OR logic - match jobs with ANY of these shifts
    shiftPreferences: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const client = getTypesenseClient()

    // Build filter parts
    const filterParts: string[] = []

    // Add facet filters (AND logic)
    if (args.filters) {
      const facetFilter = buildFilterStringForGeo(args.filters)
      if (facetFilter) {
        filterParts.push(facetFilter)
      }
    }

    // Add shift preferences with OR logic
    // If user prefers morning OR afternoon, we want jobs that have EITHER
    if (args.shiftPreferences && args.shiftPreferences.length > 0) {
      const shiftConditions = args.shiftPreferences
        .map(shift => `shift_${shift}:=true`)
        .join(' || ')
      filterParts.push(`(${shiftConditions})`)
    }

    // Add geo filter if provided
    if (args.geoFilter) {
      const { lat, lng, radiusKm } = args.geoFilter
      filterParts.push(`location:(${lat}, ${lng}, ${radiusKm} km)`)
    }

    const results = await client
      .collections('jobs')
      .documents()
      .search({
        exclude_fields: 'embedding',
        filter_by: filterParts.length > 0 ? filterParts.join(' && ') : undefined,
        per_page: args.limit || 50,
        prefix: false,
        q: args.query || '*',
        query_by: 'embedding',
        sort_by: args.geoFilter
          ? `location(${args.geoFilter.lat}, ${args.geoFilter.lng}):asc`
          : '_vector_distance:asc',
      })

    return results
  },
  returns: v.any(),
})
