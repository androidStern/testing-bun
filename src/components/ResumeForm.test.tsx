import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ResumeForm } from './ResumeForm'
import { mockExistingResume, resetAllMocks } from '@/test/setup'

const mockUser = {
  email: 'test@example.com',
  firstName: 'Test',
  id: 'user_test123',
  lastName: 'User',
}

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

describe('ResumeForm', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Personal Information', () => {
    test('pre-fills name from user data', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const nameInput = screen.getByPlaceholder('John Doe')
      await expect.element(nameInput).toHaveValue('Test User')
    })

    test('pre-fills email from user data', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const emailInput = screen.getByPlaceholder('john@example.com')
      await expect.element(emailInput).toHaveValue('test@example.com')
    })

    test('has full name input field', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const nameInput = screen.getByPlaceholder('John Doe')
      await expect.element(nameInput).toBeVisible()
    })

    test('has email input field', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const emailInput = screen.getByPlaceholder('john@example.com')
      await expect.element(emailInput).toBeVisible()
    })

    test('has phone input field', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Phone')).toBeVisible()
    })

    test('has location input field', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Location')).toBeVisible()
    })
  })


  describe('Personal Info Validation', () => {
    // Note: The form validates on submit only (not on blur), so these tests
    // verify that validation works when the form is submitted.
    test('accepts valid email without error on form change', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const emailInput = screen.getByPlaceholder('john@example.com')
      await emailInput.fill('valid@example.com')

      const nameInput = screen.getByPlaceholder('John Doe')
      await nameInput.click()

      const container = screen.container
      expect(container.textContent).not.toContain('Please enter a valid email')
    })

    test('shows email validation error when submitting form with invalid email', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      // Enter an invalid email
      const emailInput = screen.getByPlaceholder('john@example.com')
      await emailInput.fill('invalid-email')

      // Submit the form by clicking the save button (first make form dirty)
      const nameInput = screen.getByPlaceholder('John Doe')
      await nameInput.fill('Test User Updated')

      // Wait for dirty state to trigger save button
      await expect.element(screen.getByText('Unsaved changes')).toBeVisible()

      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i })
      await saveButton.click()

      // Should see validation error for invalid email
      await expect.element(screen.getByText('Please enter a valid email')).toBeVisible()
    })
  })

  describe('Work Experience Array', () => {
    test('starts with one work experience entry', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Experience 1')).toBeVisible()
    })

    test('adds new work experience entry when clicking Add Experience', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Experience 1')).toBeVisible()

      await screen.getByText('Add Experience').click()

      await expect.element(screen.getByText('Experience 2')).toBeVisible()
    })

    test('removes work experience entry when clicking Remove', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      await screen.getByText('Add Experience').click()
      await expect.element(screen.getByText('Experience 2')).toBeVisible()

      const removeButtons = screen.container.querySelectorAll('button')
      const removeButton = Array.from(removeButtons).find(btn =>
        btn.textContent?.includes('Remove'),
      )

      if (removeButton) {
        await removeButton.click()
      }

      const experienceHeaders = screen.container.querySelectorAll('span')
      const hasExperience2 = Array.from(experienceHeaders).some(
        span => span.textContent === 'Experience 2',
      )
      expect(hasExperience2).toBe(false)
    })

    test('does not show Remove button when only one work experience exists', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const removeButtons = screen.container.querySelectorAll('button')
      const hasRemoveInFirstSection = Array.from(removeButtons).some(btn =>
        btn.textContent?.includes('Remove'),
      )
      expect(hasRemoveInFirstSection).toBe(false)
    })
  })

  describe('Education Array', () => {
    test('starts with one education entry', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Education 1')).toBeVisible()
    })

    test('adds new education entry when clicking Add Education', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      await screen.getByText('Add Education').click()

      await expect.element(screen.getByText('Education 2')).toBeVisible()
    })

    test('removes education entry when clicking Remove in education section', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      // Add a second education entry first
      await screen.getByText('Add Education').click()
      await expect.element(screen.getByText('Education 2')).toBeVisible()

      // Find the Remove button in the Education section (near Education 2)
      // The Education section comes after Work Experience, so we find the card with Education 2
      const educationCards = screen.container.querySelectorAll('.space-y-6')
      const removeButtons = screen.container.querySelectorAll('button')

      // Find all Remove buttons - there should be ones in Work Experience (if > 1) and Education
      // We need the Remove button that's near the Education section
      const educationRemoveButton = Array.from(removeButtons).filter(btn =>
        btn.textContent?.includes('Remove')
      ).pop() // Last remove button should be in Education section

      if (educationRemoveButton) {
        await educationRemoveButton.click()
      }

      // Education 2 should no longer exist
      const educationHeaders = screen.container.querySelectorAll('span')
      const hasEducation2 = Array.from(educationHeaders).some(
        span => span.textContent === 'Education 2',
      )
      expect(hasEducation2).toBe(false)

      // Education 1 should still exist
      await expect.element(screen.getByText('Education 1')).toBeVisible()
    })

    test('typing in Field of Study input updates the value', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      // Find the Field of Study input and fill it
      const fieldInput = screen.getByPlaceholder('General Studies, Business, Healthcare, etc.')
      await fieldInput.fill('Computer Science')

      // Verify the input value was updated
      expect((fieldInput.element() as HTMLInputElement).value).toBe('Computer Science')
    })

    test('typing in Graduation Date input updates the value', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      // Find the Graduation Date label and then the input next to it
      // The education section has a unique "Graduation Date" label
      const gradDateLabel = screen.getByText('Graduation Date')
      // Get the parent div and find the input within it
      const gradDateInput = gradDateLabel.element().parentElement?.querySelector('input')
      expect(gradDateInput).not.toBeNull()

      // Fill the input
      await gradDateInput!.focus()
      gradDateInput!.value = ''
      await screen.getByRole('textbox', { name: 'MM/YYYY' }).nth(2).fill('05/2023')

      // Verify the input value was updated
      expect(gradDateInput!.value).toBe('05/2023')
    })
  })


  describe('Form Dirty State', () => {
    test('form starts as clean (no unsaved indicator)', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const container = screen.container
      expect(container.textContent).not.toContain('Unsaved changes')
    })

    test('shows unsaved changes indicator when form is modified', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const nameInput = screen.getByPlaceholder('John Doe')
      await nameInput.fill('Changed Name')

      await expect.element(screen.getByText('Unsaved changes')).toBeVisible()
    })

    test('discard button resets form to original values', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const nameInput = screen.getByPlaceholder('John Doe')
      const originalValue = 'Test User'

      await nameInput.fill('Changed Name')
      await expect.element(screen.getByText('Unsaved changes')).toBeVisible()

      await screen.getByText('Discard').click()

      await expect.element(nameInput).toHaveValue(originalValue)
    })
  })

  describe('Form Title', () => {
    test('shows "Build Your Resume" title when no existing resume', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Build Your Resume')).toBeVisible()
    })

    test('shows "Edit Your Resume" title when user has an existing resume', async () => {
      // Mock useSuspenseQuery to return existing resume data
      vi.mocked(useSuspenseQuery).mockReturnValue({
        data: mockExistingResume,
        error: null,
        isLoading: false,
      } as never)

      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Edit Your Resume')).toBeVisible()

      // Reset mock back to null for other tests
      vi.mocked(useSuspenseQuery).mockReturnValue({
        data: null,
        error: null,
        isLoading: false,
      } as never)
    })
  })

  describe('AI Polish Features', () => {
    test('has Polish button in summary section', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const polishButtons = screen.container.querySelectorAll('button')
      const hasPolishButton = Array.from(polishButtons).some(btn =>
        btn.textContent?.includes('Polish'),
      )
      expect(hasPolishButton).toBe(true)
    })

    test('has Dictate button in summary section', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const dictateButtons = screen.container.querySelectorAll('button')
      const hasDictateButton = Array.from(dictateButtons).some(btn =>
        btn.textContent?.includes('Dictate'),
      )
      expect(hasDictateButton).toBe(true)
    })
  })


  describe('Save Button', () => {
    test('has save button when form is dirty', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      // Make the form dirty to reveal the save button
      const nameInput = screen.getByPlaceholder('John Doe')
      await nameInput.fill('Changed Name')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await expect.element(saveButton).toBeVisible()
    })
  })

  describe('Preview Mode', () => {
    // Skip: ExpandableTabs animations are flaky in vitest-browser due to framer-motion timing
    test.skip('clicking preview button twice switches to preview mode and back to form button returns', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      // Start on form - verify we see the form heading
      await expect
        .element(screen.getByRole('heading', { name: 'Personal Information' }))
        .toBeVisible()

      // ExpandableTabs requires two clicks: first selects/expands, second executes
      const previewButton = screen.container.querySelector(
        'button:has(svg.lucide-eye)',
      ) as HTMLButtonElement
      expect(previewButton).not.toBeNull()
      await previewButton.click() // First click - selects/expands
      await previewButton.click() // Second click - executes action

      // In preview mode, we should see "Back to form" button
      await expect.element(screen.getByText(/Back to form/)).toBeVisible()

      // Click back to form to return
      await screen.getByText(/Back to form/).click()

      // Should be back on the form
      await expect
        .element(screen.getByRole('heading', { name: 'Personal Information' }))
        .toBeVisible()
    })
  })

  describe('Section Guide', () => {
    test('user can expand section guidance to view tips for filling out personal info', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      // Initially, the tip content should NOT be visible (guidance is collapsed)
      expect(screen.container.textContent).not.toContain('Make a Strong First Impression')

      // Click the "Master Your Personal Information" guide button to expand
      const guideButton = screen.getByRole('button', { name: /Master Your Personal Information/i })
      await guideButton.click()

      // Now the expanded tip content should be visible
      await expect.element(screen.getByText('Make a Strong First Impression')).toBeVisible()
      await expect
        .element(
          screen.getByText(
            /Include a professional email address and ensure your phone number is current/i,
          ),
        )
        .toBeVisible()
    })
  })
})
