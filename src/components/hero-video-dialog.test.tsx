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
      const thumbnailSrc = thumbnail.element().getAttribute('src')
      expect(thumbnailSrc).toContain('youtube.com/vi/dQw4w9WgXcQ')
    })
  })

  describe('Video Modal', () => {
    test('clicking thumbnail container opens video modal', async () => {
      const screen = await render(
        <HeroVideoDialog
          videoSrc="https://www.youtube.com/embed/dQw4w9WgXcQ"
          thumbnailAlt="Demo video"
        />,
      )

      // Click the group container (parent of thumbnail) to open modal
      const thumbnail = screen.getByRole('img', { name: 'Demo video' })
      const container = thumbnail.element().parentElement
      expect(container).toBeTruthy()
      container!.click()

      // Modal should contain an iframe with the video (wait for it to appear)
      await expect.element(screen.getByTitle(/video/i)).toBeVisible()
      const iframe = screen.container.querySelector('iframe')
      expect(iframe).toBeTruthy()
      expect(iframe?.src).toContain('youtube.com/embed/dQw4w9WgXcQ')
    })
  })
})
