import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ResumeToolbar } from './ResumeToolbar'

describe('ResumeToolbar', () => {
  it('calls onPrint when Print button is clicked twice (expand then execute)', async () => {
    const onDownload = vi.fn()
    const onImport = vi.fn()
    const onPreview = vi.fn()
    const onPrint = vi.fn()

    const screen = await render(
      <ResumeToolbar
        onDownload={onDownload}
        onImport={onImport}
        onPreview={onPreview}
        onPrint={onPrint}
      />,
    )

    // Buttons are: Import (0), Preview (1), Download (2), Print (3)
    const buttons = screen.container.querySelectorAll('button')
    const printButton = buttons[3]
    expect(printButton).not.toBeNull()

    // First click - expands/selects the tab
    await printButton!.click()
    expect(onPrint).not.toHaveBeenCalled()

    // Second click - executes the action
    await printButton!.click()
    expect(onPrint).toHaveBeenCalledTimes(1)
  })

  it('calls onDownload when Download button is clicked twice (expand then execute)', async () => {
    const onDownload = vi.fn()
    const onImport = vi.fn()
    const onPreview = vi.fn()
    const onPrint = vi.fn()

    const screen = await render(
      <ResumeToolbar
        onDownload={onDownload}
        onImport={onImport}
        onPreview={onPreview}
        onPrint={onPrint}
      />,
    )

    // Find the Download button (4th button, after Import, Preview, and separator)
    const buttons = screen.container.querySelectorAll('button')
    // Buttons are: Import (0), Preview (1), Download (2), Print (3) - separator is not a button
    const downloadButton = buttons[2]
    expect(downloadButton).not.toBeNull()

    // First click - expands/selects the tab
    await downloadButton!.click()
    expect(onDownload).not.toHaveBeenCalled()

    // Second click - executes the action
    await downloadButton!.click()
    expect(onDownload).toHaveBeenCalledTimes(1)
  })
})
