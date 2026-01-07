import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { AdminDebugDrawer } from './index'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('AdminDebugDrawer', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.mocked(useQuery).mockReturnValue({
      data: 'Default system prompt',
      isLoading: false,
    } as never)
    localStorage.clear()
  })

  test('displays Debug Panel title when open', async () => {
    const screen = await render(
      <TestWrapper>
        <AdminDebugDrawer
          open={true}
          onOpenChange={vi.fn()}
          threadId={null}
        />
      </TestWrapper>,
    )

    await expect.element(screen.getByText('Debug Panel')).toBeVisible()
  })

  test('contains PromptEditor with Prompt label', async () => {
    const screen = await render(
      <TestWrapper>
        <AdminDebugDrawer
          open={true}
          onOpenChange={vi.fn()}
          threadId={null}
        />
      </TestWrapper>,
    )

    await expect.element(screen.getByText('Prompt', { exact: true })).toBeVisible()
  })
})
