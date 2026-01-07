import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { SavedJobsDrawer } from './SavedJobsDrawer'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('SavedJobsDrawer', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Empty State', () => {
    test('shows empty state when user has no saved jobs', async () => {
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        error: null,
        isLoading: false,
        refetch: vi.fn(),
      } as never)

      const screen = await render(
        <TestWrapper>
          <SavedJobsDrawer open={true} onOpenChange={vi.fn()} />
        </TestWrapper>,
      )

      // User should see empty state message
      await expect.element(screen.getByText('No saved jobs yet')).toBeVisible()
      await expect.element(screen.getByText('Swipe right on jobs you like to save them here')).toBeVisible()
      // Header should show count of 0
      await expect.element(screen.getByText('Saved Jobs (0)')).toBeVisible()
    })
  })
})
