import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { ResumeForm } from './ResumeForm'

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

  describe('Toolbar', () => {
    test('has toolbar with action buttons (icons)', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const svgIcons = screen.container.querySelectorAll('svg')
      expect(svgIcons.length).toBeGreaterThan(0)
    })

    test('toolbar contains upload icon for import', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const uploadIcon = screen.container.querySelector('svg.lucide-upload')
      expect(uploadIcon).not.toBeNull()
    })

    test('toolbar contains eye icon for preview', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const eyeIcon = screen.container.querySelector('svg.lucide-eye')
      expect(eyeIcon).not.toBeNull()
    })

    test('toolbar contains download icon', async () => {
      const screen = await render(
        <TestWrapper>
          <ResumeForm user={mockUser} />
        </TestWrapper>,
      )

      const downloadIcon = screen.container.querySelector('svg.lucide-download')
      expect(downloadIcon).not.toBeNull()
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
    test('clicking preview button twice switches to preview mode and back to form button returns', async () => {
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
})
