import { test, expect } from '@playwright/test'
import { clickInSheet, fitToScreen, gotoApp, sheetBox } from './helpers'

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept())
})

test('undo restores a deleted dimension', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  await page.click('button[title="Selecionar (V)"]')

  await expect(page.locator('g[data-dim]')).toHaveCount(3)
  await page.locator('g[data-dim]').first().locator('text').click()
  await page.keyboard.press('Delete')
  await expect(page.locator('g[data-dim]')).toHaveCount(2)

  await page.click('button[title="Desfazer (Ctrl+Z)"]')
  await expect(page.locator('g[data-dim]')).toHaveCount(3)

  await page.click('button[title="Refazer (Ctrl+Shift+Z)"]')
  await expect(page.locator('g[data-dim]')).toHaveCount(2)
})

test('undo restores a deleted annotation', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)

  await page.click('button[title="Numeração circulada"]')
  await clickInSheet(page, box, 0.2, 0.2)
  await page.click('button[title="Selecionar (V)"]')
  await expect(page.locator('g[data-kind="marker"]')).toHaveCount(1)

  await page.locator('g[data-kind="marker"]').click()
  await page.keyboard.press('Delete')
  await expect(page.locator('g[data-kind="marker"]')).toHaveCount(0)

  await page.click('button[title="Desfazer (Ctrl+Z)"]')
  await expect(page.locator('g[data-kind="marker"]')).toHaveCount(1)
})

test('undo/redo buttons disable at the ends of history', async ({ page }) => {
  await gotoApp(page)
  await expect(page.locator('button[title="Desfazer (Ctrl+Z)"]')).toBeDisabled()
  await expect(page.locator('button[title="Refazer (Ctrl+Shift+Z)"]')).toBeDisabled()

  await page.click('text=+ Prancha')
  await expect(page.locator('button[title="Desfazer (Ctrl+Z)"]')).toBeEnabled()
  await expect(page.locator('button[title="Refazer (Ctrl+Shift+Z)"]')).toBeDisabled()

  await page.click('button[title="Desfazer (Ctrl+Z)"]')
  await expect(page.locator('button[title="Desfazer (Ctrl+Z)"]')).toBeDisabled()
  await expect(page.locator('button[title="Refazer (Ctrl+Shift+Z)"]')).toBeEnabled()
})
