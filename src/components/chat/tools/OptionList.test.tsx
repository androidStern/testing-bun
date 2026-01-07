import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { OptionList } from './OptionList'

describe('OptionList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Display', () => {
    test('renders question and options', async () => {
      const options = [
        { id: 'opt1', label: 'Full-time' },
        { id: 'opt2', label: 'Part-time' },
        { id: 'opt3', label: 'Contract' },
      ]

      const screen = await render(
        <OptionList
          question="What type of employment are you looking for?"
          options={options}
          onConfirm={vi.fn()}
        />,
      )

      // Question should be displayed
      await expect
        .element(screen.getByText('What type of employment are you looking for?'))
        .toBeVisible()

      // All options should be displayed as buttons
      await expect.element(screen.getByRole('option', { name: 'Full-time' })).toBeVisible()
      await expect.element(screen.getByRole('option', { name: 'Part-time' })).toBeVisible()
      await expect.element(screen.getByRole('option', { name: 'Contract' })).toBeVisible()
    })
  })
})
