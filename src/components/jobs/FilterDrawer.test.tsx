import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { FilterDrawer } from './FilterDrawer'
import type { FilterCategory } from './FilterSummaryBanner'

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

describe('FilterDrawer', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Drawer Visibility', () => {
    test('does not render content when category is null', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category={null} onClose={vi.fn()} />
        </TestWrapper>,
      )

      const drawer = screen.container.querySelector('[data-state="open"]')
      expect(drawer).toBeNull()
    })

    test('renders commute drawer when category is commute', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='commute' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect
        .element(screen.getByText('Set your maximum commute time and transit preferences.'))
        .toBeVisible()
    })

    test('renders fair chance drawer when category is fairChance', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='fairChance' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Fair Chance')).toBeVisible()
    })

    test('renders location drawer when category is location', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='location' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect
        .element(screen.getByText('Set your home location to find jobs near you.'))
        .toBeVisible()
    })

    test('renders quick apply drawer when category is quickApply', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='quickApply' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Quick Apply')).toBeVisible()
    })

    test('renders schedule drawer when category is schedule', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='schedule' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect
        .element(screen.getByText("Select the shifts you're available to work."))
        .toBeVisible()
    })
  })

  describe('Commute Drawer Content', () => {
    test('shows max commute time label', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='commute' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect
        .element(screen.getByText('Maximum commute time', { exact: true }))
        .toBeVisible()
    })

    test('shows public transit checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='commute' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect
        .element(screen.getByText('Only show jobs reachable by public transit'))
        .toBeVisible()
    })

    test('shows bus and rail options', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='commute' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Bus')).toBeVisible()
      await expect.element(screen.getByText('Rail')).toBeVisible()
    })
  })

  describe('Fair Chance Drawer Content', () => {
    test('shows prioritize fair-chance checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='fairChance' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Prioritize fair-chance employers')).toBeVisible()
    })

    test('shows only fair-chance checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='fairChance' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Only show fair-chance employers')).toBeVisible()
    })
  })

  describe('Schedule Drawer Content', () => {
    test('shows shift options', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='schedule' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Morning')).toBeVisible()
      await expect.element(screen.getByText('Afternoon')).toBeVisible()
      await expect.element(screen.getByText('Evening')).toBeVisible()
      await expect.element(screen.getByText('Overnight')).toBeVisible()
      await expect.element(screen.getByText('Flexible schedule')).toBeVisible()
    })
  })

  describe('Quick Apply Drawer Content', () => {
    test('shows urgent hiring checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='quickApply' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Prioritize urgent hiring')).toBeVisible()
    })

    test('shows easy apply checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='quickApply' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Prioritize easy apply jobs')).toBeVisible()
    })
  })

  describe('Location Drawer Content', () => {
    test('shows use my location button', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='location' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Use my current location')).toBeVisible()
    })

    test('shows address input', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='location' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Or enter your address')).toBeVisible()
    })
  })

  describe('Drawer Actions', () => {
    test('has Apply button for non-location categories', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='commute' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Apply')).toBeVisible()
    })

    test('has Cancel button', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='commute' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Cancel')).toBeVisible()
    })

    test('has Close button for location category', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='location' onClose={vi.fn()} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Close')).toBeVisible()
    })
  })

  describe('Checkbox Interactions', () => {
    test('toggling fair-chance checkbox updates its state', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='fairChance' onClose={vi.fn()} />
        </TestWrapper>,
      )

      // Find the checkbox by its label association
      const label = screen.getByText('Prioritize fair-chance employers')
      const checkbox = label.element().closest('div')?.querySelector('[role="checkbox"]')
      expect(checkbox).not.toBeNull()

      // Initially unchecked
      expect(checkbox?.getAttribute('data-state')).toBe('unchecked')

      // Click to check
      await checkbox?.click()
      expect(checkbox?.getAttribute('data-state')).toBe('checked')

      // Click again to uncheck
      await checkbox?.click()
      expect(checkbox?.getAttribute('data-state')).toBe('unchecked')
    })
  })
})
