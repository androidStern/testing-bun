import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { SavedJobsToggle } from './SavedJobsToggle'

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

describe('SavedJobsToggle', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Saved Jobs Counter', () => {
    test('shows count badge when user has saved jobs', async () => {
      vi.mocked(useQuery).mockReturnValue({
        data: 5,
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <SavedJobsToggle onClick={vi.fn()} />
        </TestWrapper>,
      )

      // User should see their saved job count
      await expect.element(screen.getByText('5')).toBeVisible()
    })

    test('shows 99+ when user has more than 99 saved jobs', async () => {
      vi.mocked(useQuery).mockReturnValue({
        data: 150,
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <SavedJobsToggle onClick={vi.fn()} />
        </TestWrapper>,
      )

      // User should see 99+ for large counts
      await expect.element(screen.getByText('99+')).toBeVisible()
    })

    test('does not show badge when user has no saved jobs', async () => {
      vi.mocked(useQuery).mockReturnValue({
        data: 0,
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <SavedJobsToggle onClick={vi.fn()} />
        </TestWrapper>,
      )

      // Should show Saved button but no count badge
      await expect.element(screen.getByText('Saved')).toBeVisible()
      // Check that no number is visible
      expect(screen.container.textContent).not.toMatch(/\d/)
    })
  })
})
