import type { ConvexQueryClient } from '@convex-dev/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import type { ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'
import appCssUrl from '../app.css?url'

const fetchWorkosAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const auth = await getAuth()
  const { user } = auth

  return {
    token: user ? auth.accessToken : null,
    userId: user?.id ?? null,
  }
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexClient: ConvexReactClient
  convexQueryClient: ConvexQueryClient
}>()({
  beforeLoad: async ctx => {
    const { userId, token } = await fetchWorkosAuth()

    // During SSR only (the only time serverHttpClient exists),
    // set the Clerk auth token to make HTTP queries with.
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
    }

    return { token, userId }
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
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang='en'>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
