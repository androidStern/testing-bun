import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { ResumeUploadCard } from './ResumeUploadCard'

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

describe('ResumeUploadCard', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Skip Button', () => {
    test('clicking Skip calls onSkip when provided', async () => {
      const onComplete = vi.fn()
      const onSkip = vi.fn()

      const screen = await render(
        <TestWrapper>
          <ResumeUploadCard onComplete={onComplete} onSkip={onSkip} />
        </TestWrapper>,
      )

      // User decides not to upload a resume and clicks Skip
      const skipButton = screen.getByRole('button', { name: /Skip for now/i })
      await expect.element(skipButton).toBeVisible()
      await skipButton.click()

      // onSkip should be called when skip button is clicked
      expect(onSkip).toHaveBeenCalledTimes(1)
      // onComplete should not be called when onSkip is provided
      expect(onComplete).not.toHaveBeenCalled()
    })

    test('clicking Skip calls onComplete with uploaded: false when onSkip not provided', async () => {
      const onComplete = vi.fn()

      const screen = await render(
        <TestWrapper>
          <ResumeUploadCard onComplete={onComplete} />
        </TestWrapper>,
      )

      // User clicks Skip without onSkip prop - should fall back to onComplete
      const skipButton = screen.getByRole('button', { name: /Skip for now/i })
      await skipButton.click()

      // onComplete should be called with { uploaded: false }
      expect(onComplete).toHaveBeenCalledTimes(1)
      expect(onComplete).toHaveBeenCalledWith({ uploaded: false })
    })
  })

  describe('Content Display', () => {
    test('shows custom reason and title when reason prop is provided', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeUploadCard
            onComplete={vi.fn()}
            reason="We need your resume to find better matches"
          />
        </TestWrapper>,
      )

      // When reason is provided, title should change to "Upload Your Resume"
      await expect.element(screen.getByText('Upload Your Resume')).toBeVisible()
      // Custom reason should be displayed as description
      await expect
        .element(screen.getByText('We need your resume to find better matches'))
        .toBeVisible()
    })
  })
})
