'use node';

import { v } from 'convex/values';

import { internalAction } from './_generated/server';
import { inngest } from './inngest/client';

/**
 * Trigger isochrone computation via Inngest.
 * Called from profiles.setHomeLocation via scheduler.runAfter.
 */
export const triggerCompute = internalAction({
  args: {
    profileId: v.id('profiles'),
    lat: v.number(),
    lon: v.number(),
  },
  returns: v.null(),
  handler: async (_ctx, { profileId, lat, lon }) => {
    await inngest.send({
      name: 'isochrones/compute',
      data: {
        profileId: profileId.toString(),
        lat,
        lon,
      },
    });
    return null;
  },
});
