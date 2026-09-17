import { test, expect } from '@playwright/test'
import { fitToScreen, gotoApp, sheetBox } from './helpers'

test('crossing marquee (drag right-to-left) selects and bulk-deletes the group, undo restores it', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)
  await page.click('button[title="Selecionar (V)"]')

  await expect(page.locator('g[data-testid="group"]')).toHaveCount(1)
  await expect(page.locator('g[data-dim]')).toHaveCount(3)

  // arrasta de fora do grupo (esquerda->direita = window/contém), envolvendo grupo + cotas inteiros
  await page.mouse.move(box.x + box.width * 0.02, box.y + box.height * 0.02)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.95, { steps: 5 })
  await page.mouse.up()

  await page.keyboard.press('Delete')
  await expect(page.locator('g[data-testid="group"]')).toHaveCount(0)
  await expect(page.locator('g[data-dim]')).toHaveCount(0)

  await page.click('button[title="Desfazer (Ctrl+Z)"]')
  await expect(page.locator('g[data-testid="group"]')).toHaveCount(1)
  await expect(page.locator('g[data-dim]')).toHaveCount(3)
})
