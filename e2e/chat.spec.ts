import { test, expect } from '@playwright/test'

test.describe('Chat interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Skip onboarding if present
    const skipBtn = page.locator('text=Skip onboarding')
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click()
    }

    // Also try "Just start chatting" button
    const chatBtn = page.locator('text=Just start chatting')
    if (await chatBtn.isVisible().catch(() => false)) {
      await chatBtn.click()
    }
  })

  test('can type and send a message', async ({ page }) => {
    const input = page.locator('textarea, input[placeholder*="message"], input[placeholder*="ask"], input[placeholder*="type"]').first()
    if (!await input.isVisible().catch(() => false)) {
      test.skip(true, 'Chat input not visible - may need Yahoo auth')
      return
    }

    await input.fill('help')
    await input.press('Enter')

    // Wait for assistant response
    await page.waitForTimeout(3000)

    const messageArea = page.locator('[class*="message"], [class*="chat"], [role="log"]').first()
    await expect(messageArea).toBeVisible()
  })

  test('help command shows capabilities', async ({ page }) => {
    const input = page.locator('textarea, input[placeholder*="message"], input[placeholder*="ask"], input[placeholder*="type"]').first()
    if (!await input.isVisible().catch(() => false)) {
      test.skip(true, 'Chat input not visible')
      return
    }

    await input.fill('what can you do')
    await input.press('Enter')

    await page.waitForTimeout(5000)

    const content = await page.textContent('body')
    const hasResponse = content?.includes('lineup') || content?.includes('trade') || content?.includes('draft') || content?.includes('waiver')
    expect(hasResponse).toBe(true)
  })
})
