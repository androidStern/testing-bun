import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getAuth } from '@workos/authkit-tanstack-react-start';
import { ThemeProvider } from 'next-themes';
import appCssUrl from '../app.css?url';
import { Toaster } from '@/components/ui/sonner';
import type { ConvexReactClient } from 'convex/react';
import type { ReactNode } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { ConvexQueryClient } from '@convex-dev/react-query';

const fetchWorkosAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const auth = await getAuth();
  const { user } = auth;

  return {
    token: user ? auth.accessToken : null,
    userId: user?.id ?? null,
  };
});

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  beforeLoad: async (ctx) => {
    const { userId, token } = await fetchWorkosAuth();

    // During SSR only (the only time serverHttpClient exists),
    // set the Clerk auth token to make HTTP queries with.
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }

    return { token, userId };
  },
  component: RootComponent,
  head: () => ({
    links: [
      { href: appCssUrl, rel: 'stylesheet' },
      { href: '/convex.svg', rel: 'icon' },
    ],
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        content: 'width=device-width, initial-scale=1',
        name: 'viewport',
      },
      {
        title: 'Convex + TanStack Start + WorkOS AuthKit',
      },
    ],
  }),
  notFoundComponent: () => <div>Not Found</div>,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {import.meta.env.DEV && <script src="//unpkg.com/react-grab/dist/index.global.js" />}
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
        <Scripts />
        {import.meta.env.DEV && <script defer src="//unpkg.com/@react-grab/claude-code/dist/client.global.js" />}
      </body>
    </html>
  );
}
