import { describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { PlanErrorBoundary } from './error-boundary'

function ErrorThrower() {
  throw new Error('Plan error')
}

describe('PlanErrorBoundary', () => {
  beforeEach(() => {
    console.error = vi.fn()
  })

  test('displays Plan in error message when child throws', async () => {
    const screen = await render(
      <PlanErrorBoundary>
        <ErrorThrower />
      </PlanErrorBoundary>,
    )

    await expect.element(screen.getByText('Plan failed to render')).toBeVisible()
  })
})
