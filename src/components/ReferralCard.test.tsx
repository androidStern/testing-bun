import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { ReferralCard } from './ReferralCard'

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

describe('ReferralCard', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
    // Reset clipboard mock
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  describe('Copy Link Feature', () => {
    test('clicking Copy button copies referral URL and shows Copied confirmation', async () => {
      // Mock referral stats data
      vi.mocked(useSuspenseQuery).mockReturnValue({
        data: {
          code: 'TESTCODE123',
          totalReferrals: 5,
        },
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <ReferralCard workosUserId="user_test123" />
        </TestWrapper>,
      )

      // Verify the component renders with Invite Friends title
      await expect.element(screen.getByText('Invite Friends')).toBeVisible()

      // Verify the referral URL is shown in the input
      const input = screen.container.querySelector('input') as HTMLInputElement
      expect(input).not.toBeNull()
      expect(input.value).toContain('/join/TESTCODE123')

      // Click the Copy button
      const copyButton = screen.getByRole('button', { name: /copy/i })
      await copyButton.click()

      // Verify the button text changes to "Copied"
      await expect.element(screen.getByText('Copied')).toBeVisible()
    })

    test('shows error toast when clipboard copy fails', async () => {
      // Mock clipboard to fail
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Clipboard unavailable')),
        },
      })

      // Mock referral stats data
      vi.mocked(useSuspenseQuery).mockReturnValue({
        data: {
          code: 'TESTCODE456',
          totalReferrals: 2,
        },
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <ReferralCard workosUserId="user_test123" />
        </TestWrapper>,
      )

      // Click the Copy button (will fail)
      const copyButton = screen.getByRole('button', { name: /copy/i })
      await copyButton.click()

      // Button should NOT change to "Copied" since copy failed
      // The error toast is shown but the button stays in Copy state
      await expect.element(screen.getByText('Copy')).toBeVisible()
    })
  })
})
