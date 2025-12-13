import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import * as dotenv from 'dotenv';

// Load .env.local (TanStack Start/Vite convention)
dotenv.config({ path: '.env.local', quiet: true });
// Also load .env as fallback
dotenv.config({ quiet: true });

export default defineConfig({
  server: {
    port: 3000,
    allowedHosts: true, // Allow tunnel hosts for local testing
  },
  resolve: {
    // Ensure the ESM-friendly build of cookie is used instead of the nested CJS copy under iron-session
    alias: {
      'iron-session/node_modules/cookie': 'cookie',
    },
  },
  optimizeDeps: {
    // Prebundle cookie so named exports (parse/serialize) are available in the browser
    include: ['cookie'],
    // Exclude TanStack Start server packages - they use virtual modules that only exist at runtime
    // See: https://github.com/TanStack/router/issues/5795
    exclude: ['@tanstack/react-start-server', '@tanstack/start-server-core'],
  },
  plugins: [
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart(),
    viteReact(),
  ],
});
