import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { getCityFromCoords, geocodeAddress, getUserLocation } from './geo'

describe('geo', () => {
  describe('getUserLocation', () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn(),
    }

    beforeEach(() => {
      vi.stubGlobal('navigator', { geolocation: mockGeolocation })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    test('resolves with coordinates on success', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.006,
          },
        })
      })

      const result = await getUserLocation()

      expect(result).toEqual({ lat: 40.7128, lon: -74.006 })
    })

    test('rejects with error message when geolocation fails', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error({
          code: 1, // PERMISSION_DENIED
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        })
      })

      await expect(getUserLocation()).rejects.toThrow(
        'Location permission denied',
      )
    })
  })

  describe('getCityFromCoords', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    test('returns city name from reverse geocode', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          address: {
            city: 'New York',
            state: 'New York',
          },
        }),
      } as Response)

      const result = await getCityFromCoords(40.7128, -74.006)

      expect(result).toBe('New York')
    })

    test('returns "Unknown location" when API fails', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
      } as Response)

      const result = await getCityFromCoords(40.7128, -74.006)

      expect(result).toBe('Unknown location')
    })
  })

  describe('geocodeAddress', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    test('returns coordinates from address', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { lat: '40.7128', lon: '-74.0060' },
        ]),
      } as Response)

      const result = await geocodeAddress('New York, NY')

      expect(result).toEqual({ lat: 40.7128, lon: -74.006 })
    })

    test('throws error when address not found', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)

      await expect(geocodeAddress('nonexistent place xyz')).rejects.toThrow(
        'Address not found',
      )
    })

    test('throws error when API request fails', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
      } as Response)

      await expect(geocodeAddress('New York')).rejects.toThrow(
        'Geocoding request failed',
      )
    })
  })
})
