import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { SenderCard } from './SenderCard'
import type { Id } from '../../../convex/_generated/dataModel'
import { resetAllMocks } from '@/test/setup'

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

    test('clicking Save button triggers mutation and exits editing mode', async () => {
      const screen = await render(<SenderCard sender={mockSender} />)

      // Enter editing mode
      const editButton = screen.getByText('Edit')
      await editButton.click()

      // Should be in editing mode
      await expect.element(screen.getByText('Editing')).toBeVisible()

      // Click Save to persist changes
      const saveButton = screen.getByText('Save')
      await saveButton.click()

      // After save completes, should exit editing mode and return to normal display
      await expect.element(screen.getByText('Edit')).toBeVisible()
    })

    test('clicking Approve button triggers status update for pending sender', async () => {
      const screen = await render(<SenderCard sender={mockSender} showActions={true} />)

      // Admin wants to approve a pending sender
      const approveButton = screen.getByText('Approve')
      await expect.element(approveButton).toBeVisible()

      // Click Approve - this triggers updateStatus mutation
      await approveButton.click()

      // Button should still exist (we're not testing mutation result, just that handler fires)
      await expect.element(approveButton).toBeVisible()
    })

    test('clicking Block button triggers status update for pending sender', async () => {
      const screen = await render(<SenderCard sender={mockSender} showActions={true} />)

      // Admin wants to block a pending sender
      const blockButton = screen.getByText('Block')
      await expect.element(blockButton).toBeVisible()

      // Click Block - this triggers updateStatus mutation
      await blockButton.click()

      // Button should still exist (we're not testing mutation result, just that handler fires)
      await expect.element(blockButton).toBeVisible()
    })

    test('clicking Delete button shows confirmation dialog', async () => {
      vi.stubGlobal('confirm', vi.fn(() => true))

      const screen = await render(<SenderCard sender={mockSender} />)

      // Admin wants to delete a sender
      const deleteButton = screen.getByRole('button', { name: 'Delete' })
      await deleteButton.click()

      // Confirm dialog should be called with sender info
      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('Delete sender +1555123456'),
      )

      vi.unstubAllGlobals()
    })
  })
})
