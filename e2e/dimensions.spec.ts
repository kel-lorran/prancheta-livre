import { test, expect } from '@playwright/test'
import { clickInSheet, fillFloatingPrompt, fitToScreen, gotoApp, sheetBox } from './helpers'

test('places an orthogonal dimension on the calibrated sheet', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)

  await page.click('button[title="Cota (D)"]')
  await clickInSheet(page, box, 0.35, 0.35)
  await clickInSheet(page, box, 0.6, 0.35)
  await clickInSheet(page, box, 0.6, 0.3)

  await expect(page.locator('g[data-dim]')).toHaveCount(4)
})

test('places an aligned dimension', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)

  await page.click('button[title="Cota (D)"]')
  await page.click('button[title*="Cota alinhada"]')
  await clickInSheet(page, box, 0.35, 0.35)
  await clickInSheet(page, box, 0.55, 0.5)
  await clickInSheet(page, box, 0.3, 0.5)

  await expect(page.locator('g[data-dim]')).toHaveCount(4)
})

test('overrides dimension text and then deletes it', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  await page.click('button[title="Selecionar (V)"]')

  const firstDim = page.locator('g[data-dim]').first()
  const dimText = firstDim.locator('text')
  await dimText.dblclick()
  await fillFloatingPrompt(page, '3,20')
  await expect(dimText).toHaveText('3,20')

  await dimText.click()
  await page.keyboard.press('Delete')
  await expect(page.locator('g[data-dim]')).toHaveCount(2)
})
