import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { HomeLocationCard } from './HomeLocationCard'
import * as geo from '@/lib/geo'

// Mock geo module
vi.mock('@/lib/geo', () => ({
  getCityFromCoords: vi.fn(),
  getUserLocation: vi.fn(),
  geocodeAddress: vi.fn(),
}))

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

describe('HomeLocationCard', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Initial Display', () => {
    test('shows "No location set" when user has not set their home location', async () => {
      // Mock profile with no home location
      vi.mocked(useQuery).mockReturnValue({
        data: {
          workosUserId: 'user_123',
          homeLat: null,
          homeLon: null,
          isochrones: null,
        },
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <HomeLocationCard workosUserId="user_123" />
        </TestWrapper>,
      )

      // User should see clear indication that no location is set
      await expect.element(screen.getByText('No location set')).toBeVisible()

      // User should see a button to set their location
      await expect.element(screen.getByText('Use my location')).toBeVisible()
    })

    test('shows "Enter manually" button as alternative to auto-detection', async () => {
      vi.mocked(useQuery).mockReturnValue({
        data: {
          workosUserId: 'user_123',
          homeLat: null,
          homeLon: null,
        },
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <HomeLocationCard workosUserId="user_123" />
        </TestWrapper>,
      )

      // Users should have option to enter location manually
      await expect.element(screen.getByText('Enter manually')).toBeVisible()
    })
  })

  describe('Location Set Display', () => {
    test('shows city name and "Transit zones ready" when location and isochrones are set', async () => {
      // Mock profile with location and computed isochrones
      vi.mocked(useQuery).mockReturnValue({
        data: {
          workosUserId: 'user_123',
          homeLat: 27.9506,
          homeLon: -82.4572,
          isochrones: { computedAt: Date.now() },
        },
        error: null,
        isLoading: false,
      } as never)

      // Mock getCityFromCoords to return a city name
      vi.mocked(geo.getCityFromCoords).mockResolvedValue('Tampa')

      const screen = await render(
        <TestWrapper>
          <HomeLocationCard workosUserId="user_123" />
        </TestWrapper>,
      )

      // User should see their city name displayed
      await expect.element(screen.getByText('Tampa')).toBeVisible()

      // User should see confirmation that transit zones are computed
      await expect.element(screen.getByText('Transit zones ready')).toBeVisible()

      // Button should show "Update" instead of "Use my location"
      await expect.element(screen.getByText('Update')).toBeVisible()
    })
  })
})
