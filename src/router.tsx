import { createRouter } from '@tanstack/react-router';
import { ConvexQueryClient } from '@convex-dev/react-query';
import { QueryClient } from '@tanstack/react-query';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react';
import {
  AuthKitProvider,
  useAccessToken,
  useAuth,
} from '@workos/authkit-tanstack-react-start/client';
import { useCallback, useMemo } from 'react';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL!;
  if (!CONVEX_URL) {
    throw new Error('missing VITE_CONVEX_URL env var');
  }
  const convex = new ConvexReactClient(CONVEX_URL);
  const convexQueryClient = new ConvexQueryClient(convex);

  // ============================================================================
  // WORKAROUND: Pre-authenticate websocket with SSR token
  // Issue: https://github.com/get-convex/convex-backend/issues/242
  //
  // Problem: During client hydration, ConvexQueryClient creates websocket
  // subscriptions before ConvexProviderWithAuth has authenticated. Queries
  // using adminQuery/authQuery throw "Authentication required".
  //
  // Fix: TanStack Start dehydrates router state (including the token from
  // beforeLoad) to window.$_TSR before React hydrates. We extract this token
  // and pre-authenticate the websocket synchronously, so subscriptions
  // created during hydration succeed.
  //
  // ConvexProviderWithAuth still handles token refresh for long-lived sessions.
  //
  // TODO: Remove when @convex-dev/react-query handles this natively.
  // ============================================================================
  if (typeof window !== 'undefined') {
    const ssrToken = extractSsrAuthToken();
    if (ssrToken) {
      convex.setAuth(
        async () => ssrToken,
        () => {}, // onChange - ConvexProviderWithAuth will take over
      );
    }
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        gcTime: 5000,
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: (err) => <p>{err.error.stack}</p>,
    defaultNotFoundComponent: () => <p>not found</p>,
    context: { queryClient, convexClient: convex, convexQueryClient },
    Wrap: ({ children }) => (
      <AuthKitProvider>
        <ConvexProviderWithAuth
          client={convexQueryClient.convexClient}
          useAuth={useAuthFromWorkOS}
        >
          {children}
        </ConvexProviderWithAuth>
      </AuthKitProvider>
    ),
  });
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

// =============================================================================
// WORKAROUND: Extract auth token from TanStack Start's dehydrated SSR state
// Issue: https://github.com/get-convex/convex-backend/issues/242
//
// TanStack Start dehydrates router state to window.$_TSR before React hydrates.
// The token returned from __root.tsx's beforeLoad is in the root match's
// __beforeLoadContext (field 'b').
//
// TODO: Remove when @convex-dev/react-query handles this natively.
// =============================================================================
function extractSsrAuthToken(): string | null {
  const tsr = (window as any).$_TSR;
  if (!tsr?.router?.matches) {
    return null;
  }

  // Find the root route's dehydrated match
  // Note: TanStack Start uses "__root__/" (with trailing slash) as the match ID
  const rootMatch = tsr.router.matches.find(
    (m: { i: string }) => m.i === '__root__/' || m.i === '__root__',
  );

  // Token is in __beforeLoadContext (field 'b'), returned from beforeLoad
  return rootMatch?.b?.token ?? null;
}

function useAuthFromWorkOS() {
  const { loading, user } = useAuth();
  const { getAccessToken, refresh } = useAccessToken();

  const fetchAccessToken = useCallback(
    async ({
      forceRefreshToken,
    }: { forceRefreshToken?: boolean } = {}): Promise<string | null> => {
      if (!user) {
        return null;
      }

      try {
        if (forceRefreshToken) {
          return (await refresh()) ?? null;
        }
        return (await getAccessToken()) ?? null;
      } catch (error) {
        console.error('Failed to get access token:', error);
        return null;
      }
    },
    [user, refresh, getAccessToken],
  );

  return useMemo(
    () => ({
      isLoading: loading,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [loading, user, fetchAccessToken],
  );
}
