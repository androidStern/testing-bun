import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ActionButtons } from './action-buttons'

describe('ActionButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    test('renders action buttons with correct labels', async () => {
      const actions = [
        { id: 'save', label: 'Save' },
        { id: 'cancel', label: 'Cancel' },
      ]

      const screen = await render(
        <ActionButtons actions={actions} onAction={vi.fn()} />,
      )

      // All action buttons should be displayed
      await expect.element(screen.getByRole('button', { name: 'Save' })).toBeVisible()
      await expect.element(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()
    })
  })

  describe('Click Handlers', () => {
    test('clicking a button triggers onAction with the correct action id', async () => {
      const onAction = vi.fn()
      const actions = [
        { id: 'apply', label: 'Apply Now' },
        { id: 'skip', label: 'Skip' },
      ]

      const screen = await render(
        <ActionButtons actions={actions} onAction={onAction} />,
      )

      // User clicks the Apply Now button
      const applyButton = screen.getByRole('button', { name: 'Apply Now' })
      await applyButton.click()

      // onAction should be called with the correct action id
      expect(onAction).toHaveBeenCalledTimes(1)
      expect(onAction).toHaveBeenCalledWith('apply')
    })
  })

  describe('Confirmation Flow', () => {
    test('shows confirm label on first click when confirmLabel is set', async () => {
      const onAction = vi.fn()
      const actions = [
        { id: 'delete', label: 'Delete', confirmLabel: 'Click again to confirm' },
      ]

      const screen = await render(
        <ActionButtons actions={actions} onAction={onAction} />,
      )

      // Initial label is "Delete"
      const deleteButton = screen.getByRole('button', { name: 'Delete' })
      await expect.element(deleteButton).toBeVisible()

      // First click shows confirmation label
      await deleteButton.click()

      // onAction should NOT be called yet
      expect(onAction).not.toHaveBeenCalled()

      // Button should now show confirm label
      await expect.element(screen.getByRole('button', { name: 'Click again to confirm' })).toBeVisible()
    })
  })
})
