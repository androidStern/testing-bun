import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as vitestRender } from 'vitest-browser-react'
import type { ReactNode } from 'react'

/**
 * Creates a QueryClient configured for testing (no retries, no gc)
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/**
 * Default test wrapper with QueryClientProvider.
 * Use this when you need a wrapper component directly.
 */
export function TestWrapper({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

/**
 * Render options for customizing the test wrapper
 */
interface RenderOptions {
  /** Override the default QueryClient (useful for pre-seeding data) */
  queryClient?: QueryClient
}

/**
 * Renders a component with standard test providers.
 * Wraps vitest-browser-react's render with QueryClientProvider.
 *
 * @example
 * // Basic usage
 * const screen = await renderWithProviders(<ProfileForm user={mockUser} />)
 *
 * @example
 * // With pre-seeded query data
 * const queryClient = createTestQueryClient()
 * queryClient.setQueryData(['key'], mockData)
 * const screen = await renderWithProviders(<MyComponent />, { queryClient })
 */
export async function renderWithProviders(ui: ReactNode, options: RenderOptions = {}) {
  const { queryClient = createTestQueryClient() } = options

  return vitestRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}
