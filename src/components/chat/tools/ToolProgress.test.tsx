import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { ToolCard, ToolProgress } from './ToolProgress'

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

  describe('Steps Display', () => {
    test('shows progress steps with their statuses', async () => {
      const steps = [
        { id: '1', label: 'Finding jobs', status: 'complete' as const },
        { id: '2', label: 'Filtering results', status: 'running' as const },
        { id: '3', label: 'Ranking matches', status: 'pending' as const },
      ]

      const screen = await render(
        <ToolProgress
          title="Job Search"
          status="running"
          steps={steps}
        />,
      )

      // All step labels should be displayed
      await expect.element(screen.getByText('Finding jobs')).toBeVisible()
      await expect.element(screen.getByText('Filtering results')).toBeVisible()
      await expect.element(screen.getByText('Ranking matches')).toBeVisible()
    })
  })
})

describe('ToolCard', () => {
  test('shows title and detail when provided', async () => {
    const screen = await render(
      <ToolCard
        icon={<span>📋</span>}
        title="Resume Uploaded"
        status="complete"
        detail="resume.pdf"
      />,
    )

    await expect.element(screen.getByText('Resume Uploaded')).toBeVisible()
    await expect.element(screen.getByText('resume.pdf')).toBeVisible()
  })
})
