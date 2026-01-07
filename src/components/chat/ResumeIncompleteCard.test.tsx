import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ResumeIncompleteCard } from './ResumeIncompleteCard'

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={props.to}>{children}</a>
  ),
}))

describe('ResumeIncompleteCard', () => {
  it('shows prompt for user to complete their resume with option to skip', async () => {
    const onComplete = vi.fn()
    const screen = await render(<ResumeIncompleteCard onComplete={onComplete} />)

    // User should see message that resume needs more detail
    await expect.element(screen.getByText('Your resume needs more detail')).toBeVisible()
    await expect
      .element(
        screen.getByText('Add work experience or skills to help us find better matches for you'),
      )
      .toBeVisible()

    // User should see button to complete their resume
    await expect.element(screen.getByText('Complete My Resume')).toBeVisible()

    // User should see option to skip
    const skipButton = screen.getByText('Skip for now →')
    await expect.element(skipButton).toBeVisible()

    // Clicking skip should call onComplete
    await skipButton.click()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
