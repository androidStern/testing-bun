import { createFileRoute } from '@tanstack/react-router';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import { setReferralCookie } from '../../lib/referral-cookie';

// Environment config
const CIRCLE_DOMAIN = process.env.CIRCLE_DOMAIN;
const DEFAULT_CIRCLE_INVITE = process.env.DEFAULT_CIRCLE_INVITE || '';
const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

const getConvexClient = () => {
  if (!CONVEX_URL) {
    throw new Error('CONVEX_URL environment variable not set');
  }
  return new ConvexHttpClient(CONVEX_URL);
};

const invalidLinkHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Invalid Referral Link</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
      .card { background: white; padding: 2rem; border-radius: 1rem; text-align: center; max-width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
      h1 { color: #dc2626; margin-bottom: 0.5rem; }
      p { color: #666; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Invalid Link</h1>
      <p>This referral link is invalid or has expired.</p>
    </div>
  </body>
</html>
`;

export const Route = createFileRoute('/join/$code')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { code } = params;

        // Validate environment configuration
        if (!CIRCLE_DOMAIN) {
          console.error('CIRCLE_DOMAIN environment variable not set');
          return new Response('Server configuration error', { status: 500 });
        }

        // Validate code format (6-8 alphanumeric chars)
        if (!/^[A-Z0-9]{6,8}$/i.test(code)) {
          return new Response(invalidLinkHtml, {
            status: 400,
            headers: { 'Content-Type': 'text/html' },
          });
        }

        // Validate that the referral code exists
        try {
          const convex = getConvexClient();
          const referrer = await convex.query(
            api.referrals.getProfileByReferralCode,
            { code: code.toUpperCase() },
          );

          if (!referrer) {
            return new Response(invalidLinkHtml, {
              status: 404,
              headers: { 'Content-Type': 'text/html' },
            });
          }
        } catch (error) {
          console.error('Failed to validate referral code:', error);
          // On error, still allow the redirect (fail open for UX)
        }

        // Set referral cookie and redirect to Circle
        const headers = new Headers();
        setReferralCookie(headers, code.toUpperCase());

        // Build Circle URL
        let circleUrl = `https://${CIRCLE_DOMAIN}/join`;
        if (DEFAULT_CIRCLE_INVITE) {
          circleUrl += `?invitation_token=${DEFAULT_CIRCLE_INVITE}`;
        }

        headers.set('Location', circleUrl);

        return new Response(null, {
          status: 302,
          headers,
        });
      },
    },
  },
});
