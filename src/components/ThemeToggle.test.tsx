import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ThemeToggle } from './ThemeToggle'

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Theme Button Display', () => {
    test('renders toggle button with screen reader accessible label', async () => {
      const screen = await render(<ThemeToggle />)

      // User should have accessible way to toggle theme
      const button = screen.getByRole('button', { name: /toggle theme/i })
      await expect.element(button).toBeVisible()
    })
  })
})
