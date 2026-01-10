import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ResumeToolbar } from './ResumeToolbar'

describe('ResumeToolbar', () => {
  // Note: ExpandableTabs requires two clicks - first to expand/select, second to execute
  // Button indices: Import (0), Preview (1), Download (2), Print (3)

  it.each([
    { name: 'Import', index: 0, callbackKey: 'onImport' },
    { name: 'Preview', index: 1, callbackKey: 'onPreview' },
    { name: 'Download', index: 2, callbackKey: 'onDownload' },
    { name: 'Print', index: 3, callbackKey: 'onPrint' },
  ] as const)('calls $callbackKey when $name button is double-clicked', async ({ index, callbackKey }) => {
    const callbacks = {
      onDownload: vi.fn(),
      onImport: vi.fn(),
      onPreview: vi.fn(),
      onPrint: vi.fn(),
    }

    const screen = await render(
      <ResumeToolbar
        onDownload={callbacks.onDownload}
        onImport={callbacks.onImport}
        onPreview={callbacks.onPreview}
        onPrint={callbacks.onPrint}
      />,
    )

    const buttons = screen.container.querySelectorAll('button')
    const button = buttons[index]
    expect(button).not.toBeNull()

    // First click - expands/selects the tab
    await button.click()
    expect(callbacks[callbackKey]).not.toHaveBeenCalled()

    // Second click - executes the action
    await button.click()
    expect(callbacks[callbackKey]).toHaveBeenCalledTimes(1)
  })
})
