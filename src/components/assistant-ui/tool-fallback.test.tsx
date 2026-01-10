import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ToolFallback } from './tool-fallback'

describe('ToolFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Success State', () => {
    test('displays tool name with success indicator when tool completes', async () => {
      const screen = await render(
        <ToolFallback
          toolName="search_jobs"
          argsText='{"query": "developer"}'
          result={{ jobs: [] }}
          status={{ type: 'complete' }}
        />,
      )

      // Tool name should be displayed with "Used tool:" prefix
      await expect.element(screen.getByText('Used tool:')).toBeVisible()
      await expect.element(screen.getByText('search_jobs')).toBeVisible()
    })
  })

  describe('Expand/Collapse', () => {
    test('clicking expand button shows tool arguments and result', async () => {
      const screen = await render(
        <ToolFallback
          toolName="find_jobs"
          argsText='{"location": "NYC"}'
          result="Found 5 jobs"
          status={{ type: 'complete' }}
        />,
      )

      // Initially args should be hidden (collapsed state)
      await expect.element(screen.getByText('{"location": "NYC"}')).not.toBeInTheDocument()

      // Click expand button to show details
      const expandButton = screen.getByRole('button')
      await expandButton.click()

      // Now args should be visible
      await expect.element(screen.getByText('{"location": "NYC"}')).toBeVisible()
      // Result should also be visible
      await expect.element(screen.getByText('Found 5 jobs')).toBeVisible()
    })
  })
})
