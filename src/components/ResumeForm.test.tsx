import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createUser, renderWithProviders, resetAllMocks } from '@/test'
import { ResumeForm } from './ResumeForm'

const mockUser = createUser()

describe('ResumeForm', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Form Structure', () => {
    test('renders title and main sections', async () => {
      const screen = await renderWithProviders(<ResumeForm user={mockUser} />)

      // Title
      await expect.element(screen.getByText('Build Your Resume')).toBeVisible()

      // Section headers
      await expect
        .element(screen.getByRole('heading', { name: 'Personal Information' }))
        .toBeVisible()
      await expect.element(screen.getByText('Phone')).toBeVisible()
      await expect.element(screen.getByText('Location')).toBeVisible()
      await expect.element(screen.getByText('Experience 1')).toBeVisible()
      await expect.element(screen.getByText('Education 1')).toBeVisible()
    })

    test('renders toolbar icons', async () => {
      const screen = await renderWithProviders(<ResumeForm user={mockUser} />)

      // Toolbar icons
      expect(screen.container.querySelector('svg.lucide-upload')).not.toBeNull()
      expect(screen.container.querySelector('svg.lucide-eye')).not.toBeNull()
      expect(screen.container.querySelector('svg.lucide-download')).not.toBeNull()
    })

    test('renders AI feature buttons', async () => {
      const screen = await renderWithProviders(<ResumeForm user={mockUser} />)

      const buttons = Array.from(screen.container.querySelectorAll('button'))
      expect(buttons.some(btn => btn.textContent?.includes('Polish'))).toBe(true)
      expect(buttons.some(btn => btn.textContent?.includes('Dictate'))).toBe(true)
    })
  })

  describe('Work Experience Array', () => {
    test('can add and remove work experience entries', async () => {
      const screen = await renderWithProviders(<ResumeForm user={mockUser} />)

      // Starts with one entry, no Remove button
      await expect.element(screen.getByText('Experience 1')).toBeVisible()
      const findRemoveButton = () =>
        Array.from(screen.container.querySelectorAll('button')).find(btn =>
          btn.textContent?.includes('Remove'),
        )
      expect(findRemoveButton()).toBeUndefined()

      // Add new entry
      await screen.getByText('Add Experience').click()
      await expect.element(screen.getByText('Experience 2')).toBeVisible()

      // Remove button now available - remove the second entry
      const removeButton = findRemoveButton()
      if (removeButton) await removeButton.click()

      const hasExperience2 = Array.from(screen.container.querySelectorAll('span')).some(
        span => span.textContent === 'Experience 2',
      )
      expect(hasExperience2).toBe(false)
    })
  })

  describe('Education Array', () => {
    test('can add education entries', async () => {
      const screen = await renderWithProviders(<ResumeForm user={mockUser} />)

      // Starts with one entry
      await expect.element(screen.getByText('Education 1')).toBeVisible()

      // Add new entry
      await screen.getByText('Add Education').click()
      await expect.element(screen.getByText('Education 2')).toBeVisible()
    })
  })
})
