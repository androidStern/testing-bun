"use node";

/**
 * Scraped Jobs Search - Typesense-dependent action
 *
 * Separated from scrapedJobs.ts because it requires Node.js runtime
 * for the Typesense npm package.
 */

import Typesense from 'typesense';
import { v } from 'convex/values';
import { adminAction } from './functions';

/**
 * Search scraped jobs via Typesense
 * Admin-only action for the admin dashboard
 */
export const search = adminAction({
  args: {
    query: v.optional(v.string()),
    filters: v.optional(
      v.object({
        source: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        second_chance_tier: v.optional(v.string()),
        bus_accessible: v.optional(v.boolean()),
        rail_accessible: v.optional(v.boolean()),
        shift_morning: v.optional(v.boolean()),
        shift_afternoon: v.optional(v.boolean()),
        shift_evening: v.optional(v.boolean()),
        shift_overnight: v.optional(v.boolean()),
        shift_flexible: v.optional(v.boolean()),
        is_urgent: v.optional(v.boolean()),
        is_easy_apply: v.optional(v.boolean()),
      })
    ),
    page: v.optional(v.number()),
    perPage: v.optional(v.number()),
  },
  // Typesense search response structure - using any for external API response
  returns: v.any(),
  handler: async (_ctx, args) => {
    const typesenseUrl = process.env.TYPESENSE_URL;
    const apiKey = process.env.TYPESENSE_API_KEY;

    if (!typesenseUrl) {
      throw new Error('TYPESENSE_URL environment variable is required');
    }
    if (!apiKey) {
      throw new Error('TYPESENSE_API_KEY environment variable is required');
    }

    const url = new URL(typesenseUrl);

    const client = new Typesense.Client({
      nodes: [
        {
          host: url.hostname,
          port: parseInt(url.port) || 8108,
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
        },
      ],
      apiKey,
      connectionTimeoutSeconds: 5,
    });

    // Whitelist of allowed filter keys to prevent injection
    const ALLOWED_FILTERS = new Set([
      'source', 'city', 'state', 'second_chance_tier',
      'bus_accessible', 'rail_accessible', 'shift_morning', 'shift_afternoon',
      'shift_evening', 'shift_overnight', 'shift_flexible', 'is_urgent', 'is_easy_apply'
    ]);

    // Sanitize string values for Typesense filter syntax
    const sanitizeFilterValue = (value: string): string => {
      // Escape backticks and special Typesense filter characters
      return value.replace(/[`\\:=<>&|()[\]]/g, '');
    };

    // Build filter string from facets
    const filterParts: Array<string> = [];
    if (args.filters) {
      for (const [key, value] of Object.entries(args.filters)) {
        // Only allow whitelisted keys
        if (!ALLOWED_FILTERS.has(key)) continue;

        if (typeof value === 'boolean') {
          filterParts.push(`${key}:=${value}`);
        } else if (value !== '') {
          // Sanitize string values
          const sanitized = sanitizeFilterValue(String(value));
          if (sanitized) {
            filterParts.push(`${key}:=${sanitized}`);
          }
        }
      }
    }

    const results = await client.collections('jobs').documents().search({
      q: args.query || '*',
      query_by: 'title,company,description',
      filter_by: filterParts.length > 0 ? filterParts.join(' && ') : undefined,
      page: args.page || 1,
      per_page: args.perPage || 25,
      facet_by:
        'source,city,state,second_chance_tier,bus_accessible,rail_accessible,shift_morning,shift_afternoon,shift_evening,shift_overnight,shift_flexible,is_urgent,is_easy_apply',
    });

    return results;
  },
});
