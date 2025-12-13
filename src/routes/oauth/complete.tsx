import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@workos/authkit-tanstack-react-start';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import {
  clearOAuthSessionCookie,
  decryptSession,
  getOAuthSessionFromRequest,
} from '../../lib/oauth-session';
import { clearReferralCookie } from '../../lib/referral-cookie';
import { generateAuthorizationCode } from '../../lib/oauth-tokens';

const getConvexClient = () => {
  const url = process.env.VITE_CONVEX_URL;
  if (!url) throw new Error('VITE_CONVEX_URL not set');
  return new ConvexHttpClient(url);
};

export const Route = createFileRoute('/oauth/complete')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getAuth();

        if (!auth.user) {
          return new Response('Unauthorized', { status: 401 });
        }

        // Retrieve OAuth session
        const encryptedSession = getOAuthSessionFromRequest(request);
        if (!encryptedSession) {
          return new Response(
            'OAuth session expired. Please start the login process again.',
            { status: 400 },
          );
        }

        const oauthSession = await decryptSession(encryptedSession);
        if (!oauthSession) {
          return new Response('Invalid OAuth session', { status: 400 });
        }

        // Generate authorization code
        const code = generateAuthorizationCode();
        const convex = getConvexClient();
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

        // Redirect to Circle with code
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
