import { test, expect } from '@playwright/test'

test.describe('App loads', () => {
  test('homepage renders without crashing', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Fantasy/)
    await page.waitForLoadState('networkidle')
  })

  test('shows onboarding or chat interface', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const hasOnboarding = await page.locator('text=Connect Your Yahoo Account').isVisible().catch(() => false)
    const hasChatInput = await page.locator('textarea, input[type="text"]').first().isVisible().catch(() => false)

    expect(hasOnboarding || hasChatInput).toBe(true)
  })
})

test.describe('API health', () => {
  test('yahoo status endpoint responds', async ({ request }) => {
    const response = await request.get('/api/yahoo/status')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('authenticated')
  })
})
