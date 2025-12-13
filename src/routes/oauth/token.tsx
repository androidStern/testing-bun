import { createFileRoute } from '@tanstack/react-router';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import {
  generateAccessToken,
  generateRefreshToken,
  hashClientSecret,
  verifyCodeChallenge,
} from '../../lib/oauth-tokens';

const getConvexClient = () => {
  const url = process.env.VITE_CONVEX_URL;
  if (!url) throw new Error('VITE_CONVEX_URL not set');
  return new ConvexHttpClient(url);
};

function errorResponse(error: string, description: string): Response {
  return new Response(
    JSON.stringify({
      error,
      error_description: description,
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

export const Route = createFileRoute('/oauth/token')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Get internal secret within server handler - NEVER at module scope
        const internalSecret = process.env.CONVEX_INTERNAL_SECRET;
        if (!internalSecret) {
          return errorResponse('server_error', 'Server configuration error');
        }

        const contentType = request.headers.get('content-type');

        let body: URLSearchParams;
        if (contentType?.includes('application/x-www-form-urlencoded')) {
          body = new URLSearchParams(await request.text());
        } else if (contentType?.includes('application/json')) {
          const json = await request.json();
          body = new URLSearchParams(json);
        } else {
          return errorResponse('invalid_request', 'Unsupported content type');
        }

        const grantType = body.get('grant_type');

        if (grantType === 'authorization_code') {
          return handleAuthorizationCodeGrant(request, body, internalSecret);
        } else if (grantType === 'refresh_token') {
          return handleRefreshTokenGrant(body, internalSecret);
        } else {
          return errorResponse(
            'unsupported_grant_type',
            'Only authorization_code and refresh_token are supported',
          );
        }
      },
    },
  },
});

async function handleAuthorizationCodeGrant(
  request: Request,
  body: URLSearchParams,
  internalSecret: string,
): Promise<Response> {
  const code = body.get('code');
  const redirectUri = body.get('redirect_uri');
  const clientId = body.get('client_id');
  const clientSecret = body.get('client_secret');
  const codeVerifier = body.get('code_verifier');

  if (!code || !redirectUri || !clientId) {
    return errorResponse('invalid_request', 'Missing required parameters');
  }

  const convex = getConvexClient();

  // Authenticate client
  const authHeader = request.headers.get('authorization');
  let authenticatedClientId: string;
  let authenticatedClientSecret: string | undefined;

  if (authHeader?.startsWith('Basic ')) {
    const decoded = atob(authHeader.slice(6));
    const [id, secret] = decoded.split(':');
    authenticatedClientId = id;
    authenticatedClientSecret = secret;
  } else if (clientSecret) {
    authenticatedClientId = clientId;
    authenticatedClientSecret = clientSecret;
  } else if (codeVerifier) {
    // PKCE flow - no client secret needed
    authenticatedClientId = clientId;
  } else {
    return errorResponse('invalid_client', 'Client authentication required');
  }

  // Verify client credentials (if provided)
  if (authenticatedClientSecret) {
    const client = await convex.query(api.oauth.getClient, {
      clientId: authenticatedClientId,
    });

    if (!client) {
      return errorResponse('invalid_client', 'Unknown client');
    }

    const secretHash = await hashClientSecret(authenticatedClientSecret);
    if (client.clientSecret !== secretHash) {
      return errorResponse('invalid_client', 'Invalid client credentials');
    }
  }

  // Retrieve and validate authorization code
  const authCode = await convex.query(api.oauth.getAuthorizationCode, { code });

  if (!authCode) {
    return errorResponse('invalid_grant', 'Invalid authorization code');
  }

  if (authCode.used) {
    return errorResponse('invalid_grant', 'Authorization code already used');
  }

  if (Date.now() > authCode.expiresAt) {
    return errorResponse('invalid_grant', 'Authorization code expired');
  }

  if (authCode.clientId !== clientId) {
    return errorResponse('invalid_grant', 'Client ID mismatch');
  }

  if (authCode.redirectUri !== redirectUri) {
    return errorResponse('invalid_grant', 'Redirect URI mismatch');
  }

  // Validate PKCE if code challenge was provided
  if (authCode.codeChallenge) {
    if (!codeVerifier) {
      return errorResponse('invalid_grant', 'Code verifier required');
    }

    const valid = await verifyCodeChallenge(
      codeVerifier,
      authCode.codeChallenge,
      authCode.codeChallengeMethod || 'plain',
    );

    if (!valid) {
      return errorResponse('invalid_grant', 'Invalid code verifier');
    }
  }

  // Mark code as used
  await convex.mutation(api.oauth.markCodeAsUsed, { internalSecret, code });

  // Generate tokens
  const accessToken = generateAccessToken();
  const refreshToken = generateRefreshToken();

  const accessTokenExpiry = Date.now() + 3600000; // 1 hour
  const refreshTokenExpiry = Date.now() + 2592000000; // 30 days

  // Store tokens
  await convex.mutation(api.oauth.createAccessToken, {
    internalSecret,
    token: accessToken,
    workosUserId: authCode.workosUserId,
    clientId: authCode.clientId,
    scope: authCode.scope,
    expiresAt: accessTokenExpiry,
  });

  await convex.mutation(api.oauth.createRefreshToken, {
    internalSecret,
    token: refreshToken,
    workosUserId: authCode.workosUserId,
    clientId: authCode.clientId,
    scope: authCode.scope,
    expiresAt: refreshTokenExpiry,
  });

  return new Response(
    JSON.stringify({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: authCode.scope || '',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    },
  );
}

async function handleRefreshTokenGrant(
  body: URLSearchParams,
  internalSecret: string,
): Promise<Response> {
  const refreshToken = body.get('refresh_token');
  const clientId = body.get('client_id');

  if (!refreshToken || !clientId) {
    return errorResponse('invalid_request', 'Missing required parameters');
  }

  const convex = getConvexClient();

  const storedToken = await convex.query(api.oauth.getRefreshToken, {
    token: refreshToken,
  });

  if (!storedToken || storedToken.clientId !== clientId) {
    return errorResponse('invalid_grant', 'Invalid refresh token');
  }

  if (Date.now() > storedToken.expiresAt) {
    return errorResponse('invalid_grant', 'Refresh token expired');
  }

  // Generate new access token
  const accessToken = generateAccessToken();
  const accessTokenExpiry = Date.now() + 3600000;

  await convex.mutation(api.oauth.createAccessToken, {
    internalSecret,
    token: accessToken,
    workosUserId: storedToken.workosUserId,
    clientId: storedToken.clientId,
    scope: storedToken.scope,
    expiresAt: accessTokenExpiry,
  });

  return new Response(
    JSON.stringify({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: storedToken.scope || '',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    },
  );
}
