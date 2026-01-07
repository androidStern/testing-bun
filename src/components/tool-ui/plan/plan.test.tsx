import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { Plan } from './plan'

describe('Plan', () => {
  describe('Basic Rendering', () => {
    test('displays title and todo list with progress', async () => {
      const todos = [
        { id: '1', label: 'Search for jobs', status: 'completed' as const },
        { id: '2', label: 'Filter results', status: 'in_progress' as const },
        { id: '3', label: 'Rank matches', status: 'pending' as const },
      ]

      const screen = await render(
        <Plan
          id="plan-1"
          title="Finding Your Perfect Job"
          todos={todos}
        />,
      )

      // Title should be displayed
      await expect.element(screen.getByText('Finding Your Perfect Job')).toBeVisible()

      // Progress should show completed count
      await expect.element(screen.getByText('1 of 3 complete')).toBeVisible()

      // Todo items should be displayed
      await expect.element(screen.getByText('Search for jobs')).toBeVisible()
      await expect.element(screen.getByText('Filter results')).toBeVisible()
      await expect.element(screen.getByText('Rank matches')).toBeVisible()
    })
  })
})
