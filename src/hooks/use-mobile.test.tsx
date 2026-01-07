import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { useIsMobile } from './use-mobile'

function TestComponent() {
  const isMobile = useIsMobile()
  return <div data-testid="result">{isMobile ? 'mobile' : 'desktop'}</div>
}

describe('useIsMobile', () => {
  const originalInnerWidth = window.innerWidth

  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
    })
  })

  test('returns true when viewport width is below 768px', async () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 500,
      writable: true,
    })

    const screen = await render(<TestComponent />)

    await expect.element(screen.getByTestId('result')).toHaveTextContent('mobile')
  })

  test('returns false when viewport width is 768px or above', async () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      writable: true,
    })

    const screen = await render(<TestComponent />)

    await expect.element(screen.getByTestId('result')).toHaveTextContent('desktop')
  })
})
