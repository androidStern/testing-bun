import { createFileRoute } from '@tanstack/react-router';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';

const getConvexClient = () => {
  const url = process.env.VITE_CONVEX_URL;
  if (!url) throw new Error('VITE_CONVEX_URL not set');
  return new ConvexHttpClient(url);
};

export const Route = createFileRoute('/oauth/userinfo')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Extract Bearer token
        const authHeader = request.headers.get('authorization');

        if (!authHeader?.startsWith('Bearer ')) {
          return new Response(
            JSON.stringify({
              error: 'invalid_token',
              error_description: 'Bearer token required',
            }),
            {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                'WWW-Authenticate': 'Bearer error="invalid_token"',
              },
            },
          );
        }

        const token = authHeader.slice(7);
        const convex = getConvexClient();

        // Validate token
        const accessToken = await convex.query(api.oauth.getAccessToken, {
          token,
        });

        if (!accessToken) {
          return new Response(
            JSON.stringify({
              error: 'invalid_token',
              error_description: 'Token not found',
            }),
            {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                'WWW-Authenticate': 'Bearer error="invalid_token"',
              },
            },
          );
        }

        if (Date.now() > accessToken.expiresAt) {
          return new Response(
            JSON.stringify({
              error: 'invalid_token',
              error_description: 'Token expired',
            }),
            {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                'WWW-Authenticate': 'Bearer error="invalid_token"',
              },
            },
          );
        }

        // Get user profile from Convex
        const profile = await convex.query(api.profiles.getByWorkosUserId, {
          workosUserId: accessToken.workosUserId,
        });

        // Build userinfo response
        // Standard OIDC claims + custom claims for Circle
        const firstName = profile?.firstName || '';
        const lastName = profile?.lastName || '';
        const fullName = [firstName, lastName].filter(Boolean).join(' ');

        const userinfo = {
          sub: accessToken.workosUserId,
          email: profile?.email || '',
          email_verified: true,

          // Profile data that Circle can use
          name: fullName,
          first_name: firstName,
          last_name: lastName,
          bio: profile?.bio || '',
          location: profile?.location || '',
          website: profile?.website || '',

          // Custom claims for Circle profile fields
          things_i_can_offer: profile?.thingsICanOffer || [],
          headline: profile?.headline || '',
          resume_link: profile?.resumeLink || '',
          instagram_url: profile?.instagramUrl || '',
          linkedin_url: profile?.linkedinUrl || '',
        };

        return new Response(JSON.stringify(userinfo), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  },
});
