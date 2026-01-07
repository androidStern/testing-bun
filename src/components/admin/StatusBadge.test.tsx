import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  describe('Status Label Display', () => {
    test('displays "Pending Review" for pending_review status', async () => {
      const screen = await render(<StatusBadge status="pending_review" />)

      await expect.element(screen.getByText('Pending Review')).toBeVisible()
    })

    test('displays "Approved" for approved status', async () => {
      const screen = await render(<StatusBadge status="approved" />)

      await expect.element(screen.getByText('Approved')).toBeVisible()
    })

    test('displays "Blocked" for blocked status', async () => {
      const screen = await render(<StatusBadge status="blocked" />)

      await expect.element(screen.getByText('Blocked')).toBeVisible()
    })

    test('displays raw status for unknown status values', async () => {
      const screen = await render(<StatusBadge status="custom_status" />)

      // Falls back to showing the raw status string
      await expect.element(screen.getByText('custom_status')).toBeVisible()
    })
  })
})
