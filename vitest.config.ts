import { playwright } from '@vitest/browser-playwright'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      browser: {
        enabled: true,
        instances: [{ browser: 'chromium' }],
        provider: playwright(),
      },
      globals: true,
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      coverage: {
        provider: 'istanbul',
        reporter: ['text', 'text-summary', 'json', 'html'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
          'src/routeTree.gen.ts',
          'src/components/ui/**', // shadcn components
        ],
      },
    },
  }),
)
