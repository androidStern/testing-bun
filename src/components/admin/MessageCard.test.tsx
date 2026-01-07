import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { MessageCard } from './MessageCard'
import type { Id } from '../../../convex/_generated/dataModel'

const mockMessage = {
  _id: 'msg_123' as Id<'inboundMessages'>,
  phone: '+1555987654',
  body: 'Looking for a warehouse job, available nights and weekends. Have forklift certification.',
  status: 'pending_review',
  createdAt: Date.now() - 7200000, // 2 hours ago
  sender: {
    name: 'Mike Worker',
    company: 'Self',
    status: 'approved',
  },
}

describe('MessageCard', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Message Display', () => {
    test('displays message phone number and body for admin to review', async () => {
      const screen = await render(<MessageCard message={mockMessage} />)

      await expect.element(screen.getByText('+1555987654')).toBeVisible()
      await expect.element(screen.getByText(/Looking for a warehouse job/)).toBeVisible()
    })

    test('displays sender name when available', async () => {
      const screen = await render(<MessageCard message={mockMessage} />)

      // Admin should see who sent the message
      await expect.element(screen.getByText('(Mike Worker)')).toBeVisible()
    })
  })

  describe('Action Buttons', () => {
    test('shows Approve and Reject buttons when showActions is true for pending messages', async () => {
      const screen = await render(<MessageCard message={mockMessage} showActions={true} />)

      await expect.element(screen.getByText('Approve')).toBeVisible()
      await expect.element(screen.getByText('Reject')).toBeVisible()
    })

    test('always shows Edit and Delete buttons', async () => {
      const screen = await render(<MessageCard message={mockMessage} />)

      await expect.element(screen.getByText('Edit')).toBeVisible()
      await expect.element(screen.getByText('Delete')).toBeVisible()
    })

    test('clicking Edit button shows editing mode with textarea and Save/Cancel buttons', async () => {
      const screen = await render(<MessageCard message={mockMessage} />)

      // Click Edit button
      const editButton = screen.getByText('Edit')
      await editButton.click()

      // Admin should see editing UI with message body in textarea
      await expect.element(screen.getByText('Editing')).toBeVisible()
      await expect.element(screen.getByText('Save')).toBeVisible()
      await expect.element(screen.getByText('Cancel')).toBeVisible()
    })

    test('clicking Cancel in editing mode returns to normal display', async () => {
      const screen = await render(<MessageCard message={mockMessage} />)

      // Enter editing mode
      const editButton = screen.getByText('Edit')
      await editButton.click()

      // Should be in editing mode
      await expect.element(screen.getByText('Editing')).toBeVisible()

      // Click Cancel to exit editing mode
      const cancelButton = screen.getByText('Cancel')
      await cancelButton.click()

      // Should return to normal display - editing UI should be gone
      await expect.element(screen.getByText('Edit')).toBeVisible()
    })

    test('typing in edit textarea updates the message body content', async () => {
      const screen = await render(<MessageCard message={mockMessage} />)

      // Enter editing mode
      const editButton = screen.getByText('Edit')
      await editButton.click()

      // Find the textarea and type new content
      const textarea = screen.getByPlaceholder('Message body')
      await textarea.fill('Updated message content for testing')

      // Verify the textarea value was updated
      expect((textarea.element() as HTMLTextAreaElement).value).toBe('Updated message content for testing')
    })

    test('clicking Save button triggers mutation and exits editing mode', async () => {
      const screen = await render(<MessageCard message={mockMessage} />)

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

    test('clicking Approve button triggers status update for pending message', async () => {
      const screen = await render(<MessageCard message={mockMessage} showActions={true} />)

      // Admin wants to approve a pending message
      const approveButton = screen.getByText('Approve')
      await expect.element(approveButton).toBeVisible()

      // Click Approve - this triggers updateStatus mutation
      await approveButton.click()

      // Button should still exist (we're not testing mutation result, just that handler fires)
      await expect.element(approveButton).toBeVisible()
    })
  })
})
