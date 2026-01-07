import { describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ToolUIErrorBoundary } from './error-boundary'

// Component that intentionally throws an error
function ErrorThrower({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>No error</div>
}

describe('ToolUIErrorBoundary', () => {
  // Suppress expected error logs during test
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = vi.fn()
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  test('renders children when no error occurs', async () => {
    const screen = await render(
      <ToolUIErrorBoundary componentName="TestComponent">
        <div>Child content</div>
      </ToolUIErrorBoundary>,
    )

    await expect.element(screen.getByText('Child content')).toBeVisible()
  })

  test('renders error fallback when child throws', async () => {
    const screen = await render(
      <ToolUIErrorBoundary componentName="MyTool">
        <ErrorThrower shouldThrow={true} />
      </ToolUIErrorBoundary>,
    )

    // Error boundary should catch and display component name with error
    await expect.element(screen.getByText('MyTool failed to render')).toBeVisible()
    await expect.element(screen.getByText('Test error message')).toBeVisible()
  })

  test('renders custom fallback when provided', async () => {
    const screen = await render(
      <ToolUIErrorBoundary
        componentName="TestComponent"
        fallback={<div>Custom error UI</div>}
      >
        <ErrorThrower shouldThrow={true} />
      </ToolUIErrorBoundary>,
    )

    await expect.element(screen.getByText('Custom error UI')).toBeVisible()
  })
})
