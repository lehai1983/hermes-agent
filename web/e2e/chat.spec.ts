import { test, expect, type Page } from '@playwright/test'

/**
 * Critical path E2E tests for the web chat.
 *
 * These tests exercise the full stack: browser → Vite → Gateway WebSocket.
 * Requires a running Hermes gateway + Vite dev server.
 *
 * To run:
 *   npx playwright test          # run all E2E tests
 *   npx playwright test --ui     # interactive debugging
 */

async function gotoChat(page: Page) {
  await page.goto('/chat')
  // Wait for the Thread to render (indicates WebSocket connected)
  await expect(page.locator('[data-testid="thread"]')).toBeVisible({ timeout: 15_000 })
}

test.describe('Chat Page', () => {
  test('renders chat page with thread and composer', async ({ page }) => {
    await gotoChat(page)

    // Thread area visible
    await expect(page.locator('[data-testid="thread"]')).toBeVisible()

    // Composer input visible
    const composer = page.locator('[data-testid="composer-input"]')
    await expect(composer).toBeVisible()
  })

  test('sends a message and receives a reply', async ({ page }) => {
    await gotoChat(page)

    // Type a message
    const composer = page.locator('[data-testid="composer-input"]')
    await composer.fill('Hello, just testing the web chat.')
    await page.keyboard.press('Enter')

    // User message appears in thread
    const userMsg = page.locator('[data-testid="message-user"]').last()
    await expect(userMsg).toBeVisible({ timeout: 10_000 })
    await expect(userMsg).toContainText('Hello, just testing the web chat.')

    // Assistant reply appears (streamed)
    const assistantMsg = page.locator('[data-testid="message-assistant"]').last()
    await expect(assistantMsg).toBeVisible({ timeout: 30_000 })
    // Should have some content (at least markdown rendered)
    await expect(assistantMsg.locator('[data-testid="markdown-content"]')).toBeVisible({ timeout: 15_000 })
  })

  test('displays markdown content in assistant messages', async ({ page }) => {
    await gotoChat(page)

    // Send a message that triggers code response
    const composer = page.locator('[data-testid="composer-input"]')
    await composer.fill('Write a simple Python hello world')
    await page.keyboard.press('Enter')

    // Wait for assistant reply with code block
    const codeBlock = page.locator('[data-testid="message-assistant"] pre code').last()
    await expect(codeBlock).toBeVisible({ timeout: 30_000 })
    await expect(codeBlock).toContainText('def')
  })

  test('mobile responsive: composer and thread adapt to narrow viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })
    await gotoChat(page)

    // Both visible
    await expect(page.locator('[data-testid="thread"]')).toBeVisible()
    await expect(page.locator('[data-testid="composer-input"]')).toBeVisible()

    // Thread should take full width (no overflow)
    const thread = page.locator('[data-testid="thread"]')
    const box = await thread.boundingBox()
    expect(box!.width).toBeLessThanOrEqual(375)
  })
})
