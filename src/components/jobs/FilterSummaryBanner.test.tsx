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

    test('shows "Fair chance only" when user requires fair-chance employers exclusively', async () => {
      vi.mocked(useQuery).mockReturnValue({
        data: {
          requireSecondChance: true,
        },
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <FilterSummaryBanner />
        </TestWrapper>,
      )

      // User should see that only fair-chance employers are shown
      await expect.element(screen.getByText('Fair chance only')).toBeVisible()
    })

    test('shows "Transit accessible" when user requires public transit without commute time', async () => {
      vi.mocked(useQuery).mockReturnValue({
        data: {
          requirePublicTransit: true,
          // No maxCommuteMinutes set - user just wants transit access, no time limit
        },
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <FilterSummaryBanner />
        </TestWrapper>,
      )

      // User should see transit accessibility is enabled without time restriction
      await expect.element(screen.getByText('Transit accessible')).toBeVisible()
    })

    test('shows commute time with specific transit mode when user selects bus-only', async () => {
      vi.mocked(useQuery).mockReturnValue({
        data: {
          maxCommuteMinutes: 30,
          requirePublicTransit: true,
          requireBusAccessible: true,
          // requireRailAccessible is not set - user only has bus access
        },
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <FilterSummaryBanner />
        </TestWrapper>,
      )

      // User should see "30 min by bus" - their commute time with their specific transit mode
      await expect.element(screen.getByText('30 min by bus')).toBeVisible()
    })

    test('shows "30 min by rail" when user selects rail-only transit mode', async () => {
      vi.mocked(useQuery).mockReturnValue({
        data: {
          maxCommuteMinutes: 30,
          requirePublicTransit: true,
          requireRailAccessible: true,
          // requireBusAccessible is not set - user only has rail access
        },
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <FilterSummaryBanner />
        </TestWrapper>,
      )

      // User should see "30 min by rail" - their commute time with rail-only transit
      await expect.element(screen.getByText('30 min by rail')).toBeVisible()
    })

    test('shows "30 min by transit" when user requires generic transit without specific mode', async () => {
      vi.mocked(useQuery).mockReturnValue({
        data: {
          maxCommuteMinutes: 30,
          requirePublicTransit: true,
          // Neither requireBusAccessible nor requireRailAccessible set - any transit is ok
        },
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <FilterSummaryBanner />
        </TestWrapper>,
      )

      // User should see generic transit text when no specific mode is selected
      await expect.element(screen.getByText('30 min by transit')).toBeVisible()
    })

    test('shows shift names when user has 2 or fewer shift preferences', async () => {
      vi.mocked(useQuery).mockReturnValue({
        data: {
          shiftMorning: true,
          shiftEvening: true,
          // Only 2 shifts - should show names
        },
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <FilterSummaryBanner />
        </TestWrapper>,
      )

      // User should see shift names joined with "&" when 2 or fewer
      await expect.element(screen.getByText('Morning & Evening')).toBeVisible()
    })
  })
})
