import { defineConfig, devices } from '@playwright/test'

/**
 * Base URL under test.
 *
 * - Local/CI default: spin up `npm run dev` and hit localhost.
 * - Preview/prod validation: set `PLAYWRIGHT_BASE_URL` (or `BASE_URL`) to a
 *   deployed URL (e.g. a Vercel preview) and the local dev server is skipped.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:3000'

// When a remote target is provided we test that deployment directly and must
// NOT start a local dev server.
const isRemoteTarget = !!(process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL)

// Vercel Deployment Protection: when previews are behind the auth wall, a
// "Protection Bypass for Automation" secret lets the test runner through.
// Send only the bypass header — it authorizes each request inline. We do NOT
// set `x-vercel-set-bypass-cookie`, because that makes Vercel intercept the
// first request, set a cookie, and 302 back to the SAME path — which breaks
// tests that inspect a redirect with `maxRedirects: 0` (they'd see Vercel's
// redirect instead of the app's). Every request already carries this header via
// `extraHTTPHeaders`, so the cookie is unnecessary.
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const extraHTTPHeaders = bypassSecret
  ? { 'x-vercel-protection-bypass': bypassSecret }
  : undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // Emit the GitHub annotations in CI and always produce an HTML report so the
  // `playwright-report/` artifact upload is meaningful.
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...(extraHTTPHeaders ? { extraHTTPHeaders } : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Only manage a local server when testing localhost.
  ...(isRemoteTarget
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
})
