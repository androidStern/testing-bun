import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { PromptEditor } from './PromptEditor'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('PromptEditor', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.mocked(useQuery).mockReturnValue({
      data: 'Default system prompt',
      isLoading: false,
    } as never)
  })

  test('displays prompt label and textarea', async () => {
    const screen = await render(
      <TestWrapper>
        <PromptEditor
          isDirty={false}
          onClear={vi.fn()}
          onChange={vi.fn()}
          value={null}
        />
      </TestWrapper>,
    )

    await expect.element(screen.getByText('Prompt', { exact: true })).toBeVisible()
    await expect.element(screen.getByRole('textbox')).toBeVisible()
  })

  test('shows Modified badge and Reset button when dirty', async () => {
    const onClear = vi.fn()

    const screen = await render(
      <TestWrapper>
        <PromptEditor
          isDirty={true}
          onClear={onClear}
          onChange={vi.fn()}
          value="Custom prompt"
        />
      </TestWrapper>,
    )

    await expect.element(screen.getByText('Modified')).toBeVisible()
    const resetButton = screen.getByRole('button', { name: /Reset/i })
    await expect.element(resetButton).toBeVisible()

    await resetButton.click()
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  test('calls onChange when textarea value changes', async () => {
    const onChange = vi.fn()

    const screen = await render(
      <TestWrapper>
        <PromptEditor
          isDirty={false}
          onClear={vi.fn()}
          onChange={onChange}
          value=""
        />
      </TestWrapper>,
    )

    const textarea = screen.getByRole('textbox')
    await textarea.fill('New prompt text')

    expect(onChange).toHaveBeenCalled()
  })
})
