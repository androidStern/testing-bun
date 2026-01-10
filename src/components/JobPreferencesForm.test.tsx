import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { JobPreferencesForm } from './JobPreferencesForm'
import { resetAllMocks } from '@/test/setup'

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

  describe('Form Sections', () => {
    test('renders all preference sections', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      // All main sections should be visible
      await expect.element(screen.getByText('Commute', { exact: true })).toBeVisible()
      await expect.element(screen.getByText('Second Chance Employers')).toBeVisible()
      await expect.element(screen.getByText('Shift Availability')).toBeVisible()
      await expect.element(screen.getByText('Other Preferences')).toBeVisible()
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

    test('checkboxes can be toggled by clicking labels', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      // Toggle a checkbox
      const morningLabel = screen.getByText('Morning')
      await morningLabel.click()

      // Verify it's checked via aria-checked (accessible attribute)
      const checkbox = morningLabel.element().closest('div')?.querySelector('[role="checkbox"]')
      expect(checkbox?.getAttribute('aria-checked')).toBe('true')

      // Toggle off
      await morningLabel.click()
      expect(checkbox?.getAttribute('aria-checked')).toBe('false')
    })

    test('clicking Save Preferences button triggers form submission', async () => {
      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      // Toggle a checkbox to make form dirty
      await screen.getByText('Morning').click()

      // Click the Save Preferences button
      const saveButton = screen.getByRole('button', { name: /Save Preferences/i })
      await saveButton.click()

      // Form should remain usable after submission
      await expect.element(saveButton).toBeVisible()
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

  describe('Loading State', () => {
    test('shows loading spinner while preferences are being fetched', async () => {
      // Mock useQuery to return loading state
      vi.mocked(useQuery).mockReturnValue({
        data: undefined,
        error: null,
        isLoading: true,
        refetch: vi.fn(),
      } as never)

      const screen = await render(
        <TestWrapper>
          <JobPreferencesForm />
        </TestWrapper>,
      )

      // Should show a loading spinner (Loader2 icon)
      const spinner = screen.container.querySelector('svg.animate-spin')
      expect(spinner).not.toBeNull()
    })
  })
})
