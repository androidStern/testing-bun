import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { HeroVideoDialog } from './hero-video-dialog'

describe('HeroVideoDialog', () => {
  describe('Thumbnail Display', () => {
    test('renders video thumbnail with play button overlay', async () => {
      const screen = await render(
        <HeroVideoDialog
          videoSrc="https://www.youtube.com/embed/dQw4w9WgXcQ"
          thumbnailAlt="Demo video"
        />,
      )

      // Thumbnail should be visible
      const thumbnail = screen.getByRole('img', { name: 'Demo video' })
      await expect.element(thumbnail).toBeVisible()

      // YouTube thumbnail URL should be auto-derived
      const thumbnailSrc = thumbnail.element()?.getAttribute('src')
      expect(thumbnailSrc).toContain('youtube.com/vi/dQw4w9WgXcQ')
    })
  })
})
