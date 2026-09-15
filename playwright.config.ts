import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Some sandboxes ship a pre-installed Chromium outside Playwright's own managed
// browser cache; use it when present instead of requiring `playwright install`.
// Falls back to Playwright's normal resolution everywhere else (e.g. CI).
const preinstalledChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const executablePath = existsSync(preinstalledChromium) ? preinstalledChromium : undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5183',
    trace: 'retain-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5183 --strictPort',
    url: 'http://localhost:5183',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
