import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { ChatHeader } from './ChatHeader'

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
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

describe('ChatHeader', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Active Thread Actions', () => {
    test('shows New button when user has active chat thread', async () => {
      const screen = await render(
        <TestWrapper>
          <ChatHeader
            onForceSearch={vi.fn()}
            onNewChat={vi.fn()}
            isSearching={false}
            hasActiveThread={true}
          />
        </TestWrapper>,
      )

      // User should see New button to start a fresh chat
      await expect.element(screen.getByText('New')).toBeVisible()
    })

    test('shows Redo button with search icon when not searching', async () => {
      const screen = await render(
        <TestWrapper>
          <ChatHeader
            onForceSearch={vi.fn()}
            isSearching={false}
            hasActiveThread={true}
          />
        </TestWrapper>,
      )

      // User should see Redo button to run search again
      await expect.element(screen.getByText('Redo')).toBeVisible()
    })

    test('shows "Searching..." with spinner when search is in progress', async () => {
      const screen = await render(
        <TestWrapper>
          <ChatHeader
            onForceSearch={vi.fn()}
            isSearching={true}
            hasActiveThread={true}
          />
        </TestWrapper>,
      )

      // User should see loading state
      await expect.element(screen.getByText('Searching...')).toBeVisible()
    })
  })

  describe('Filter Drawer Interaction', () => {
    test('clicking filter category button opens the filter drawer', async () => {
      const screen = await render(
        <TestWrapper>
          <ChatHeader
            onForceSearch={vi.fn()}
            isSearching={false}
            hasActiveThread={true}
          />
        </TestWrapper>,
      )

      // Find and click one of the filter category buttons (e.g., Fair Chance)
      const fairChanceButton = screen.getByRole('button', { name: /fair chance/i })
      await fairChanceButton.click()

      // After clicking, the filter drawer should open with Fair Chance options
      await expect.element(screen.getByText('Prioritize fair-chance employers')).toBeVisible()
    })

    test('clicking Cancel button in filter drawer closes the drawer', async () => {
      const screen = await render(
        <TestWrapper>
          <ChatHeader
            onForceSearch={vi.fn()}
            isSearching={false}
            hasActiveThread={true}
          />
        </TestWrapper>,
      )

      // Open the filter drawer
      const fairChanceButton = screen.getByRole('button', { name: /fair chance/i })
      await fairChanceButton.click()

      // Verify drawer is open
      await expect.element(screen.getByText('Prioritize fair-chance employers')).toBeVisible()

      // Click Cancel to close the drawer (this triggers handleDrawerClose)
      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      await cancelButton.click()

      // Drawer should be closed - fair chance checkbox should no longer be visible
      await expect.element(screen.getByText('Prioritize fair-chance employers')).not.toBeInTheDocument()
    })
  })
})
