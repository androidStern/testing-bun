import { describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ExpandableTextarea } from './expandable-textarea'

describe('ExpandableTextarea', () => {
  describe('Text Entry', () => {
    test('user typing in textarea triggers onChange with new value', async () => {
      const onChange = vi.fn()
      const screen = await render(
        <ExpandableTextarea
          onChange={onChange}
          placeholder="Enter text..."
          value=""
        />,
      )

      // Find the inline textarea and type into it
      const textarea = screen.getByRole('textbox')
      await textarea.fill('New content')

      // onChange should be called with the typed content
      expect(onChange).toHaveBeenCalled()
      // The last call should contain the full text
      expect(onChange).toHaveBeenLastCalledWith('New content')
    })
  })

  describe('Expand to Modal', () => {
    test('clicking expand button opens modal with custom title for easier editing', async () => {
      const onChange = vi.fn()
      const screen = await render(
        <ExpandableTextarea
          modalTitle="Professional Summary"
          onChange={onChange}
          placeholder="Enter your summary..."
          value="My professional experience includes..."
        />,
      )

      // Initially, the modal title should not be visible (modal is closed)
      expect(screen.container.textContent).not.toContain('Professional Summary')

      // Click the expand button to open the modal
      const expandButton = screen.getByRole('button', { name: /expand editor/i })
      await expandButton.click()

      // Modal should be visible with the custom title
      await expect.element(screen.getByText('Professional Summary')).toBeVisible()

      // Find all textareas in the document (including portal-mounted dialogs)
      const allTextareas = document.querySelectorAll('textarea')
      // There should be 2 textareas: one inline, one in modal
      expect(allTextareas.length).toBe(2)

      // The modal textarea should have the same value
      const modalTextarea = allTextareas[1] as HTMLTextAreaElement
      expect(modalTextarea.value).toBe('My professional experience includes...')
    })

    test('typing in modal textarea triggers onChange with new value', async () => {
      const onChange = vi.fn()
      const screen = await render(
        <ExpandableTextarea
          modalTitle="Edit Content"
          onChange={onChange}
          placeholder="Enter text..."
          value="Initial content"
        />,
      )

      // Open the modal
      const expandButton = screen.getByRole('button', { name: /expand editor/i })
      await expandButton.click()

      // Modal should be open
      await expect.element(screen.getByText('Edit Content')).toBeVisible()

      // Find the modal textarea (there are 2 textareas, modal is second)
      const allTextareas = document.querySelectorAll('textarea')
      const modalTextarea = allTextareas[1] as HTMLTextAreaElement

      // Use native setter to update value and dispatch input event (React controlled input)
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set
      nativeInputValueSetter?.call(modalTextarea, 'Updated in modal')
      modalTextarea.dispatchEvent(new Event('input', { bubbles: true }))

      // onChange should have been called with the new value
      expect(onChange).toHaveBeenCalledWith('Updated in modal')
    })

    test('closing modal triggers onBlur callback', async () => {
      const onChange = vi.fn()
      const onBlur = vi.fn()
      const screen = await render(
        <ExpandableTextarea
          modalTitle="Edit Description"
          onBlur={onBlur}
          onChange={onChange}
          placeholder="Enter description..."
          value="Test content"
        />,
      )

      // Open the modal
      const expandButton = screen.getByRole('button', { name: /expand editor/i })
      await expandButton.click()

      // Modal should be open
      await expect.element(screen.getByText('Edit Description')).toBeVisible()

      // onBlur should not have been called yet
      expect(onBlur).not.toHaveBeenCalled()

      // Close the modal by clicking the close button (X)
      const closeButton = screen.getByRole('button', { name: /close/i })
      await closeButton.click()

      // onBlur should be called when modal closes
      expect(onBlur).toHaveBeenCalledTimes(1)
    })
  })
})
