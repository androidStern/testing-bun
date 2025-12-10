# Admin Route Authentication Race Condition Analysis

## 1. What Is Going Wrong

### Symptom
The `/admin` route intermittently fails with "Authentication required" errors during page load. Looking at Convex logs, queries fail and succeed within milliseconds of each other:

```
Dec 09, 20:03:52.990 - senders:list - failure - "Authentication required"
Dec 09, 20:03:52.990 - inboundMessages:list - failure - "Authentication required"
Dec 09, 20:03:52.986 - senders:list - failure - "Authentication required"
Dec 09, 20:03:52.986 - inboundMessages:list - failure - "Authentication required"
Dec 09, 20:03:52.977 - auth:isAdmin - success (cached)
Dec 09, 20:03:53.142 - senders:list - success (cached)
Dec 09, 20:03:53.142 - auth:isAdmin - success (cached)
Dec 09, 20:03:53.142 - inboundMessages:list - success (cached)
```

The failures happen at `52.986-52.990`, then successes at `53.142` - a ~150ms gap where auth wasn't ready.

### Root Cause Hypothesis
There's a race condition during client-side hydration where:
1. SSR completes successfully (token set via `serverHttpClient.setAuth()`)
2. Client hydration begins
3. TanStack Query tries to revalidate/resubscribe to queries
4. Convex websocket authentication hasn't completed yet
5. Queries fail with "Authentication required"
6. Moments later, websocket auth completes
7. Subsequent queries succeed

---

## 2. Code Samples of All Relevant Parts

### 2.1 Root Route - Token Setup (`src/routes/__root.tsx`)

```typescript
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
  // ... head config
})
```

**Key point:** `serverHttpClient?.setAuth(token)` only exists during SSR. On client, this is `undefined`.

### 2.2 Router Setup (`src/router.tsx`)

```typescript
import { ConvexQueryClient } from '@convex-dev/react-query'
import { QueryClient } from '@tanstack/react-query'
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react'
import { AuthKitProvider, useAccessToken, useAuth } from '@workos/authkit-tanstack-react-start/client'

export function getRouter() {
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL!
  const convex = new ConvexReactClient(CONVEX_URL)
  const convexQueryClient = new ConvexQueryClient(convex)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        gcTime: 5000,
      },
    },
  })
  convexQueryClient.connect(queryClient)

  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
    defaultPreloadStaleTime: 0, // Let React Query handle all caching
    context: { queryClient, convexClient: convex, convexQueryClient },
    Wrap: ({ children }) => (
      <AuthKitProvider>
        <ConvexProviderWithAuth client={convexQueryClient.convexClient} useAuth={useAuthFromWorkOS}>
          {children}
        </ConvexProviderWithAuth>
      </AuthKitProvider>
    ),
  })

  return router
}

function useAuthFromWorkOS() {
  const { loading, user } = useAuth()
  const { accessToken, getAccessToken } = useAccessToken()

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!accessToken || forceRefreshToken) {
        return (await getAccessToken()) ?? null
      }
      return accessToken
    },
    [accessToken, getAccessToken],
  )

  return useMemo(
    () => ({
      isLoading: loading,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [loading, user, fetchAccessToken],
  )
}
```

**Key point:** `ConvexProviderWithAuth` manages client-side auth state. It calls `fetchAccessToken` and passes tokens to the Convex websocket. This is asynchronous.

### 2.3 Authenticated Layout (`src/routes/_authenticated.tsx`)

```typescript
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getAuth, getSignInUrl } from '@workos/authkit-tanstack-react-start'

export const Route = createFileRoute('/_authenticated')({
  loader: async ({ location }) => {
    const { user } = await getAuth()
    if (!user) {
      const path = location.pathname
      const href = await getSignInUrl({ data: { returnPathname: path } })
      throw redirect({ href })
    }
  },
  component: () => <Outlet />,
})
```

**Key point:** This only checks WorkOS auth (server-side), not Convex auth state.

### 2.4 Admin Layout (`src/routes/_authenticated/_admin.tsx`)

```typescript
import { convexQuery } from '@convex-dev/react-query'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { api } from '../../../convex/_generated/api'

export const Route = createFileRoute('/_authenticated/_admin')({
  beforeLoad: async ({ context }) => {
    const isAdmin = await context.queryClient.fetchQuery(
      convexQuery(api.auth.isAdmin, {}),
    )

    if (!isAdmin) {
      throw redirect({ to: '/' })
    }
  },
  component: () => <Outlet />,
})
```

