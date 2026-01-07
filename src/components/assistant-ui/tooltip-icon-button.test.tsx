import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TooltipIconButton } from './tooltip-icon-button'
import { Settings } from 'lucide-react'

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>
}

describe('TooltipIconButton', () => {
  describe('Basic Rendering', () => {
    test('renders button with accessible tooltip text', async () => {
      const screen = await render(
        <TestWrapper>
          <TooltipIconButton tooltip="Settings">
            <Settings />
          </TooltipIconButton>
        </TestWrapper>,
      )

      // Button should have accessible name from tooltip
      const button = screen.getByRole('button', { name: 'Settings' })
      await expect.element(button).toBeVisible()
    })
  })
})
