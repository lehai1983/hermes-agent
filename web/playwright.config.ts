import { defineConfig } from '@playwright/test'

/**
 * Playwright E2E config for the Hermes web chat.
 *
 * Assumes:
 * - Vite dev server running on :5173
 * - Hermes Python backend (hermes dashboard) running on :9119
 *
 * To run:
 *   npx playwright test           # headless
 *   npx playwright test --ui      # interactive UI mode
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