**Key point:** Uses `fetchQuery` (not `ensureQueryData`) - this actually waits for the query. If auth isn't ready, this query could fail.

### 2.5 Admin Dashboard Route (`src/routes/_authenticated/_admin/admin.tsx`)

```typescript
import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '../../../../convex/_generated/api'

export const Route = createFileRoute('/_authenticated/_admin/admin')({
  component: AdminDashboard,
  loader: async ({ context }) => {
    // Preload ALL tab data in parallel - useSuspenseQuery won't suspend since data is cached
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.senders.list, { status: 'pending' }),
      ),
      context.queryClient.ensureQueryData(convexQuery(api.senders.list, {})),
      context.queryClient.ensureQueryData(
        convexQuery(api.inboundMessages.list, { status: 'pending_review' }),
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.inboundMessages.list, {}),
      ),
    ])
  },
})

function AdminDashboard() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <Tabs defaultValue="pending-senders">
        <TabsContent value="pending-senders">
          <PendingSendersTab />
        </TabsContent>
        {/* ... other tabs */}
      </Tabs>
    </div>
  )
}

function PendingSendersTab() {
  const { data: senders } = useSuspenseQuery(
    convexQuery(api.senders.list, { status: 'pending' }),
  )
  // ...
}
```

**Key point:** The `loader` calls `ensureQueryData` which:
- During SSR: Uses `serverHttpClient` (token is set in root beforeLoad)
- During client hydration: Uses React Query's cache OR refetches via Convex websocket

### 2.6 Convex Auth Functions (`convex/functions.ts`)

```typescript
import { customCtx, customQuery } from 'convex-helpers/server/customFunctions'
import { query } from './_generated/server'

function isAdminEmail(email: string): boolean {
  const adminEmails =
    process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()) ?? []
  return adminEmails.includes(email.toLowerCase())
}

export const adminQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity?.subject) throw new Error('Authentication required')  // <-- THIS ERROR

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
      .first()

    if (!profile?.email) throw new Error('Profile not found')
    if (!isAdminEmail(profile.email)) throw new Error('Admin access required')

    return { user: { subject: identity.subject, email: profile.email } }
  }),
)
```

**Key point:** `ctx.auth.getUserIdentity()` returns `null` if the Convex client hasn't authenticated yet.

### 2.7 Official WorkOS Template Pattern (for comparison)

From `https://github.com/workos/template-convex-tanstack-react-start-authkit`:

**ConvexClientProvider.tsx:**
```typescript
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [convex] = useState(() => new ConvexReactClient(import.meta.env.VITE_CONVEX_URL!))
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // KEY: During SSR, use plain ConvexProvider (no auth)
  if (!isClient) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>
  }

  // KEY: On client, use ConvexProviderWithAuth
  return (
    <AuthKitProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useAuthFromAuthKit}>
        {children}
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  )
}
```

**Authenticated route loader:**
```typescript
import { fetchQuery } from 'convex/nextjs'

export const Route = createFileRoute('/_authenticated/server')({
  component: ServerPage,
  loader: async () => {
    const auth = await getAuth()
    const accessToken = auth.user ? auth.accessToken : undefined
    const convexUrl = import.meta.env.VITE_CONVEX_URL

    // KEY: Uses fetchQuery with explicit token, not ensureQueryData
    const serverData = await fetchQuery(
      api.myFunctions.listNumbers,
      { count: 3 },
      { token: accessToken, url: convexUrl },
    )

    return { serverData }
  },
})

function ServerPage() {
  const { serverData } = Route.useLoaderData()
  // Also subscribe to real-time updates client-side
  const clientData = useQuery(api.myFunctions.listNumbers, { count: 3 })
  // ...
}
```

---

## 3. Areas of Uncertainty

### 3.1 When exactly does `ensureQueryData` trigger a network request?

**Uncertainty:** Does `ensureQueryData` during client hydration:
- A) Return cached SSR data immediately without network request?
- B) Always revalidate by making a fresh network request?
- C) Check `staleTime` and conditionally refetch?

