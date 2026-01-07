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

  describe('Saved Jobs List', () => {
    test('shows saved job cards with details when user has saved jobs', async () => {
      const mockSavedJobs = [
        {
          _id: 'review1',
          jobId: 'job1',
          jobSnapshot: {
            title: 'Software Engineer',
            company: 'Acme Corp',
            location: 'Chicago, IL',
            salary: '$50,000 - $70,000',
            shifts: ['morning', 'afternoon'],
            isSecondChance: true,
            url: 'https://example.com/apply',
          },
          reviewedAt: Date.now(),
        },
      ]

      vi.mocked(useQuery).mockReturnValue({
        data: mockSavedJobs,
        error: null,
        isLoading: false,
        refetch: vi.fn(),
      } as never)

      const screen = await render(
        <TestWrapper>
          <SavedJobsDrawer open={true} onOpenChange={vi.fn()} />
        </TestWrapper>,
      )

      // Header should show count
      await expect.element(screen.getByText('Saved Jobs (1)')).toBeVisible()
      // Job details should be visible
      await expect.element(screen.getByText('Software Engineer')).toBeVisible()
      await expect.element(screen.getByText('Acme Corp')).toBeVisible()
      await expect.element(screen.getByText('Chicago, IL')).toBeVisible()
      await expect.element(screen.getByText('$50,000 - $70,000')).toBeVisible()
      await expect.element(screen.getByText('morning, afternoon')).toBeVisible()
      // Apply button should link to job
      const applyLink = screen.getByRole('link', { name: /Apply Now/i })
      await expect.element(applyLink).toBeVisible()
      await expect.element(applyLink).toHaveAttribute('href', 'https://example.com/apply')
    })
  })
})
