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
  })
})
