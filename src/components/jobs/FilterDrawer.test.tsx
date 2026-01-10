import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderWithProviders, resetAllMocks } from '@/test'
import { FilterDrawer } from './FilterDrawer'

describe('FilterDrawer', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Drawer Visibility', () => {
    test('does not render content when category is null', async () => {
      const screen = await renderWithProviders(
        <FilterDrawer category={null} onClose={vi.fn()} />,
      )

      const drawer = screen.container.querySelector('[data-state="open"]')
      expect(drawer).toBeNull()
    })

    test('renders correct drawer for each category', async () => {
      // Test commute drawer
      let screen = await renderWithProviders(
        <FilterDrawer category="commute" onClose={vi.fn()} />,
      )
      await expect
        .element(screen.getByText('Set your maximum commute time and transit preferences.'))
        .toBeVisible()

      // Test fair chance drawer
      screen = await renderWithProviders(
        <FilterDrawer category="fairChance" onClose={vi.fn()} />,
      )
      await expect.element(screen.getByText('Fair Chance')).toBeVisible()

      // Test location drawer
      screen = await renderWithProviders(
        <FilterDrawer category="location" onClose={vi.fn()} />,
      )
      await expect
        .element(screen.getByText('Set your home location to find jobs near you.'))
        .toBeVisible()

      // Test quick apply drawer
      screen = await renderWithProviders(
        <FilterDrawer category="quickApply" onClose={vi.fn()} />,
      )
      await expect.element(screen.getByText('Quick Apply')).toBeVisible()

      // Test schedule drawer
      screen = await renderWithProviders(
        <FilterDrawer category="schedule" onClose={vi.fn()} />,
      )
      await expect
        .element(screen.getByText("Select the shifts you're available to work."))
        .toBeVisible()
    })
  })

  describe('Commute Drawer', () => {
    test('shows all commute options', async () => {
      const screen = await renderWithProviders(
        <FilterDrawer category="commute" onClose={vi.fn()} />,
      )

      await expect
        .element(screen.getByText('Maximum commute time', { exact: true }))
        .toBeVisible()
      await expect
        .element(screen.getByText('Only show jobs reachable by public transit'))
        .toBeVisible()
      await expect.element(screen.getByText('Bus')).toBeVisible()
      await expect.element(screen.getByText('Rail')).toBeVisible()
    })
  })

  describe('Fair Chance Drawer', () => {
    test('shows fair chance options', async () => {
      const screen = await renderWithProviders(
        <FilterDrawer category="fairChance" onClose={vi.fn()} />,
      )

      await expect.element(screen.getByText('Prioritize fair-chance employers')).toBeVisible()
      await expect.element(screen.getByText('Only show fair-chance employers')).toBeVisible()
    })
  })

  describe('Schedule Drawer', () => {
    test('shows all shift options', async () => {
      const screen = await renderWithProviders(
        <FilterDrawer category="schedule" onClose={vi.fn()} />,
      )

      await expect.element(screen.getByText('Morning')).toBeVisible()
      await expect.element(screen.getByText('Afternoon')).toBeVisible()
      await expect.element(screen.getByText('Evening')).toBeVisible()
      await expect.element(screen.getByText('Overnight')).toBeVisible()
      await expect.element(screen.getByText('Flexible schedule')).toBeVisible()
    })
  })

  describe('Quick Apply Drawer', () => {
    test('shows quick apply options', async () => {
      const screen = await renderWithProviders(
        <FilterDrawer category="quickApply" onClose={vi.fn()} />,
      )

      await expect.element(screen.getByText('Prioritize urgent hiring')).toBeVisible()
      await expect.element(screen.getByText('Prioritize easy apply jobs')).toBeVisible()
    })
  })

  describe('Location Drawer', () => {
    test('shows location options', async () => {
      const screen = await renderWithProviders(
        <FilterDrawer category="location" onClose={vi.fn()} />,
      )

      await expect.element(screen.getByText('Use my current location')).toBeVisible()
      await expect.element(screen.getByText('Or enter your address')).toBeVisible()
    })
  })

  describe('Drawer Actions', () => {
    test('non-location drawers have Apply and Cancel buttons', async () => {
      const screen = await renderWithProviders(
        <FilterDrawer category="commute" onClose={vi.fn()} />,
      )

      await expect.element(screen.getByText('Apply')).toBeVisible()
      await expect.element(screen.getByText('Cancel')).toBeVisible()
    })

    test('location drawer has Close button', async () => {
      const screen = await renderWithProviders(
        <FilterDrawer category="location" onClose={vi.fn()} />,
      )

      await expect.element(screen.getByText('Close')).toBeVisible()
    })
  })
})
