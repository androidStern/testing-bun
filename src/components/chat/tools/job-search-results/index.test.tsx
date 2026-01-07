import { describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { JobSearchResults } from './index'

const mockSearchContext = {
  filters: {
    busRequired: false,
    easyApplyOnly: false,
    railRequired: false,
    secondChancePreferred: false,
    secondChanceRequired: false,
    shifts: [],
    urgentOnly: false,
  },
  location: {
    withinCommuteZone: false,
  },
  query: 'warehouse jobs',
  totalFound: 10,
}

const createMockJob = (id: string, title: string) => ({
  busAccessible: false,
  company: 'Test Company',
  description: 'Test description',
  id,
  isEasyApply: false,
  isSecondChance: false,
  isUrgent: false,
  location: 'New York, NY',
  railAccessible: false,
  salary: '$20/hr',
  secondChanceTier: null,
  shifts: ['morning'],
  title,
  transitAccessible: false,
  url: 'https://example.com/job',
})

describe('JobSearchResults', () => {
  test('shows empty state message when no jobs', async () => {
    const screen = await render(
      <JobSearchResults jobs={[]} searchContext={mockSearchContext} />,
    )

    // Should show "No jobs found" message
    await expect.element(screen.getByText('No jobs found')).toBeVisible()
  })

  test('shows first 5 jobs and Show more button when more than 5 jobs', async () => {
    const jobs = Array.from({ length: 8 }, (_, i) =>
      createMockJob(`job-${i}`, `Job Title ${i}`),
    )

    const screen = await render(
      <JobSearchResults jobs={jobs} searchContext={mockSearchContext} />,
    )

    // First 5 jobs should be visible (use exact to avoid matching combined text)
    await expect.element(screen.getByText('Job Title 0', { exact: true })).toBeVisible()
    await expect.element(screen.getByText('Job Title 4', { exact: true })).toBeVisible()

    // Job 5 should not be visible yet
    expect(screen.getByText('Job Title 5', { exact: true }).query()).toBeNull()

    // Show more button should be visible with remaining count
    await expect.element(screen.getByRole('button', { name: /Show 3 more/i })).toBeVisible()
  })

  test('clicking Show more reveals all jobs', async () => {
    const jobs = Array.from({ length: 8 }, (_, i) =>
      createMockJob(`job-${i}`, `Job Title ${i}`),
    )

    const screen = await render(
      <JobSearchResults jobs={jobs} searchContext={mockSearchContext} />,
    )

    // Click Show more
    const showMoreButton = screen.getByRole('button', { name: /Show 3 more/i })
    await showMoreButton.click()

    // All jobs should now be visible
    await expect.element(screen.getByText('Job Title 7', { exact: true })).toBeVisible()

    // Show more button should no longer be visible
    expect(showMoreButton.query()).toBeNull()
  })
})
