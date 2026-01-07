import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { JobResultCard, JobResultsList, type JobMatch } from './JobResultCard'

const mockJob: JobMatch = {
  id: 'job_123',
  title: 'Software Developer',
  company: 'Tech Corp',
  location: 'Miami, FL',
  matchReason: 'Your JavaScript skills match this position',
  highlights: ['Remote friendly', 'Great benefits', 'Growth opportunity'],
  salary: '$50,000 - $70,000',
  isSecondChance: false,
  shifts: ['Morning', 'Afternoon'],
  url: 'https://example.com/apply',
}

describe('JobResultCard', () => {
  describe('Job Details Display', () => {
    test('displays job title, company, and location for users to review', async () => {
      const screen = await render(<JobResultCard job={mockJob} />)

      // User should see essential job info
      await expect.element(screen.getByText('Software Developer')).toBeVisible()
      await expect.element(screen.getByText('Tech Corp')).toBeVisible()
      await expect.element(screen.getByText('Miami, FL')).toBeVisible()
    })

    test('displays salary information when available', async () => {
      const screen = await render(<JobResultCard job={mockJob} />)

      await expect.element(screen.getByText('$50,000 - $70,000')).toBeVisible()
    })

    test('shows Fair Chance badge for second chance employers', async () => {
      const secondChanceJob: JobMatch = {
        ...mockJob,
        isSecondChance: true,
      }

      const screen = await render(<JobResultCard job={secondChanceJob} />)

      await expect.element(screen.getByText('Fair Chance')).toBeVisible()
    })

    test('displays Apply Now button linking to job application', async () => {
      const screen = await render(<JobResultCard job={mockJob} />)

      await expect.element(screen.getByText('Apply Now')).toBeVisible()
    })
  })

  describe('Compact Mode', () => {
    test('displays job info in compact layout with Apply button', async () => {
      const screen = await render(<JobResultCard job={mockJob} compact />)

      // User should see essential info in compact view
      await expect.element(screen.getByText('Software Developer')).toBeVisible()
      await expect.element(screen.getByText(/Tech Corp/)).toBeVisible()
      await expect.element(screen.getByText('Apply')).toBeVisible()
    })
  })

  describe('Shift Icons', () => {
    test('shows moon icon for evening/night shifts', async () => {
      const eveningJob: JobMatch = {
        ...mockJob,
        shifts: ['Night'],
      }

      const screen = await render(<JobResultCard job={eveningJob} />)

      // User should see night shift badge
      await expect.element(screen.getByText('Night')).toBeVisible()
    })
  })
})

describe('JobResultsList', () => {
  describe('No Results State', () => {
    test('shows "No matching jobs found" when jobs array is empty', async () => {
      const screen = await render(<JobResultsList jobs={[]} />)

      await expect.element(screen.getByText('No matching jobs found.')).toBeVisible()
    })

    test('shows suggestions when no results with improvement tips', async () => {
      const suggestions = [
        'Try broadening your search',
        'Check spelling of keywords',
      ]
      const screen = await render(<JobResultsList jobs={[]} suggestions={suggestions} />)

      // User should see the no results message
      await expect.element(screen.getByText('No matching jobs found.')).toBeVisible()

      // User should also see actionable suggestions
      await expect.element(screen.getByText('Try:')).toBeVisible()
      await expect.element(screen.getByText('• Try broadening your search')).toBeVisible()
      await expect.element(screen.getByText('• Check spelling of keywords')).toBeVisible()
    })
  })

  describe('Suggestions Display', () => {
    test('shows suggestions to improve results when jobs exist with suggestions', async () => {
      const suggestions = [
        'Try expanding your search area',
        'Consider adding more skills',
      ]
      const screen = await render(
        <JobResultsList jobs={[mockJob]} suggestions={suggestions} />,
      )

      // User should see the jobs displayed
      await expect.element(screen.getByText('Software Developer')).toBeVisible()

      // User should also see suggestions to improve their results
      await expect.element(screen.getByText('Suggestions to improve results:')).toBeVisible()
      await expect.element(screen.getByText('• Try expanding your search area')).toBeVisible()
      await expect.element(screen.getByText('• Consider adding more skills')).toBeVisible()
    })
  })
})
