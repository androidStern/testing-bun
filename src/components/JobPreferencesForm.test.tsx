import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { JobPreferencesForm } from './JobPreferencesForm'

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

describe('JobPreferencesForm', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Commute Preferences', () => {
    test('renders commute section with title', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Commute', { exact: true })).toBeVisible()
    })

    test('has max commute time select', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Maximum commute time', { exact: true })).toBeVisible()
    })

    test('has public transit checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect
        .element(screen.getByText('Only show jobs reachable by public transit'))
        .toBeVisible()
    })

    test('has bus accessible checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Require bus access')).toBeVisible()
    })

    test('has rail accessible checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Require rail access')).toBeVisible()
    })
  })

  describe('Second Chance Preferences', () => {
    test('renders second chance section with title', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Second Chance Employers')).toBeVisible()
    })

    test('has prefer second chance checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect
        .element(screen.getByText('Prioritize second-chance employers in results'))
        .toBeVisible()
    })

    test('has require second chance checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Only show second-chance employers')).toBeVisible()
    })
  })

  describe('Shift Preferences', () => {
    test('renders shift section with title', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Shift Availability')).toBeVisible()
    })

    test('has morning shift checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Morning')).toBeVisible()
    })

    test('has afternoon shift checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Afternoon')).toBeVisible()
    })

    test('has evening shift checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Evening')).toBeVisible()
    })

    test('has overnight shift checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Overnight')).toBeVisible()
    })

    test('has flexible shift checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Flexible')).toBeVisible()
    })
  })

  describe('Other Preferences', () => {
    test('renders other preferences section with title', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Other Preferences')).toBeVisible()
    })

    test('has prefer urgent checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Prioritize urgent hiring')).toBeVisible()
    })

    test('has prefer easy apply checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Prioritize easy apply jobs')).toBeVisible()
    })
  })

  describe('Form Submission', () => {
    test('has save preferences button', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Save Preferences')).toBeVisible()
    })

    test('can toggle checkboxes', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      const morningLabel = screen.getByText('Morning')
      await morningLabel.click()

      const morningCheckbox = screen.container.querySelector(
        'button[role="checkbox"][id*="shiftMorning"]',
      ) as HTMLElement | null

      expect(morningCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('can toggle overnight shift checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      const overnightLabel = screen.getByText('Overnight')
      await overnightLabel.click()

      const overnightCheckbox = screen.container.querySelector(
        'button[role="checkbox"][id*="shiftOvernight"]',
      ) as HTMLElement | null

      expect(overnightCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('can toggle flexible shift checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      const flexibleLabel = screen.getByText('Flexible')
      await flexibleLabel.click()

      const flexibleCheckbox = screen.container.querySelector(
        'button[role="checkbox"][id*="shiftFlexible"]',
      ) as HTMLElement | null

      expect(flexibleCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('can toggle afternoon shift checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      const afternoonLabel = screen.getByText('Afternoon')
      await afternoonLabel.click()

      const afternoonCheckbox = screen.container.querySelector(
        'button[role="checkbox"][id*="shiftAfternoon"]',
      ) as HTMLElement | null

      expect(afternoonCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('can toggle evening shift checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      const eveningLabel = screen.getByText('Evening')
      await eveningLabel.click()

      const eveningCheckbox = screen.container.querySelector(
        'button[role="checkbox"][id*="shiftEvening"]',
      ) as HTMLElement | null

      expect(eveningCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('can toggle prefer urgent checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      const urgentLabel = screen.getByText('Prioritize urgent hiring')
      await urgentLabel.click()

      const urgentCheckbox = screen.container.querySelector(
        'button[role="checkbox"][id*="preferUrgent"]',
      ) as HTMLElement | null

      expect(urgentCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('can toggle prefer easy apply checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      const easyApplyLabel = screen.getByText('Prioritize easy apply jobs')
      await easyApplyLabel.click()

      const easyApplyCheckbox = screen.container.querySelector(
        'button[role="checkbox"][id*="preferEasyApply"]',
      ) as HTMLElement | null

      expect(easyApplyCheckbox?.getAttribute('data-state')).toBe('checked')
    })

    test('can toggle require bus access checkbox', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      const busLabel = screen.getByText('Require bus access')
      await busLabel.click()

      const busCheckbox = screen.container.querySelector(
        'button[role="checkbox"][id*="requireBusAccessible"]',
      ) as HTMLElement | null

      expect(busCheckbox?.getAttribute('data-state')).toBe('checked')
    })
  })

  describe('Max Commute Time Select', () => {
    test('can select a max commute time from dropdown', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      // Click the select trigger to open the dropdown
      const selectTrigger = screen.container.querySelector(
        'button[role="combobox"]',
      ) as HTMLButtonElement
      expect(selectTrigger).not.toBeNull()
      await selectTrigger.click()

      // Wait for dropdown to open and select 30 minutes option using role
      const option30 = screen.getByRole('option', { name: '30 minutes' })
      await expect.element(option30).toBeVisible()
      await option30.click()

      // Verify the selection is reflected in the trigger (use combobox text content)
      const trigger = screen.container.querySelector(
        'button[role="combobox"]',
      ) as HTMLButtonElement
      await expect.element(trigger).toHaveTextContent('30 minutes')
    })
  })
})
