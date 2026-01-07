import { describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ExpandableTextarea } from './expandable-textarea'

describe('ExpandableTextarea', () => {
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
  })
})
