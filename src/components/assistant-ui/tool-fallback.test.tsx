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
})
