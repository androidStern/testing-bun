import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { FilterSummaryBanner } from './FilterSummaryBanner'

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

describe('FilterSummaryBanner', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('No Filters State', () => {
    test('shows "Showing all jobs" when user has no filter preferences set', async () => {
      // Mock useQuery to return no preferences
      vi.mocked(useQuery).mockReturnValue({
        data: null,
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <FilterSummaryBanner />
        </TestWrapper>,
      )

      // User should see that all jobs are being shown
      await expect.element(screen.getByText('Showing all jobs')).toBeVisible()
    })
  })

  describe('Filter Summary Display', () => {
    test('shows fair chance filter when user prefers second-chance employers', async () => {
      vi.mocked(useQuery).mockReturnValue({
        data: {
          preferSecondChance: true,
        },
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <FilterSummaryBanner />
        </TestWrapper>,
      )

      // User should see their fair chance preference summarized
      await expect.element(screen.getByText('Fair chance preferred')).toBeVisible()
    })
  })
})
