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

    test('toggling schedule shift checkboxes updates their state', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='schedule' onClose={vi.fn()} />
        </TestWrapper>,
      )

      // Test Flexible schedule checkbox (unique to schedule drawer)
      const flexibleLabel = screen.getByText('Flexible schedule')
      const flexibleCheckbox = flexibleLabel.element().closest('div')?.querySelector('[role="checkbox"]')
      expect(flexibleCheckbox).not.toBeNull()

      // Initially unchecked
      expect(flexibleCheckbox?.getAttribute('data-state')).toBe('unchecked')

      // Click to check
      await flexibleCheckbox?.click()
      expect(flexibleCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('toggling quick apply checkboxes updates their state', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='quickApply' onClose={vi.fn()} />
        </TestWrapper>,
      )

      // Test "Prioritize urgent hiring" checkbox
      const urgentLabel = screen.getByText('Prioritize urgent hiring')
      const urgentCheckbox = urgentLabel.element().closest('div')?.querySelector('[role="checkbox"]')
      expect(urgentCheckbox).not.toBeNull()

      // Initially unchecked
      expect(urgentCheckbox?.getAttribute('data-state')).toBe('unchecked')

      // Click to check
      await urgentCheckbox?.click()
      expect(urgentCheckbox?.getAttribute('data-state')).toBe('checked')

      // Click again to uncheck
      await urgentCheckbox?.click()
      expect(urgentCheckbox?.getAttribute('data-state')).toBe('unchecked')
    })

    test('toggling easy apply checkbox updates its state', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='quickApply' onClose={vi.fn()} />
        </TestWrapper>,
      )

      // Test "Prioritize easy apply jobs" checkbox
      const easyApplyLabel = screen.getByText('Prioritize easy apply jobs')
      const easyApplyCheckbox = easyApplyLabel.element().closest('div')?.querySelector('[role="checkbox"]')
      expect(easyApplyCheckbox).not.toBeNull()

      // Initially unchecked
      expect(easyApplyCheckbox?.getAttribute('data-state')).toBe('unchecked')

      // Click to check - user wants to see easy apply jobs first
      await easyApplyCheckbox?.click()
      expect(easyApplyCheckbox?.getAttribute('data-state')).toBe('checked')

      // Click again to uncheck
      await easyApplyCheckbox?.click()
      expect(easyApplyCheckbox?.getAttribute('data-state')).toBe('unchecked')
    })

    test('toggling commute rail checkbox updates its state', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='commute' onClose={vi.fn()} />
        </TestWrapper>,
      )

      // Test "Rail" transit checkbox
      const railLabel = screen.getByText('Rail')
      const railCheckbox = railLabel.element().closest('div')?.querySelector('[role="checkbox"]')
      expect(railCheckbox).not.toBeNull()

      // Initially unchecked
      expect(railCheckbox?.getAttribute('data-state')).toBe('unchecked')

      // Click to check - user wants rail-accessible jobs
      await railCheckbox?.click()
      expect(railCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('toggling afternoon shift checkbox updates schedule preferences', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='schedule' onClose={vi.fn()} />
        </TestWrapper>,
      )

      // Test "Afternoon" shift checkbox
      const afternoonLabel = screen.getByText('Afternoon')
      const afternoonCheckbox = afternoonLabel.element().closest('div')?.querySelector('[role="checkbox"]')
      expect(afternoonCheckbox).not.toBeNull()

      // Initially unchecked
      expect(afternoonCheckbox?.getAttribute('data-state')).toBe('unchecked')

      // Click to check - user wants afternoon shifts
      await afternoonCheckbox?.click()
      expect(afternoonCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('toggling morning shift checkbox updates schedule preferences', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='schedule' onClose={vi.fn()} />
        </TestWrapper>,
      )

      // Test "Morning" shift checkbox
      const morningLabel = screen.getByText('Morning')
      const morningCheckbox = morningLabel.element().closest('div')?.querySelector('[role="checkbox"]')
      expect(morningCheckbox).not.toBeNull()

      // Initially unchecked
      expect(morningCheckbox?.getAttribute('data-state')).toBe('unchecked')

      // Click to check - user wants morning shifts
      await morningCheckbox?.click()
      expect(morningCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('toggling evening shift checkbox updates schedule preferences', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='schedule' onClose={vi.fn()} />
        </TestWrapper>,
      )

      // Test "Evening" shift checkbox
      const eveningLabel = screen.getByText('Evening')
      const eveningCheckbox = eveningLabel.element().closest('div')?.querySelector('[role="checkbox"]')
      expect(eveningCheckbox).not.toBeNull()

      // Initially unchecked
      expect(eveningCheckbox?.getAttribute('data-state')).toBe('unchecked')

      // Click to check - user wants evening shifts
      await eveningCheckbox?.click()
      expect(eveningCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('toggling overnight shift checkbox updates schedule preferences', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='schedule' onClose={vi.fn()} />
        </TestWrapper>,
      )

      // Test "Overnight" shift checkbox - users who can work night shifts (e.g., night security, 24hr retail)
      const overnightLabel = screen.getByText('Overnight')
      const overnightCheckbox = overnightLabel.element().closest('div')?.querySelector('[role="checkbox"]')
      expect(overnightCheckbox).not.toBeNull()

      // Initially unchecked
      expect(overnightCheckbox?.getAttribute('data-state')).toBe('unchecked')

      // Click to check - user is available for overnight work
      await overnightCheckbox?.click()
      expect(overnightCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('toggling require fair-chance only checkbox updates preferences', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='fairChance' onClose={vi.fn()} />
        </TestWrapper>,
      )

      // Test "Only show fair-chance employers" checkbox - stricter filter for users with backgrounds
      const requireLabel = screen.getByText('Only show fair-chance employers')
      const requireCheckbox = requireLabel.element().closest('div')?.querySelector('[role="checkbox"]')
      expect(requireCheckbox).not.toBeNull()

      // Initially unchecked
      expect(requireCheckbox?.getAttribute('data-state')).toBe('unchecked')

      // Click to check - user requires fair-chance employers only (not just preferred)
      await requireCheckbox?.click()
      expect(requireCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('toggling bus transit checkbox updates commute preferences', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='commute' onClose={vi.fn()} />
        </TestWrapper>,
      )

      // Test "Bus" transit checkbox - users who commute by bus want to filter by bus accessibility
      const busLabel = screen.getByText('Bus')
      const busCheckbox = busLabel.element().closest('div')?.querySelector('[role="checkbox"]')
      expect(busCheckbox).not.toBeNull()

      // Initially unchecked
      expect(busCheckbox?.getAttribute('data-state')).toBe('unchecked')

      // Click to check - user wants bus-accessible jobs
      await busCheckbox?.click()
      expect(busCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('toggling public transit checkbox updates commute preferences', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='commute' onClose={vi.fn()} />
        </TestWrapper>,
      )

      // Test "Only show jobs reachable by public transit" checkbox
      const transitLabel = screen.getByText('Only show jobs reachable by public transit')
      const transitCheckbox = transitLabel.element().closest('div')?.querySelector('[role="checkbox"]')
      expect(transitCheckbox).not.toBeNull()

      // Initially unchecked
      expect(transitCheckbox?.getAttribute('data-state')).toBe('unchecked')

      // Click to check - user wants only transit-accessible jobs
      await transitCheckbox?.click()
      expect(transitCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('selecting max commute time updates the dropdown value', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='commute' onClose={vi.fn()} />
        </TestWrapper>,
      )

      // User wants to set their maximum commute time to filter jobs
      // Find the Select trigger (initially shows "No limit")
      const selectTrigger = screen.getByRole('combobox')
      await expect.element(selectTrigger).toBeVisible()

      // Click to open dropdown
      await selectTrigger.click()

      // Select "30 minutes" option - user sets max commute
      const option30 = screen.getByRole('option', { name: '30 minutes' })
      await expect.element(option30).toBeVisible()
      await option30.click()

      // Verify the selection is reflected in the trigger (now shows "30 minutes")
      await expect.element(selectTrigger).toHaveTextContent('30 minutes')
    })
  })

  describe('Location Drawer Address Input', () => {
    test('typing in address input updates the field value', async () => {
      const screen = await render(
        <TestWrapper>
          <FilterDrawer category='location' onClose={vi.fn()} />
        </TestWrapper>,
      )

      // User wants to manually enter their home address (e.g., no GPS on their device)
      const addressInput = screen.getByPlaceholder('123 Main St, City, State')
      await expect.element(addressInput).toBeVisible()

      // User types their address
      await addressInput.fill('456 Oak Avenue, Chicago, IL')

      // Verify the input value is updated
      await expect.element(addressInput).toHaveValue('456 Oak Avenue, Chicago, IL')
    })
  })
})
