import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { mockConvexMutation, resetAllMocks } from '@/test/setup'
import { ProfileForm } from './ProfileForm'

const mockUser = {
  createdAt: new Date().toISOString(),
  email: 'test@example.com',
  emailVerified: true,
  firstName: 'Test',
  id: 'user_test123',
  lastActiveAt: new Date().toISOString(),
  lastName: 'User',
  lastSignInAt: new Date().toISOString(),
  object: 'user' as const,
  profilePictureUrl: null,
  updatedAt: new Date().toISOString(),
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

describe('ProfileForm', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Initial Render', () => {
    test('shows "Complete Your Profile" title when no existing profile', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Complete Your Profile')).toBeVisible()
    })

    test('displays all four "What brings you here" options', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('To find a job')).toBeVisible()
      await expect.element(screen.getByText('To lend a hand')).toBeVisible()
      await expect.element(screen.getByText('To post a job')).toBeVisible()
      await expect.element(screen.getByText('Entrepreneurship')).toBeVisible()
    })

    test('has headline input field', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      const headlineInput = screen.getByLabelText(/most recent position/i)
      await expect.element(headlineInput).toBeVisible()
    })

    test('has professional summary textarea', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      const bioInput = screen.getByLabelText(/professional summary/i)
      await expect.element(bioInput).toBeVisible()
    })
  })

  describe('Submit Button State', () => {
    test('submit button is disabled when no fields are filled', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      const submitButton = screen.getByRole('button', { name: /save/i })
      await expect.element(submitButton).toBeDisabled()
    })

    test('submit button is disabled when only thingsICanOffer is selected', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      await screen.getByText('To find a job').click()

      const submitButton = screen.getByRole('button', { name: /save/i })
      await expect.element(submitButton).toBeDisabled()
    })

    test('submit button is disabled when headline and bio are empty', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      await screen.getByText('To find a job').click()

      const headlineInput = screen.getByLabelText(/most recent position/i)
      await headlineInput.fill('Manager')

      const submitButton = screen.getByRole('button', { name: /save/i })
      await expect.element(submitButton).toBeDisabled()
    })

    test('submit button is enabled when all required fields are filled', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      await screen.getByText('To find a job').click()

      const headlineInput = screen.getByLabelText(/most recent position/i)
      await headlineInput.fill('Manager')

      const bioInput = screen.getByLabelText(/professional summary/i)
      await bioInput.fill('Summary')

      const submitButton = screen.getByRole('button', { name: /save/i })
      await expect.element(submitButton).toBeEnabled()
    })
  })

  describe('Validation on Blur', () => {
    test('shows thingsICanOffer error when submitting without selection', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      const headlineInput = screen.getByLabelText(/most recent position/i)
      await headlineInput.fill('Store Manager')

      const bioInput = screen.getByLabelText(/professional summary/i)
      await bioInput.fill('Experienced manager')

      const submitButton = screen.getByRole('button', { name: /save/i })
      await expect.element(submitButton).toBeDisabled()
    })

    test('shows headline error on blur when empty', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      const headlineInput = screen.getByLabelText(/most recent position/i)
      await headlineInput.click()

      const bioInput = screen.getByLabelText(/professional summary/i)
      await bioInput.click()

      await expect.element(screen.getByText('Please enter your most recent position')).toBeVisible()
    })

    test('shows bio error on blur when empty', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      const bioInput = screen.getByLabelText(/professional summary/i)
      await bioInput.click()

      const headlineInput = screen.getByLabelText(/most recent position/i)
      await headlineInput.click()

      await expect.element(screen.getByText('Please enter a professional summary')).toBeVisible()
    })

    test('clears headline error when valid text entered', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      const headlineInput = screen.getByLabelText(/most recent position/i)
      await headlineInput.click()

      const bioInput = screen.getByLabelText(/professional summary/i)
      await bioInput.click()

      await expect.element(screen.getByText('Please enter your most recent position')).toBeVisible()

      await headlineInput.fill('Store Manager')
      await bioInput.click()

      await expect
        .element(screen.getByText('Please enter your most recent position'))
        .not.toBeInTheDocument()
    })
  })

  describe('ThingsICanOffer Selection', () => {
    test('can select a single option', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      await screen.getByText('To find a job').click()

      const checkbox = screen.container.querySelector(
        'button[role="checkbox"][data-state="checked"]',
      )
      expect(checkbox).not.toBeNull()
    })

    test('can select multiple options', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      await screen.getByText('To find a job').click()
      await screen.getByText('To lend a hand').click()
      await screen.getByText('Entrepreneurship').click()

      const checkboxes = screen.container.querySelectorAll(
        'button[role="checkbox"][data-state="checked"]',
      )
      expect(checkboxes.length).toBe(3)
    })

    test('can deselect an option', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      await screen.getByText('To find a job').click()
      await screen.getByText('To lend a hand').click()

      let checkboxes = screen.container.querySelectorAll(
        'button[role="checkbox"][data-state="checked"]',
      )
      expect(checkboxes.length).toBe(2)

      await screen.getByText('To find a job').click()

      checkboxes = screen.container.querySelectorAll(
        'button[role="checkbox"][data-state="checked"]',
      )
      expect(checkboxes.length).toBe(1)
    })
  })

  describe('Form Submission', () => {
    test('submit button becomes enabled with valid data', async () => {
      const onSuccess = vi.fn()
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={onSuccess} user={mockUser as never} />
        </TestWrapper>,
      )

      const submitButton = screen.getByRole('button', { name: /save/i })
      await expect.element(submitButton).toBeDisabled()

      await screen.getByText('To find a job').click()

      const headlineInput = screen.getByLabelText(/most recent position/i)
      await headlineInput.fill('Store Manager')

      const bioInput = screen.getByLabelText(/professional summary/i)
      await bioInput.fill('Experienced manager with 5 years of retail experience')

      await expect.element(submitButton).toBeEnabled()
    })
  })

  describe('Optional Fields', () => {
    test('optional fields are hidden by default', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      const locationInput = screen.container.querySelector('#location')
      expect(locationInput).toBeNull()
    })

    test('clicking toggle button shows optional fields', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      await screen.getByText(/additional information/i).click()

      await expect.element(screen.getByLabelText(/location/i)).toBeVisible()
      await expect.element(screen.getByLabelText(/website/i)).toBeVisible()
      await expect.element(screen.getByLabelText(/linkedin/i)).toBeVisible()
      await expect.element(screen.getByLabelText(/instagram/i)).toBeVisible()
    })

    test('can fill optional location field', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      await screen.getByText(/additional information/i).click()

      const locationInput = screen.getByLabelText(/location/i)
      await locationInput.fill('Miami, FL')

      expect((locationInput.element() as HTMLInputElement).value).toBe('Miami, FL')
    })
  })

  describe('AI Polish Feature', () => {
    test('polish button exists', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      const polishButton = screen.getByRole('button', { name: /polish with ai/i })
      await expect.element(polishButton).toBeVisible()
    })

    test('polish button is disabled when bio is empty', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      const polishButton = screen.getByRole('button', { name: /polish with ai/i })
      await expect.element(polishButton).toBeDisabled()
    })

    test('polish button is enabled when bio has content', async () => {
      const screen = await render(
        <TestWrapper>
          <ProfileForm onSuccess={vi.fn()} user={mockUser as never} />
        </TestWrapper>,
      )

      const bioInput = screen.getByLabelText(/professional summary/i)
      await bioInput.fill('Some professional summary content')

      const polishButton = screen.getByRole('button', { name: /polish with ai/i })
      await expect.element(polishButton).toBeEnabled()
    })
  })
})
