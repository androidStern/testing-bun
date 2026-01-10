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

  describe('Single Select Mode', () => {
    test('clicking an option triggers onConfirm with that option in single-select mode', async () => {
      const onConfirm = vi.fn()
      const options = [
        { id: 'opt1', label: 'Full-time' },
        { id: 'opt2', label: 'Part-time' },
      ]

      const screen = await render(
        <OptionList
          question="What type of employment?"
          options={options}
          selectionMode="single"
          onConfirm={onConfirm}
        />,
      )

      // User clicks an option - should immediately trigger confirm with that selection
      const fullTimeOption = screen.getByRole('option', { name: 'Full-time' })
      await fullTimeOption.click()

      // onConfirm should be called with the selected option ID
      expect(onConfirm).toHaveBeenCalledTimes(1)
      expect(onConfirm).toHaveBeenCalledWith(['opt1'])
    })
  })

  describe('Multi Select Mode', () => {
    test('clicking options toggles selection and Confirm button submits all selected', async () => {
      const onConfirm = vi.fn()
      const options = [
        { id: 'opt1', label: 'Morning' },
        { id: 'opt2', label: 'Afternoon' },
        { id: 'opt3', label: 'Evening' },
      ]

      const screen = await render(
        <OptionList
          question="Which shifts can you work?"
          options={options}
          selectionMode="multi"
          onConfirm={onConfirm}
        />,
      )

      // User selects multiple options
      const morningOption = screen.getByRole('option', { name: 'Morning' })
      const eveningOption = screen.getByRole('option', { name: 'Evening' })

      await morningOption.click()
      await eveningOption.click()

      // Should show Confirm button with count
      const confirmButton = screen.getByRole('button', { name: /Confirm \(2\)/i })
      await expect.element(confirmButton).toBeVisible()

      // Click Confirm to submit selections
      await confirmButton.click()

      // onConfirm should be called with both selected IDs
      expect(onConfirm).toHaveBeenCalledTimes(1)
      expect(onConfirm).toHaveBeenCalledWith(expect.arrayContaining(['opt1', 'opt3']))
    })

    test('clicking a selected option deselects it', async () => {
      const onConfirm = vi.fn()
      const options = [
        { id: 'opt1', label: 'Morning' },
        { id: 'opt2', label: 'Afternoon' },
      ]

      const screen = await render(
        <OptionList
          question="Which shifts?"
          options={options}
          selectionMode="multi"
          onConfirm={onConfirm}
        />,
      )

      const morningOption = screen.getByRole('option', { name: 'Morning' })
      const afternoonOption = screen.getByRole('option', { name: 'Afternoon' })

      // Select both
      await morningOption.click()
      await afternoonOption.click()

      // Confirm button shows count of 2
      await expect.element(screen.getByRole('button', { name: /Confirm \(2\)/i })).toBeVisible()

      // Deselect Morning by clicking again
      await morningOption.click()

      // Confirm button should now show count of 1
      await expect.element(screen.getByRole('button', { name: /Confirm \(1\)/i })).toBeVisible()
    })
  })

  describe('Confirmed State', () => {
    test('displays confirmed selections with checkmarks when confirmed prop is provided', async () => {
      const options = [
        { id: 'opt1', label: 'Morning' },
        { id: 'opt2', label: 'Afternoon' },
        { id: 'opt3', label: 'Evening' },
      ]

      const screen = await render(
        <OptionList
          question="Which shifts can you work?"
          options={options}
          confirmed={['opt1', 'opt3']}
        />,
      )

      // Question should still be visible
      await expect.element(screen.getByText('Which shifts can you work?')).toBeVisible()

      // Confirmed options should be displayed with checkmark styling
      await expect.element(screen.getByText('Morning')).toBeVisible()
      await expect.element(screen.getByText('Evening')).toBeVisible()

      // Unconfirmed option (Afternoon) should NOT be visible in confirmed state
      await expect.element(screen.getByText('Afternoon')).not.toBeInTheDocument()
    })
  })
})
