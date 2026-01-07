import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { FilterToolbar } from './FilterToolbar'

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

describe('FilterToolbar', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Schedule Preferences Display', () => {
    test('shows "X shifts" when user has 3 or more shift preferences saved', async () => {
      // Mock useQuery to return preferences with 3+ shifts selected
      // This tests the user scenario where they have multiple shift preferences
      // and expects the UI to summarize them rather than list all
      vi.mocked(useQuery)
        .mockReturnValueOnce({
          // First call: job preferences with 3 shifts selected
          data: {
            shiftMorning: true,
            shiftAfternoon: true,
            shiftEvening: true,
            shiftFlexible: false,
            shiftOvernight: false,
          },
          error: null,
          isLoading: false,
        } as never)
        .mockReturnValueOnce({
          // Second call: profile data (no location set)
          data: {
            homeLat: null,
            homeLon: null,
            location: null,
          },
          error: null,
          isLoading: false,
        } as never)

      const onCategoryClick = vi.fn()
      const screen = await render(
        <TestWrapper>
          <FilterToolbar onCategoryClick={onCategoryClick} />
        </TestWrapper>,
      )

      // User should see "3 shifts" instead of "AM/PM/Eve"
      // This is the expected behavior when they have 3+ shifts selected
      await expect.element(screen.getByText('3 shifts')).toBeVisible()
    })
  })

  describe('Commute Preferences Display', () => {
    test('shows commute time with bus transit mode indicator', async () => {
      vi.mocked(useQuery)
        .mockReturnValueOnce({
          // Job preferences with commute time and bus transit
          data: {
            maxCommuteMinutes: 30,
            requirePublicTransit: true,
            requireBusAccessible: true,
          },
          error: null,
          isLoading: false,
        } as never)
        .mockReturnValueOnce({
          // Profile without transit zones computed yet
          data: {
            homeLat: 27.95,
            homeLon: -82.45,
            location: 'Tampa',
            isochrones: null,
          },
          error: null,
          isLoading: false,
        } as never)

      const onCategoryClick = vi.fn()
      const screen = await render(
        <TestWrapper>
          <FilterToolbar onCategoryClick={onCategoryClick} />
        </TestWrapper>,
      )

      // User should see their commute time with bus indicator
      await expect.element(screen.getByText('30min bus')).toBeVisible()
    })
  })

  describe('Quick Apply Preferences Display', () => {
    test('shows Urgent/Easy when both quick apply preferences are set', async () => {
      vi.mocked(useQuery)
        .mockReturnValueOnce({
          // Job preferences with both quick apply options
          data: {
            preferUrgent: true,
            preferEasyApply: true,
          },
          error: null,
          isLoading: false,
        } as never)
        .mockReturnValueOnce({
          // Profile data
          data: { homeLat: null, homeLon: null },
          error: null,
          isLoading: false,
        } as never)

      const onCategoryClick = vi.fn()
      const screen = await render(
        <TestWrapper>
          <FilterToolbar onCategoryClick={onCategoryClick} />
        </TestWrapper>,
      )

      // User should see their quick apply preferences
      await expect.element(screen.getByText('Urgent/Easy')).toBeVisible()
    })
  })
})
