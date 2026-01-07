import { render } from 'vitest-browser-react'
import { describe, expect, it } from 'vitest'
import { JobCardContent } from './JobCardContent'
import type { SearchJobResult } from '@/lib/schemas/job'

function createMockJob(overrides: Partial<SearchJobResult> = {}): SearchJobResult {
  return {
    id: 'job-123',
    title: 'Software Engineer',
    company: 'Tech Corp',
    location: 'San Francisco, CA',
    salary: '$80,000 - $120,000',
    url: 'https://example.com/apply',
    isSecondChance: false,
    secondChanceTier: null,
    shifts: [],
    transitAccessible: false,
    busAccessible: false,
    railAccessible: false,
    isUrgent: false,
    isEasyApply: false,
    ...overrides,
  }
}

describe('JobCardContent', () => {
  it('displays job title, company, location, salary, and Apply link in stack layout', async () => {
    const job = createMockJob({
      title: 'Warehouse Associate',
      company: 'Amazon',
      location: 'Seattle, WA',
      salary: '$20/hr',
      url: 'https://jobs.amazon.com/apply/123',
      isSecondChance: true,
      shifts: ['morning', 'evening'],
      busAccessible: true,
      isUrgent: true,
      isEasyApply: true,
    })

    const screen = await render(<JobCardContent job={job} layout='stack' />)

    // Core job info
    await expect.element(screen.getByText('Warehouse Associate')).toBeVisible()
    await expect.element(screen.getByText('Amazon')).toBeVisible()
    await expect.element(screen.getByText('Seattle, WA')).toBeVisible()
    await expect.element(screen.getByText('$20/hr')).toBeVisible()

    // Fair Chance badge
    await expect.element(screen.getByText('Fair Chance')).toBeVisible()

    // Shift badges - text contains emoji so use partial match
    const container = screen.container
    expect(container.textContent).toContain('Morning')
    expect(container.textContent).toContain('Evening')

    // Transit info
    await expect.element(screen.getByText('Bus')).toBeVisible()

    // Quick apply badges
    await expect.element(screen.getByText('Urgent')).toBeVisible()
    await expect.element(screen.getByText('Easy Apply')).toBeVisible()

    // Apply button with correct href
    const applyLink = container.querySelector('a[href="https://jobs.amazon.com/apply/123"]')
    expect(applyLink).not.toBeNull()
    expect(applyLink?.textContent).toContain('Apply')
  })
})
