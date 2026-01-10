import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mockConvexMutation, renderWithProviders, resetAllMocks } from '@/test'
import { JobPreferencesForm } from './JobPreferencesForm'

describe('JobPreferencesForm', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Form Sections', () => {
    test('renders all preference sections', async () => {
      const screen = await renderWithProviders(<JobPreferencesForm />)

      // Verify all section titles are present
      await expect.element(screen.getByText('Commute', { exact: true })).toBeVisible()
      await expect.element(screen.getByText('Second Chance Employers')).toBeVisible()
      await expect.element(screen.getByText('Shift Availability')).toBeVisible()
      await expect.element(screen.getByText('Other Preferences')).toBeVisible()
    })

    test('renders commute preferences', async () => {
      const screen = await renderWithProviders(<JobPreferencesForm />)

      await expect
        .element(screen.getByText('Maximum commute time', { exact: true }))
        .toBeVisible()
      await expect
        .element(screen.getByText('Only show jobs reachable by public transit'))
        .toBeVisible()
      await expect.element(screen.getByText('Require bus access')).toBeVisible()
      await expect.element(screen.getByText('Require rail access')).toBeVisible()
    })

    test('renders second chance preferences', async () => {
      const screen = await renderWithProviders(<JobPreferencesForm />)

      await expect
        .element(screen.getByText('Prioritize second-chance employers in results'))
        .toBeVisible()
      await expect.element(screen.getByText('Only show second-chance employers')).toBeVisible()
    })

    test('renders all shift options', async () => {
      const screen = await renderWithProviders(<JobPreferencesForm />)

      await expect.element(screen.getByText('Morning')).toBeVisible()
      await expect.element(screen.getByText('Afternoon')).toBeVisible()
      await expect.element(screen.getByText('Evening')).toBeVisible()
      await expect.element(screen.getByText('Overnight')).toBeVisible()
      await expect.element(screen.getByText('Flexible')).toBeVisible()
    })

    test('renders other preferences', async () => {
      const screen = await renderWithProviders(<JobPreferencesForm />)

      await expect.element(screen.getByText('Prioritize urgent hiring')).toBeVisible()
      await expect.element(screen.getByText('Prioritize easy apply jobs')).toBeVisible()
    })
  })

  describe('Checkbox Interactions', () => {
    test('can toggle shift preferences', async () => {
      const screen = await renderWithProviders(<JobPreferencesForm />)

      // Toggle morning shift
      await screen.getByText('Morning').click()

      const morningCheckbox = screen.container.querySelector(
        'button[role="checkbox"][id*="shiftMorning"]',
      ) as HTMLElement | null
      expect(morningCheckbox?.getAttribute('data-state')).toBe('checked')

      // Toggle evening shift
      await screen.getByText('Evening').click()

      const eveningCheckbox = screen.container.querySelector(
        'button[role="checkbox"][id*="shiftEvening"]',
      ) as HTMLElement | null
      expect(eveningCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('can toggle second chance preferences', async () => {
      const screen = await renderWithProviders(<JobPreferencesForm />)

      await screen.getByText('Prioritize second-chance employers in results').click()

      const preferCheckbox = screen.container.querySelector(
        'button[role="checkbox"][id*="preferSecondChance"]',
      ) as HTMLElement | null
      expect(preferCheckbox?.getAttribute('data-state')).toBe('checked')
    })
  })

  describe('Form Submission', () => {
    test('has save preferences button', async () => {
      const screen = await renderWithProviders(<JobPreferencesForm />)

      await expect.element(screen.getByText('Save Preferences')).toBeVisible()
    })

    test('selecting preferences marks checkboxes as checked', async () => {
      const screen = await renderWithProviders(<JobPreferencesForm />)

      // Select morning shift
      await screen.getByText('Morning').click()
      const morningCheckbox = screen.container.querySelector(
        'button[role="checkbox"][id*="shiftMorning"]',
      ) as HTMLElement | null
      expect(morningCheckbox?.getAttribute('data-state')).toBe('checked')

      // Select evening shift
      await screen.getByText('Evening').click()
      const eveningCheckbox = screen.container.querySelector(
        'button[role="checkbox"][id*="shiftEvening"]',
      ) as HTMLElement | null
      expect(eveningCheckbox?.getAttribute('data-state')).toBe('checked')
    })
  })
})
