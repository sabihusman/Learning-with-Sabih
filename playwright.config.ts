import { defineConfig, devices } from '@playwright/test'

// Tests run against the built static export (./out) served locally. They never
// touch the deployed Hetzner server. Build first (npm run build), then test.
const PORT = 4173
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  // Chromium only to start, as requested.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node e2e/serve-out.mjs',
    url: `${baseURL}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
