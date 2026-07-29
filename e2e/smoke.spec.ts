import { test, expect } from '@playwright/test'

/**
 * @smoke — fast, dependency-free critical-path checks.
 *
 * These must pass on ANY running instance (local, Vercel preview, or prod)
 * without Yahoo/OpenAI credentials. Run in isolation with `npm run test:smoke`.
 * They are the minimum bar for "is this deployment healthy?".
 */
test.describe('@smoke critical path', () => {
  test('health endpoint responds', async ({ request }) => {
    const res = await request.get('/api/health')
    // 200 = ok, 503 = degraded (e.g. Redis configured but unreachable). Both
    // mean the app is serving traffic; a crash/404 would fail here.
    expect([200, 503]).toContain(res.status())
    const body = await res.json()
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('checks')
  })

  test('yahoo status endpoint responds', async ({ request }) => {
    const res = await request.get('/api/yahoo/status')
    expect(res.status()).toBe(200)
    expect(await res.json()).toHaveProperty('authenticated')
  })

  test('homepage renders', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.status() ?? 200).toBeLessThan(400)
    await expect(page).toHaveTitle(/Fantasy/)

    const hasOnboarding = await page
      .locator('text=Connect Your Yahoo Account')
      .isVisible()
      .catch(() => false)
    const hasChatInput = await page
      .locator('textarea, input[type="text"]')
      .first()
      .isVisible()
      .catch(() => false)
    expect(hasOnboarding || hasChatInput).toBe(true)
  })
})
