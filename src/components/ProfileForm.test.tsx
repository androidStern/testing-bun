import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  createFullUser,
  mockConvexMutation,
  renderWithProviders,
  resetAllMocks,
} from '@/test'
import { ProfileForm } from './ProfileForm'

const mockUser = createFullUser()

describe('ProfileForm', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Initial Render', () => {
    test('renders form with all required fields and options', async () => {
      const screen = await renderWithProviders(
        <ProfileForm onSuccess={vi.fn()} user={mockUser} />,
      )

      // Title
      await expect.element(screen.getByText('Complete Your Profile')).toBeVisible()

      // "What brings you here" options
      await expect.element(screen.getByText('To find a job')).toBeVisible()
      await expect.element(screen.getByText('To lend a hand')).toBeVisible()
      await expect.element(screen.getByText('To post a job')).toBeVisible()
      await expect.element(screen.getByText('Entrepreneurship')).toBeVisible()

      // Required input fields
      await expect.element(screen.getByLabelText(/most recent position/i)).toBeVisible()
      await expect.element(screen.getByLabelText(/professional summary/i)).toBeVisible()
    })
  })

  describe('Submit Button State', () => {
    test('submit button enabled only when all required fields filled', async () => {
      const screen = await renderWithProviders(
        <ProfileForm onSuccess={vi.fn()} user={mockUser} />,
      )

      const submitButton = screen.getByRole('button', { name: /save/i })

      // Initially disabled
      await expect.element(submitButton).toBeDisabled()

      // Still disabled with only thingsICanOffer
      await screen.getByText('To find a job').click()
      await expect.element(submitButton).toBeDisabled()

      // Still disabled with thingsICanOffer + headline (missing bio)
      await screen.getByLabelText(/most recent position/i).fill('Manager')
      await expect.element(submitButton).toBeDisabled()

      // Enabled with all required fields
      await screen.getByLabelText(/professional summary/i).fill('Summary')
      await expect.element(submitButton).toBeEnabled()
    })
  })

  describe('Validation on Blur', () => {
    test('shows headline validation error on blur', async () => {
      const screen = await renderWithProviders(
        <ProfileForm onSuccess={vi.fn()} user={mockUser} />,
      )

      const headlineInput = screen.getByLabelText(/most recent position/i)
      const bioInput = screen.getByLabelText(/professional summary/i)

      // Trigger blur on headline to show error
      await headlineInput.click()
      await bioInput.click()
      await expect.element(screen.getByText('Please enter your most recent position')).toBeVisible()

      // Filling headline clears its error
      await headlineInput.fill('Store Manager')
      await bioInput.click()
      await expect
        .element(screen.getByText('Please enter your most recent position'))
        .not.toBeInTheDocument()
    })

    test('submit button stays disabled without thingsICanOffer selection', async () => {
      const screen = await renderWithProviders(
        <ProfileForm onSuccess={vi.fn()} user={mockUser} />,
      )

      await screen.getByLabelText(/most recent position/i).fill('Store Manager')
      await screen.getByLabelText(/professional summary/i).fill('Experienced manager')

      await expect.element(screen.getByRole('button', { name: /save/i })).toBeDisabled()
    })
  })

  describe('ThingsICanOffer Selection', () => {
    test('can select and deselect multiple options', async () => {
      const screen = await renderWithProviders(
        <ProfileForm onSuccess={vi.fn()} user={mockUser} />,
      )

      const getCheckedCount = () =>
        screen.container.querySelectorAll('button[role="checkbox"][data-state="checked"]').length

      // Select single option
      await screen.getByText('To find a job').click()
      expect(getCheckedCount()).toBe(1)

      // Select multiple options
      await screen.getByText('To lend a hand').click()
      await screen.getByText('Entrepreneurship').click()
      expect(getCheckedCount()).toBe(3)

      // Deselect one option
      await screen.getByText('To find a job').click()
      expect(getCheckedCount()).toBe(2)
    })
  })

  describe('Form Submission', () => {
    test('form becomes submittable when all required fields are filled', async () => {
      const screen = await renderWithProviders(
        <ProfileForm onSuccess={vi.fn()} user={mockUser} />,
      )

      // Fill required fields
      await screen.getByText('To find a job').click()
      await screen.getByLabelText(/most recent position/i).fill('Store Manager')
      await screen.getByLabelText(/professional summary/i).fill('Experienced manager')

      // Submit button becomes enabled
      const submitButton = screen.getByRole('button', { name: /save/i })
      await expect.element(submitButton).toBeEnabled()
    })
  })

  describe('Optional Fields', () => {
    test('optional fields toggle and can be filled', async () => {
      const screen = await renderWithProviders(
        <ProfileForm onSuccess={vi.fn()} user={mockUser} />,
      )

      // Hidden by default
      expect(screen.container.querySelector('#location')).toBeNull()

      // Click to reveal
      await screen.getByText(/additional information/i).click()

      // All optional fields visible
      await expect.element(screen.getByLabelText(/location/i)).toBeVisible()
      await expect.element(screen.getByLabelText(/website/i)).toBeVisible()
      await expect.element(screen.getByLabelText(/linkedin/i)).toBeVisible()
      await expect.element(screen.getByLabelText(/instagram/i)).toBeVisible()

      // Can fill optional field
      const locationInput = screen.getByLabelText(/location/i)
      await locationInput.fill('Miami, FL')
      expect((locationInput.element() as HTMLInputElement).value).toBe('Miami, FL')
    })
  })

  describe('AI Polish Feature', () => {
    test('polish button enabled state depends on bio content', async () => {
      const screen = await renderWithProviders(
        <ProfileForm onSuccess={vi.fn()} user={mockUser} />,
      )

      const polishButton = screen.getByRole('button', { name: /polish with ai/i })

      // Visible but disabled when bio is empty
      await expect.element(polishButton).toBeVisible()
      await expect.element(polishButton).toBeDisabled()

      // Enabled when bio has content
      await screen.getByLabelText(/professional summary/i).fill('Some professional summary content')
      await expect.element(polishButton).toBeEnabled()
    })
  })
})
