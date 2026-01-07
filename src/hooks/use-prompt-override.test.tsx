import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { usePromptOverride } from './use-prompt-override'

const STORAGE_KEY = 'jobMatcher.promptOverride'

function TestComponent({ action }: { action?: 'set' | 'clear' }) {
  const { promptOverride, setPromptOverride, clearOverride, isDirty, isLoaded } =
    usePromptOverride()

  return (
    <div>
      <div data-testid="loaded">{isLoaded ? 'loaded' : 'loading'}</div>
      <div data-testid="value">{promptOverride ?? 'null'}</div>
      <div data-testid="dirty">{isDirty ? 'dirty' : 'clean'}</div>
      {action === 'set' && (
        <button onClick={() => setPromptOverride('custom prompt')}>Set</button>
      )}
      {action === 'clear' && (
        <button onClick={() => clearOverride()}>Clear</button>
      )}
    </div>
  )
}

describe('usePromptOverride', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  test('loads existing prompt override from localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, 'stored prompt')

    const screen = await render(<TestComponent />)

    await expect.element(screen.getByTestId('loaded')).toHaveTextContent('loaded')
    await expect.element(screen.getByTestId('value')).toHaveTextContent('stored prompt')
    await expect.element(screen.getByTestId('dirty')).toHaveTextContent('dirty')
  })

  test('sets prompt override to localStorage', async () => {
    const screen = await render(<TestComponent action="set" />)

    await expect.element(screen.getByTestId('loaded')).toHaveTextContent('loaded')
    await screen.getByRole('button', { name: 'Set' }).click()

    await expect.element(screen.getByTestId('value')).toHaveTextContent('custom prompt')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('custom prompt')
  })

  test('clears prompt override from localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, 'to be cleared')

    const screen = await render(<TestComponent action="clear" />)

    await expect.element(screen.getByTestId('value')).toHaveTextContent('to be cleared')
    await screen.getByRole('button', { name: 'Clear' }).click()

    await expect.element(screen.getByTestId('value')).toHaveTextContent('null')
    await expect.element(screen.getByTestId('dirty')).toHaveTextContent('clean')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
