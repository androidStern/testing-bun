import { createFileRoute } from '@tanstack/react-router';
import { getSignUpUrl } from '@workos/authkit-tanstack-react-start';
import {
  
  encryptSession,
  setOAuthSessionCookie
} from '../../lib/oauth-session';
import type {OAuthSessionData} from '../../lib/oauth-session';

export const Route = createFileRoute('/oauth/authorize')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);

        // Extract OAuth parameters from Circle
        const clientId = url.searchParams.get('client_id');
        const redirectUri = url.searchParams.get('redirect_uri');
        const responseType = url.searchParams.get('response_type');
        const state = url.searchParams.get('state');
        const scope = url.searchParams.get('scope');
        const codeChallenge = url.searchParams.get('code_challenge');
        const codeChallengeMethod = url.searchParams.get(
          'code_challenge_method',
        );

        // Validate required parameters
        if (!clientId || !redirectUri || responseType !== 'code' || !state) {
          return new Response(
            JSON.stringify({
              error: 'invalid_request',
              error_description: 'Missing required OAuth parameters',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        // Store OAuth session data
        const sessionData: OAuthSessionData = {
          clientId,
          redirectUri,
          state,
          codeChallenge: codeChallenge || undefined,
          codeChallengeMethod: codeChallengeMethod || undefined,
          scope: scope || undefined,
          createdAt: Date.now(),
        };

        const encryptedSession = await encryptSession(sessionData);

        // Redirect to WorkOS AuthKit for authentication
        // Use a special return path that will handle the profile check
        const signUpUrl = await getSignUpUrl({
          data: { returnPathname: '/oauth/callback' },
        });

        const headers = new Headers();
        headers.set('Location', signUpUrl);
        setOAuthSessionCookie(headers, encryptedSession);

        return new Response(null, {
          status: 302,
          headers,
        });
      },
    },
  },
});
