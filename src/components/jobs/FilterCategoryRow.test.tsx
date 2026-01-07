import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { FilterCategoryRow } from './FilterCategoryRow'

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

describe('FilterCategoryRow', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  test('clicking Fair Chance button calls onCategoryClick with fairChance category', async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
    } as never)

    const onCategoryClick = vi.fn()
    const screen = await render(
      <TestWrapper>
        <FilterCategoryRow onCategoryClick={onCategoryClick} />
      </TestWrapper>,
    )

    // User clicks the Fair Chance filter button
    const fairChanceButton = screen.getByRole('button', { name: /Fair Chance/i })
    await fairChanceButton.click()

    // Callback should be called with the fairChance category so drawer opens to that section
    expect(onCategoryClick).toHaveBeenCalledWith('fairChance')
  })
})
