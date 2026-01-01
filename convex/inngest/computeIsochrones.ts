'use node';

import { inngest } from './client';
import { internal } from '../_generated/api';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import {
  fetchIsochrones,
  pollIsochrones,
  parseIsochrones,
  type GeoJSONFeatureCollection,
} from '../lib/geoapify';

// Extended handler args type with middleware-injected convex context
interface HandlerArgs {
  event: { data: { profileId: string; lat: number; lon: number } };
  step: {
    run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  };
  convex: ActionCtx;
}

/**
 * Compute transit isochrones for a user's home location.
 *
 * This workflow handles Geoapify's async 202 responses using Inngest steps:
 * - Step 1: Initial fetch (may return immediately or async job)
 * - Step 2: Poll for result if async (Inngest retries this step on failure)
 * - Step 3: Save parsed isochrones to Convex
 */
export const computeIsochrones = inngest.createFunction(
  {
    id: 'compute-isochrones',
    concurrency: { limit: 5 }, // Matches Geoapify 5 req/sec limit
    retries: 10,
  },
  { event: 'isochrones/compute' },
  async (args) => {
    // Cast to get middleware-injected convex context
    const { event, step, convex } = args as unknown as HandlerArgs;
    const { profileId, lat, lon } = event.data;

    // Step 1: Initial fetch (may return immediately or async job)
    const initial = await step.run('fetch-isochrones', async () => {
      return fetchIsochrones(lat, lon);
    });

    let data: GeoJSONFeatureCollection;

    if (initial.done && initial.data) {
      data = initial.data;
    } else if (initial.jobId) {
      // Step 2: Poll for async result (Inngest retries this step on failure)
      data = await step.run('poll-isochrones', async () => {
        return pollIsochrones(initial.jobId!);
      });
    } else {
      throw new Error('Unexpected Geoapify response: no data or jobId');
    }

    // Step 3: Parse and save to Convex
    const isochrones = parseIsochrones(data);

    await step.run('save-isochrones', async () => {
      await convex.runMutation(internal.profiles.saveIsochrones, {
        profileId: profileId as Id<'profiles'>,
        isochrones: {
          ...isochrones,
          computedAt: Date.now(),
        },
      });
    });

    return {
      success: true,
      profileId,
      ranges: {
        tenMinute: !!isochrones.tenMinute,
        thirtyMinute: !!isochrones.thirtyMinute,
        sixtyMinute: !!isochrones.sixtyMinute,
      },
    };
  },
);
