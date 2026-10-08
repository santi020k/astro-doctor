import { defineConfig, devices } from '@playwright/test'

import {
  DOCS_PREVIEW_PORT,
  DOCS_PREVIEW_URL,
  DOCS_SERVER_TIMEOUT_MS,
  DOCS_TEST_TIMEOUT_MS,
  DOCS_TEST_WORKERS
} from './tests/constants'

export default defineConfig({
  testDir: './tests',
  timeout: DOCS_TEST_TIMEOUT_MS,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  workers: DOCS_TEST_WORKERS,
  reporter: 'list',
  use: {
    baseURL: DOCS_PREVIEW_URL,
    trace: 'retain-on-failure'
  },
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL }
  }],
  webServer: {
    command: `pnpm exec astro preview --host 127.0.0.1 --port ${DOCS_PREVIEW_PORT} --ignore-lock`,
    url: DOCS_PREVIEW_URL,
    reuseExistingServer: !process.env.CI,
    timeout: DOCS_SERVER_TIMEOUT_MS
  }
})
