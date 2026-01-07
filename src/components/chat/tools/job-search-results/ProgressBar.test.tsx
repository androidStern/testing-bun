import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  test('displays remaining count when jobs are not all reviewed', async () => {
    const screen = await render(<ProgressBar reviewed={3} total={10} saved={1} />)

    await expect.element(screen.getByText('7 remaining')).toBeVisible()
  })

  test('displays "All reviewed!" message when all jobs are reviewed', async () => {
    const screen = await render(<ProgressBar reviewed={10} total={10} saved={5} />)

    await expect.element(screen.getByText('All reviewed!')).toBeVisible()
  })

  test('displays saved count', async () => {
    const screen = await render(<ProgressBar reviewed={5} total={10} saved={3} />)

    await expect.element(screen.getByText('3 saved')).toBeVisible()
  })

  test('displays reviewed fraction', async () => {
    const screen = await render(<ProgressBar reviewed={7} total={10} saved={2} />)

    await expect.element(screen.getByText('7 / 10 reviewed')).toBeVisible()
  })

  test('displays progress percentage', async () => {
    const screen = await render(<ProgressBar reviewed={5} total={10} saved={1} />)

    await expect.element(screen.getByText('50%')).toBeVisible()
  })

  test('handles zero total without errors', async () => {
    const screen = await render(<ProgressBar reviewed={0} total={0} saved={0} />)

    await expect.element(screen.getByText('0 / 0 reviewed')).toBeVisible()
    await expect.element(screen.getByText('0%')).toBeVisible()
  })
})
