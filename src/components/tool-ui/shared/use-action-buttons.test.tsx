import { describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { useActionButtons } from './use-action-buttons'

function TestComponent({
  actions,
  onAction,
}: {
  actions: Array<{ id: string; label: string; confirmLabel?: string }>
  onAction: (id: string) => void
}) {
  const { actions: resolvedActions, runAction, confirmingActionId } = useActionButtons({
    actions,
    onAction,
  })

  return (
    <div>
      <div data-testid="confirming">{confirmingActionId ?? 'none'}</div>
      {resolvedActions.map(action => (
        <button key={action.id} onClick={() => runAction(action.id)}>
          {action.currentLabel}
        </button>
      ))}
    </div>
  )
}

describe('useActionButtons', () => {
  test('pressing Escape cancels confirmation state', async () => {
    const onAction = vi.fn()
    const actions = [
      { id: 'delete', label: 'Delete', confirmLabel: 'Confirm Delete' },
    ]

    const screen = await render(
      <TestComponent actions={actions} onAction={onAction} />,
    )

    // Initially not confirming
    await expect.element(screen.getByTestId('confirming')).toHaveTextContent('none')

    // Click to enter confirm state
    const deleteButton = screen.getByRole('button', { name: 'Delete' })
    await deleteButton.click()

    // Now in confirming state
    await expect.element(screen.getByTestId('confirming')).toHaveTextContent('delete')

    // Press Escape to cancel
    await screen.getByRole('button', { name: 'Confirm Delete' }).element().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )

    // No longer confirming
    await expect.element(screen.getByTestId('confirming')).toHaveTextContent('none')
  })
})
