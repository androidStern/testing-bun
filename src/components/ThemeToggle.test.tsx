import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ThemeToggle } from './ThemeToggle'

const mockSetTheme = vi.fn()

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: 'light',
    setTheme: mockSetTheme,
  }),
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetTheme.mockClear()
  })

  describe('Theme Button Display', () => {
    test('renders toggle button with screen reader accessible label', async () => {
      const screen = await render(<ThemeToggle />)

      // User should have accessible way to toggle theme
      const button = screen.getByRole('button', { name: /toggle theme/i })
      await expect.element(button).toBeVisible()
    })

    test('clicking button toggles theme from light to dark', async () => {
      const screen = await render(<ThemeToggle />)

      const button = screen.getByRole('button', { name: /toggle theme/i })
      await button.click()

      // When in light mode, clicking should switch to dark
      expect(mockSetTheme).toHaveBeenCalledWith('dark')
    })
  })
})
