import { describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ErrorBanner } from './ErrorBanner'

describe('ErrorBanner', () => {
  test('displays error message to user', async () => {
    const screen = await render(
      <ErrorBanner message="Network connection failed. Please check your internet." />,
    )

    await expect
      .element(screen.getByText('Network connection failed. Please check your internet.'))
      .toBeVisible()
  })

  test('displays default title when not provided', async () => {
    const screen = await render(<ErrorBanner message="An error occurred" />)

    await expect.element(screen.getByText('Something went wrong')).toBeVisible()
  })

  test('displays custom title when provided', async () => {
    const screen = await render(
      <ErrorBanner message="Could not load data" title="Loading Error" />,
    )

    await expect.element(screen.getByText('Loading Error')).toBeVisible()
  })

  test('shows retry button when onRetry callback is provided', async () => {
    const onRetry = vi.fn()
    const screen = await render(
      <ErrorBanner message="Request timed out" onRetry={onRetry} />,
    )

    const retryButton = screen.getByRole('button', { name: /try again/i })
    await expect.element(retryButton).toBeVisible()
  })

  test('calls onRetry when user clicks retry button', async () => {
    const onRetry = vi.fn()
    const screen = await render(
      <ErrorBanner message="Request timed out" onRetry={onRetry} />,
    )

    const retryButton = screen.getByRole('button', { name: /try again/i })
    await retryButton.click()

    expect(onRetry).toHaveBeenCalledOnce()
  })

  test('does not show retry button when onRetry is not provided', async () => {
    const screen = await render(<ErrorBanner message="Fatal error" />)

    const retryButton = screen.container.querySelector('button')
    expect(retryButton).toBeNull()
  })

  test('displays custom retry label when provided', async () => {
    const screen = await render(
      <ErrorBanner message="Save failed" onRetry={vi.fn()} retryLabel="Retry Save" />,
    )

    await expect.element(screen.getByText('Retry Save')).toBeVisible()
  })
})
