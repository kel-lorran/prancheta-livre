import { test, expect } from '@playwright/test'

test('shows the tips modal on first load and remembers it was dismissed', async ({ page }) => {
  await page.goto('/')
  const modal = page.locator('.tips-modal')
  await expect(modal).toBeVisible()
  await modal.locator('button.ok').click()
  await expect(modal).toBeHidden()

  await page.reload()
  await page.locator('.sheet-tab').first().waitFor({ state: 'visible' })
  await expect(page.locator('.tips-modal')).toBeHidden()

  // ainda acessível pelo botão "?" da toolbar
  await page.click('button[title="Dicas e atalhos"]')
  await expect(page.locator('.tips-modal')).toBeVisible()
})
