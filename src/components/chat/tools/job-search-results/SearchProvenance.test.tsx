import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import type { SearchContext } from '@/lib/schemas/job'
import { SearchProvenance } from './SearchProvenance'

const createContext = (overrides: Partial<SearchContext> = {}): SearchContext => ({
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
  query: 'software engineer',
  totalFound: 10,
  ...overrides,
})

describe('SearchProvenance', () => {
  test('displays job count for multiple jobs', async () => {
    const screen = await render(
      <SearchProvenance jobCount={15} searchContext={createContext()} />,
    )

    await expect.element(screen.getByText('Found 15 jobs')).toBeVisible()
  })

  test('displays singular job count for one job', async () => {
    const screen = await render(
      <SearchProvenance jobCount={1} searchContext={createContext()} />,
    )

    await expect.element(screen.getByText('Found 1 job')).toBeVisible()
  })

  test('displays "No jobs found" when count is zero', async () => {
    const screen = await render(
      <SearchProvenance jobCount={0} searchContext={createContext()} />,
    )

    await expect.element(screen.getByText('No jobs found')).toBeVisible()
  })

  test('displays search query in DOM (may be hidden on some viewports)', async () => {
    const screen = await render(
      <SearchProvenance
        jobCount={5}
        searchContext={createContext({ query: 'warehouse associate' })}
      />,
    )

    // The full query appears in the desktop view (sm:block), verify it's in the DOM
    const container = screen.container
    expect(container.textContent).toContain('warehouse associate')
  })

  test('displays transit and fair chance icons when filters are active', async () => {
    const context = createContext({
      query: 'delivery driver',
      filters: {
        busRequired: true,
        easyApplyOnly: false,
        railRequired: false,
        secondChancePreferred: true,
        secondChanceRequired: false,
        shifts: ['morning'],
        urgentOnly: false,
      },
    })

    const screen = await render(<SearchProvenance jobCount={3} searchContext={context} />)

    // Users should see icons indicating their active filters
    const container = screen.container
    expect(container.textContent).toContain('🚌') // transit icon
    expect(container.textContent).toContain('⭐') // fair chance icon
    expect(container.textContent).toContain('☀️') // morning shift icon
  })

  test('displays commute time with filter text when within commute zone', async () => {
    const context = createContext({
      query: 'cashier',
      location: {
        withinCommuteZone: true,
        maxCommuteMinutes: 30,
      },
      filters: {
        busRequired: false,
        easyApplyOnly: false,
        railRequired: false,
        secondChancePreferred: false,
        secondChanceRequired: true,
        shifts: [],
        urgentOnly: false,
      },
    })

    const screen = await render(<SearchProvenance jobCount={5} searchContext={context} />)

    // Users should see commute time and fair chance only text
    const container = screen.container
    expect(container.textContent).toContain('30min')
    expect(container.textContent).toContain('fair chance only')
    expect(container.textContent).toContain('⏱️') // commute time icon
  })
})
