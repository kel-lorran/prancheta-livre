import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { fillCalibratePrompt, fitToScreen, gotoApp, sheetBox } from './helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample-plan.png')

test('imports a PNG into a new sheet and calibrates it to a standard scale', async ({ page }) => {
  await gotoApp(page)
  await page.click('text=+ Prancha')
  await fitToScreen(page)

  const secondTab = page.locator('.sheet-tab').nth(1)
  await secondTab.click()
  await page.click('text=Importar imagem')
  await page.setInputFiles('input[type="file"][accept="image/png,image/jpeg"]', FIXTURE_PNG)

  const secondSheetGroup = page.locator('[data-testid="sheet-group"]').nth(1)
  await expect(secondSheetGroup.locator('g[data-testid="group"]')).toHaveCount(1)
  await expect(secondSheetGroup.locator('image')).toHaveCount(1)

  const box = await sheetBox(page, 1)
  await page.click('button[title="Calibrar escala do grupo (C)"]')
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4)
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4)
  await fillCalibratePrompt(page, 2)

  await expect(page.locator('svg text', { hasText: '1:100' })).toBeVisible()
  // calibrating locks the group and removes the resize handles
  await expect(secondSheetGroup.locator('[data-corner]')).toHaveCount(0)
})