The code has `defaultPreloadStaleTime: 0` which suggests "always treat as stale", meaning B or C would trigger refetches.

### 3.2 How does `@convex-dev/react-query` handle auth during SSR vs client?

**Uncertainty:** The `convexQuery()` wrapper uses `convexQueryClient.queryFn()` which internally decides whether to use:
- `serverHttpClient` (during SSR, if token is set)
- Websocket connection via `ConvexReactClient` (on client)

During hydration, which path does it take? If the websocket isn't authenticated yet, does it fail immediately or queue the request?

### 3.3 Why does `auth:isAdmin` succeed while other queries fail?

**Uncertainty:** Looking at the logs:
```
Dec 09, 20:03:52.977 - auth:isAdmin - success (cached)
Dec 09, 20:03:52.986 - senders:list - failure
```

`auth:isAdmin` succeeds (cached) 9ms before `senders:list` fails. Why?

Hypotheses:
- A) `auth:isAdmin` was cached from a previous call in `_admin.tsx` beforeLoad
- B) `auth:isAdmin` uses a different auth check path
- C) `auth:isAdmin` query completed during SSR and cache wasn't invalidated

### 3.4 Is the issue in the loader or in useSuspenseQuery?

**Uncertainty:** The error could originate from:
- A) The `loader`'s `ensureQueryData` calls during hydration
- B) The component's `useSuspenseQuery` calls when they resubscribe
- C) Both

The stack trace shows `convex/functions.ts:45` which is the `adminQuery` wrapper. Both `senders.list` and `inboundMessages.list` use `adminQuery`, so both call paths go through the same auth check.

### 3.5 Why does the official template use a different pattern?

**Uncertainty:** The official WorkOS template:
- Uses `fetchQuery` from `convex/nextjs` with explicit `{ token, url }` in loaders
- Uses `useQuery` from `convex/react` in components (not `useSuspenseQuery`)
- Conditionally renders `ConvexProvider` vs `ConvexProviderWithAuth` based on client/server

Your code:
- Uses `ensureQueryData` with `convexQuery` wrapper in loaders
- Uses `useSuspenseQuery` with `convexQuery` in components
- Uses `ConvexProviderWithAuth` always (via `Wrap` in router)
- Sets token via `serverHttpClient.setAuth()` in root `beforeLoad`

Is the official template pattern specifically designed to avoid this race condition?

---

## 4. Deep Technical Discussion

### 4.1 The SSR-to-Client Transition

**SSR Phase:**
1. TanStack Start renders on server
2. Root `beforeLoad` runs → calls `fetchWorkosAuth()` → gets `accessToken`
3. `serverHttpClient.setAuth(token)` makes the token available for HTTP queries
4. `_authenticated` loader runs → `getAuth()` confirms user exists
5. `_admin` beforeLoad runs → `fetchQuery(api.auth.isAdmin)` → uses `serverHttpClient` with token
6. `admin` loader runs → `ensureQueryData` for 4 queries → uses `serverHttpClient` with token
7. Component renders with data
8. HTML sent to client with React Query cache serialized

**Client Hydration Phase:**
1. React begins hydration
2. `AuthKitProvider` initializes → begins loading auth state
3. `ConvexProviderWithAuth` initializes → calls `useAuthFromWorkOS()`
4. `useAuthFromWorkOS` returns `{ isLoading: true, isAuthenticated: false, ... }`
5. `ConvexProviderWithAuth` sees `isLoading: true` → doesn't authenticate websocket yet
6. Meanwhile, TanStack Router/Query may try to revalidate queries
7. Queries hit Convex → `ctx.auth.getUserIdentity()` returns `null` → "Authentication required"
8. Eventually, `useAuth()` resolves, `isLoading: false`, `isAuthenticated: true`
9. `ConvexProviderWithAuth` calls `fetchAccessToken()` → authenticates websocket
10. Subsequent queries succeed

### 4.2 The `staleTime` Factor

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
      gcTime: 5000,  // Garbage collection time
    },
  },
})

const router = createRouter({
  // ...
  defaultPreloadStaleTime: 0, // Let React Query handle all caching
})
```

`defaultPreloadStaleTime: 0` means data loaded in route loaders is immediately considered stale. During hydration, React Query will likely try to revalidate this data.

### 4.3 The ConvexQueryClient Architecture

From `@convex-dev/react-query` source (inferred behavior):

```typescript
class ConvexQueryClient {
  serverHttpClient: ConvexHttpClient | undefined
  convexClient: ConvexReactClient

