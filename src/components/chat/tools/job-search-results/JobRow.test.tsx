import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import type { SearchJobResult } from '@/lib/schemas/job'
import { JobRow } from './JobRow'

function createMockJob(overrides: Partial<SearchJobResult> = {}): SearchJobResult {
  return {
    busAccessible: false,
    company: 'Acme Corp',
    description: 'A great job opportunity',
    id: 'job_123',
    isSecondChance: false,
    location: 'Miami, FL',
    postedAt: new Date().toISOString(),
    railAccessible: false,
    salary: '$50,000 - $70,000',
    shifts: [],
    title: 'Software Engineer',
    transitAccessible: false,
    type: 'full-time',
    url: 'https://example.com/apply',
    ...overrides,
  }
}

describe('JobRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Job Info Display', () => {
    test('displays job title and company name', async () => {
      const job = createMockJob()
      const onToggle = vi.fn()

      const screen = await render(<JobRow isExpanded={false} job={job} onToggle={onToggle} />)

      // Component renders both mobile and desktop layouts - check that both exist
      const container = screen.container
      expect(container.textContent).toContain('Software Engineer')
      expect(container.textContent).toContain('Acme Corp')
    })

    test('displays location when provided', async () => {
      const job = createMockJob({ location: 'New York, NY' })
      const onToggle = vi.fn()

      const screen = await render(<JobRow isExpanded={false} job={job} onToggle={onToggle} />)

      // Check location appears in the rendered output
      const container = screen.container
      expect(container.textContent).toContain('New York, NY')
    })

    test('displays salary when provided', async () => {
      const job = createMockJob({ salary: '$80,000/year' })
      const onToggle = vi.fn()

      const screen = await render(<JobRow isExpanded={false} job={job} onToggle={onToggle} />)

      // Check salary appears in the rendered output
      const container = screen.container
      expect(container.textContent).toContain('$80,000/year')
    })

    test('shows Fair Chance Employer star icon when job is second chance', async () => {
      const job = createMockJob({ isSecondChance: true })
      const onToggle = vi.fn()

      const screen = await render(<JobRow isExpanded={false} job={job} onToggle={onToggle} />)

      const starIcon = screen.container.querySelector('span[title="Fair Chance Employer"]')
      expect(starIcon).not.toBeNull()
      expect(starIcon?.textContent).toBe('⭐')
    })

    test('shows transit accessible bus icon when job is transit accessible', async () => {
      const job = createMockJob({ transitAccessible: true })
      const onToggle = vi.fn()

      const screen = await render(<JobRow isExpanded={false} job={job} onToggle={onToggle} />)

      const busIcon = screen.container.querySelector('span[title="Transit Accessible"]')
      expect(busIcon).not.toBeNull()
      expect(busIcon?.textContent).toBe('🚌')
    })

    test('shows shift icons for each shift type', async () => {
      const job = createMockJob({ shifts: ['morning', 'evening'] })
      const onToggle = vi.fn()

      const screen = await render(<JobRow isExpanded={false} job={job} onToggle={onToggle} />)

      const morningIcon = screen.container.querySelector('span[title="morning"]')
      expect(morningIcon).not.toBeNull()
      expect(morningIcon?.textContent).toBe('☀️')

      const eveningIcon = screen.container.querySelector('span[title="evening"]')
      expect(eveningIcon).not.toBeNull()
      expect(eveningIcon?.textContent).toBe('🌙')
    })
  })

  describe('Apply Button', () => {
    test('renders Apply button with correct link', async () => {
      const job = createMockJob({ url: 'https://careers.example.com/apply/123' })
      const onToggle = vi.fn()

      const screen = await render(<JobRow isExpanded={false} job={job} onToggle={onToggle} />)

      const applyLink = screen.container.querySelector('a[href="https://careers.example.com/apply/123"]')
      expect(applyLink).not.toBeNull()
      expect(applyLink?.getAttribute('target')).toBe('_blank')
      expect(applyLink?.getAttribute('rel')).toBe('noopener noreferrer')
    })
  })

  describe('Expand/Collapse', () => {
    test('clicking the row calls onToggle', async () => {
      const job = createMockJob()
      const onToggle = vi.fn()

      const screen = await render(<JobRow isExpanded={false} job={job} onToggle={onToggle} />)

      const row = screen.container.querySelector('[role="button"]')
      expect(row).not.toBeNull()
      await row!.click()

      expect(onToggle).toHaveBeenCalledTimes(1)
    })

    test('shows expanded details when isExpanded is true', async () => {
      const job = createMockJob({
        isSecondChance: true,
        location: 'Austin, TX',
        salary: '$60,000',
        shifts: ['afternoon'],
        transitAccessible: true,
      })
      const onToggle = vi.fn()

      const screen = await render(<JobRow isExpanded={true} job={job} onToggle={onToggle} />)

      // Expanded section shows these details with icons
      await expect.element(screen.getByText('Fair Chance Employer')).toBeVisible()
      await expect.element(screen.getByText('Transit Accessible')).toBeVisible()
      await expect.element(screen.getByText('afternoon shifts')).toBeVisible()
    })

    test('hides expanded details when isExpanded is false', async () => {
      const job = createMockJob({ isSecondChance: true })
      const onToggle = vi.fn()

      const screen = await render(<JobRow isExpanded={false} job={job} onToggle={onToggle} />)

      // Should not show the expanded detail text (only the icon in collapsed state)
      const container = screen.container
      expect(container.textContent).not.toContain('Fair Chance Employer')
    })
  })
})
