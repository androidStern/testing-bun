import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@workos/authkit-tanstack-react-start';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import {
  clearOAuthSessionCookie,
  decryptSession,
  getOAuthSessionFromRequest,
  setOAuthSessionCookie,
} from '../../lib/oauth-session';
import { clearReferralCookie } from '../../lib/referral-cookie';
import { generateAuthorizationCode } from '../../lib/oauth-tokens';

const getConvexClient = () => {
  const url = process.env.VITE_CONVEX_URL;
  if (!url) throw new Error('VITE_CONVEX_URL not set');
  return new ConvexHttpClient(url);
};

export const Route = createFileRoute('/oauth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // This route is called after WorkOS auth completes
        // WorkOS redirects to /callback first (existing route), which then
        // redirects here based on the returnPathname we set in /oauth/authorize
        const auth = await getAuth();

        if (!auth.user) {
          return new Response('Unauthorized', { status: 401 });
        }

        // Retrieve OAuth session
        const encryptedSession = getOAuthSessionFromRequest(request);
        if (!encryptedSession) {
          return new Response('OAuth session expired. Please start over.', {
            status: 400,
          });
        }

        const oauthSession = await decryptSession(encryptedSession);
        if (!oauthSession) {
          return new Response('Invalid OAuth session', { status: 400 });
        }

        // Check session expiry (10 minutes)
        if (Date.now() - oauthSession.createdAt > 600000) {
          return new Response('OAuth session expired', { status: 400 });
        }

        // Check if user has a profile
        const convex = getConvexClient();
        const profile = await convex.query(api.profiles.getByWorkosUserId, {
          workosUserId: auth.user.id,
        });

        if (!profile) {
          // Redirect to profile form with referral code if present
          const headers = new Headers();
          let profileUrl = '/oauth/profile';
          if (oauthSession.referralCode) {
            profileUrl += `?ref=${encodeURIComponent(oauthSession.referralCode)}`;
          }
          headers.set('Location', profileUrl);
          // Keep the session cookie for the profile form
          setOAuthSessionCookie(headers, encryptedSession);

          return new Response(null, {
            status: 302,
            headers,
          });
        }

        // User has profile - generate authorization code and redirect to Circle
        const code = generateAuthorizationCode();
        const internalSecret = process.env.CONVEX_INTERNAL_SECRET;
        if (!internalSecret) {
          return new Response('Server configuration error', { status: 500 });
        }

        await convex.mutation(api.oauth.createAuthorizationCode, {
          internalSecret,
          code,
          clientId: oauthSession.clientId,
          workosUserId: auth.user.id,
          redirectUri: oauthSession.redirectUri,
          codeChallenge: oauthSession.codeChallenge,
          codeChallengeMethod: oauthSession.codeChallengeMethod,
          scope: oauthSession.scope,
          expiresAt: Date.now() + 600000, // 10 minutes
        });

        // Build redirect URL with code and state
        const redirectUrl = new URL(oauthSession.redirectUri);
        redirectUrl.searchParams.set('code', code);
        redirectUrl.searchParams.set('state', oauthSession.state);

        const headers = new Headers();
        headers.set('Location', redirectUrl.toString());
        clearOAuthSessionCookie(headers);
        clearReferralCookie(headers); // Clear any pending referral cookie

        return new Response(null, {
          status: 302,
          headers,
        });
      },
    },
  },
});