  queryFn() {
    return async ({ queryKey }) => {
      // During SSR: serverHttpClient exists
      if (this.serverHttpClient) {
        return this.serverHttpClient.query(queryKey.api, queryKey.args)
      }
      // On client: use reactive client
      return this.convexClient.query(queryKey.api, queryKey.args)
    }
  }
}
```

The `serverHttpClient` only exists during SSR. On client, it's `undefined`, so queries go through `convexClient` which requires websocket authentication.

### 4.4 ConvexProviderWithAuth State Machine

```typescript
// Simplified from convex/react source
function ConvexProviderWithAuth({ client, useAuth, children }) {
  const { isLoading, isAuthenticated, fetchAccessToken } = useAuth()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      fetchAccessToken({ forceRefreshToken: false }).then(token => {
        client.setAuth(token)  // This authenticates the websocket
      })
    }
  }, [isLoading, isAuthenticated])

  // Queries made before setAuth() completes will fail
}
```

There's an async gap between:
1. Component mounts
2. `useAuth()` returns `isLoading: false, isAuthenticated: true`
3. `fetchAccessToken()` called
4. Token received
5. `client.setAuth(token)` called
6. Websocket authenticates

### 4.5 Why the Official Template Works

The official template:

1. **Separates SSR and client providers:**
   ```typescript
   if (!isClient) {
     return <ConvexProvider client={convex}>{children}</ConvexProvider>
   }
   return (
     <ConvexProviderWithAuth client={convex} useAuth={...}>
       {children}
     </ConvexProviderWithAuth>
   )
   ```
   This means during SSR, there's no auth at all (queries must be public or use explicit token).

2. **Uses `fetchQuery` with explicit token in loaders:**
   ```typescript
   const serverData = await fetchQuery(
     api.myFunctions.listNumbers,
     { count: 3 },
     { token: accessToken, url: convexUrl },
   )
   ```
   This makes a direct HTTP request with the token, completely bypassing the websocket/ConvexProviderWithAuth flow.

3. **Uses `useQuery` (not `useSuspenseQuery`) in components:**
   ```typescript
   const clientData = useQuery(api.myFunctions.listNumbers, { count: 3 })
   ```
   `useQuery` from `convex/react` handles the "loading" state gracefully - it returns `undefined` while auth is pending rather than throwing.

Your pattern:
- Uses `ensureQueryData` → forces immediate data fetch → if websocket isn't authenticated, throws
- Uses `useSuspenseQuery` → suspends until data available → if websocket isn't authenticated when hydrating, throws

### 4.6 Potential Solutions

**Option A: Use `fetchQuery` pattern from official template**
- Pros: Proven to work, official recommendation
- Cons: Requires restructuring loaders, loses some React Query integration benefits

**Option B: Gate queries on auth state**
- Use `useConvexAuth()` hook in components to check `isLoading`
- Don't render query components until `isLoading === false`
- Pros: Keeps current pattern mostly intact
- Cons: May cause UI flash during auth loading

**Option C: Add retry/error boundary logic**
- Wrap admin dashboard in error boundary that catches auth errors and retries
- Or configure React Query to retry auth failures
- Pros: Minimal code changes
- Cons: Feels like a workaround

**Option D: Investigate `@convex-dev/react-query` options**
- Check if there's a `waitForAuth` or similar option in `convexQuery()`
- Check ConvexQueryClient initialization options
- Pros: Might be a built-in solution
- Cons: Requires documentation research

---

## 5. Questions for Further Investigation

1. Does `@convex-dev/react-query` have any built-in handling for the auth race condition?

2. Why does the current codebase use a different pattern than the official WorkOS template?

3. Is there a way to configure React Query's `staleTime` or revalidation behavior to wait for auth?

4. What happens if you remove the `loader` entirely and rely only on `useSuspenseQuery` in components?

5. Is `ConvexProviderWithAuth` designed to be used with SSR, or only for client-side apps?

6. Could the issue be in WorkOS AuthKit's TanStack Start integration specifically?

7. Does `convexQueryClient.connect(queryClient)` set up any subscriptions that fire during hydration?
