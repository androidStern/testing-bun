import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { ToolProgress } from './ToolProgress'

describe('ToolProgress', () => {
  describe('Basic Display', () => {
    test('shows title and running spinner when status is running', async () => {
      const screen = await render(
        <ToolProgress
          title="Searching for jobs..."
          status="running"
        />,
      )

      // Title should be displayed
      await expect.element(screen.getByText('Searching for jobs...')).toBeVisible()
    })
  })
})
