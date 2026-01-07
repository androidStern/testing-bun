import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { SenderCard } from './SenderCard'
import type { Id } from '../../../convex/_generated/dataModel'

const mockSender = {
  _id: 'sender_123' as Id<'senders'>,
  phone: '+1555123456',
  email: 'employer@example.com',
  status: 'pending',
  name: 'John Employer',
  company: 'ABC Corp',
  notes: 'Contacted via SMS',
  createdAt: Date.now() - 3600000, // 1 hour ago
  messageCount: 3,
}

describe('SenderCard', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Sender Details Display', () => {
    test('displays sender phone number and email for admin to review', async () => {
      const screen = await render(<SenderCard sender={mockSender} />)

      await expect.element(screen.getByText('+1555123456')).toBeVisible()
      await expect.element(screen.getByText('employer@example.com')).toBeVisible()
    })

    test('displays sender name and company when available', async () => {
      const screen = await render(<SenderCard sender={mockSender} />)

      await expect.element(screen.getByText('John Employer')).toBeVisible()
      await expect.element(screen.getByText('ABC Corp')).toBeVisible()
    })

    test('displays message count for admin context', async () => {
      const screen = await render(<SenderCard sender={mockSender} />)

      // Admin should see how many messages this sender has sent
      await expect.element(screen.getByText('3 messages')).toBeVisible()
    })
  })

  describe('Action Buttons', () => {
    test('shows Approve and Block buttons when showActions is true for pending senders', async () => {
      const screen = await render(<SenderCard sender={mockSender} showActions={true} />)

      await expect.element(screen.getByText('Approve')).toBeVisible()
      await expect.element(screen.getByText('Block')).toBeVisible()
    })

    test('clicking Edit button shows editing mode with form fields', async () => {
      const screen = await render(<SenderCard sender={mockSender} />)

      // Click Edit button
      const editButton = screen.getByText('Edit')
      await editButton.click()

      // Admin should see editing UI with form fields
      await expect.element(screen.getByText('Editing')).toBeVisible()
      await expect.element(screen.getByText('Save')).toBeVisible()
      await expect.element(screen.getByText('Cancel')).toBeVisible()
    })

    test('clicking Cancel in editing mode returns to normal display', async () => {
      const screen = await render(<SenderCard sender={mockSender} />)

      // Enter editing mode
      const editButton = screen.getByText('Edit')
      await editButton.click()

      // Should be in editing mode
      await expect.element(screen.getByText('Editing')).toBeVisible()

      // Click Cancel to exit editing mode
      const cancelButton = screen.getByText('Cancel')
      await cancelButton.click()

      // Should return to normal display - Edit button visible again
      await expect.element(screen.getByText('Edit')).toBeVisible()
    })

    test('typing in phone field updates the input value', async () => {
      const screen = await render(<SenderCard sender={mockSender} />)

      // Enter editing mode
      const editButton = screen.getByText('Edit')
      await editButton.click()

      // Find the phone input and type new content
      const phoneInput = screen.getByPlaceholder('Phone number')
      await phoneInput.fill('+1999888777')

      // Verify the input value was updated
      expect((phoneInput.element() as HTMLInputElement).value).toBe('+1999888777')
    })

    test('typing in email field updates the input value', async () => {
      const screen = await render(<SenderCard sender={mockSender} />)

      // Enter editing mode
      const editButton = screen.getByText('Edit')
      await editButton.click()

      // Find the email input and type new content
      const emailInput = screen.getByPlaceholder('Email address')
      await emailInput.fill('newemail@example.com')

      // Verify the input value was updated
      expect((emailInput.element() as HTMLInputElement).value).toBe('newemail@example.com')
    })

    test('typing in name field updates the input value', async () => {
      const screen = await render(<SenderCard sender={mockSender} />)

      // Enter editing mode
      const editButton = screen.getByText('Edit')
      await editButton.click()

      // Find the name input and type new content
      const nameInput = screen.getByPlaceholder('Name')
      await nameInput.fill('Jane Smith')

      // Verify the input value was updated
      expect((nameInput.element() as HTMLInputElement).value).toBe('Jane Smith')
    })

    test('typing in company field updates the input value', async () => {
      const screen = await render(<SenderCard sender={mockSender} />)

      // Enter editing mode
      const editButton = screen.getByText('Edit')
      await editButton.click()

      // Find the company input and type new content
      const companyInput = screen.getByPlaceholder('Company')
      await companyInput.fill('XYZ Industries')

      // Verify the input value was updated
      expect((companyInput.element() as HTMLInputElement).value).toBe('XYZ Industries')
    })

    test('typing in notes field updates the input value', async () => {
      const screen = await render(<SenderCard sender={mockSender} />)

      // Enter editing mode
      const editButton = screen.getByText('Edit')
      await editButton.click()

      // Find the notes input and type new content
      const notesInput = screen.getByPlaceholder('Admin notes')
      await notesInput.fill('Important sender - follow up needed')

      // Verify the input value was updated
      expect((notesInput.element() as HTMLInputElement).value).toBe('Important sender - follow up needed')
    })
  })
})
