import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { clickInSheet, dragBy, dragTo, fitToScreen, gotoApp, sheetBox, storeState } from './helpers'
import type { ImageGroup, Sheet } from '../src/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample-plan.png')

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept())
})

test('cotar still works past a member resized beyond its group frame, with a second group present (regression)', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)
  const groups = page.locator('g[data-testid="group"]')

  // um segundo grupo evita o atalho de "só existe um grupo na prancha, usa ele" — sem isso o teste
  // passaria mesmo sem a correção, porque esse atalho já cobre acidentalmente o caso de 1 grupo só
  await groups.first().click()
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(groups).toHaveCount(2)

  const pasted = groups.nth(1)
  await dragTo(page, pasted, box.x + box.width * 0.6, box.y + box.height * 0.55)

  await pasted.dblclick()
  await pasted.click({ button: 'right' })
  await page.locator('.context-menu button:has-text("Destravar imagem")').click()

  const before = await storeState<{ sheets: Sheet[] }>(page)
  const beforeImage = (before.sheets[0].groups[1] as ImageGroup).images[0]

  const handle = pasted.locator('[data-corner="nw"]')
  const handleBox = await handle.boundingBox()
  if (!handleBox) throw new Error('alça de redimensionar não encontrada')
  // arrasta o canto NW pra cima/esquerda — afasta do ponto de ancoragem (SE), crescendo a imagem
  await dragBy(page, handle, -140, -90)
  await page.keyboard.press('Escape')

  // confirma que o redimensionamento em si calculou certo (regressão da mistura de coordenadas
  // mundo/local): cresceu de verdade, e manteve a proporção original
  const after = await storeState<{ sheets: Sheet[] }>(page)
  const afterImage = (after.sheets[0].groups[1] as ImageGroup).images[0]
  expect(afterImage.w).toBeGreaterThan(beforeImage.w * 1.2)
  expect(afterImage.w / afterImage.h).toBeCloseTo(beforeImage.w / beforeImage.h, 2)

  // essa área só existe depois do redimensionamento, fora do frame antigo do grupo colado — antes
  // da correção, groupsAtSheetLocalPoint recusava o ponto e a ferramenta de cota não fazia nada
  const targetX = handleBox.x - 70
  const targetY = handleBox.y - 45
  const dims = page.locator('g[data-dim]')
  const dimsBefore = await dims.count()
  await page.click('button[title="Cota (D)"]')
  await page.mouse.click(targetX, targetY)
  await page.mouse.click(targetX, targetY + 40)
  await page.mouse.click(targetX + 30, targetY + 40)

  await expect(dims).toHaveCount(dimsBefore + 1)
})

test('entering a group scopes "Importar imagem" to it, adding a second member', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const group = page.locator('g[data-testid="group"]')
  await expect(group).toHaveCount(1)

  await group.dblclick()
  await expect(page.locator('button:has-text("Importar imagem")')).toBeEnabled()
  await page.click('text=Importar imagem')
  await page.setInputFiles('input[type="file"][accept="image/png,image/jpeg"]', FIXTURE_PNG)

  await expect(group).toHaveCount(1)
  await expect(group.locator('image')).toHaveCount(2)
})

test('crops an image via the right-click menu, then edits and removes the mask', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)
  const group = page.locator('g[data-testid="group"]')

  await group.click({ button: 'right' })
  await page.locator('.context-menu button:has-text("Aplicar máscara")').click()
  await clickInSheet(page, box, 0.3, 0.3)
  await clickInSheet(page, box, 0.5, 0.3)
  await clickInSheet(page, box, 0.4, 0.5)
  await page.keyboard.press('Enter')

  await group.click({ button: 'right' })
  await expect(page.locator('.context-menu button:has-text("Editar máscara")')).toBeVisible()
  await page.locator('.context-menu button:has-text("Remover máscara")').click()

  await group.click({ button: 'right' })
  await expect(page.locator('.context-menu button:has-text("Aplicar máscara")')).toBeVisible()
})

test('crops an image after entering its group (regression: the image used to swallow the crop clicks)', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)
  const group = page.locator('g[data-testid="group"]')

  await group.dblclick()
  await group.click({ button: 'right' })
  await page.locator('.context-menu button:has-text("Aplicar máscara")').click()
  await clickInSheet(page, box, 0.3, 0.3)
  await clickInSheet(page, box, 0.5, 0.3)
  await clickInSheet(page, box, 0.4, 0.5)
  await page.keyboard.press('Enter')

  // depois de aplicada, a área clicável da imagem encolheu pro polígono do recorte — clica no
  // centroide do triângulo, não no centro do grupo (que agora está fora da área visível)
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.367, { button: 'right' })
  await expect(page.locator('.context-menu button:has-text("Editar máscara")')).toBeVisible()
})

test('cancels a crop in progress with Escape without applying anything', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)
  const group = page.locator('g[data-testid="group"]')

  await group.click({ button: 'right' })
  await page.locator('.context-menu button:has-text("Aplicar máscara")').click()
  await clickInSheet(page, box, 0.3, 0.3)
  await clickInSheet(page, box, 0.5, 0.3)
  await page.keyboard.press('Escape')

  await group.click({ button: 'right' })
  await expect(page.locator('.context-menu button:has-text("Aplicar máscara")')).toBeVisible()
})

test('agrupar merges two independent groups, desagrupar splits them back', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)
  const groups = page.locator('g[data-testid="group"]')
  await expect(groups).toHaveCount(1)

  // duplica o grupo semeado (mesmo tamanho, só desloca +12,+12mm) e arrasta a cópia pra um canto
  // livre — assim os dois ficam do mesmo porte e sem sobreposição, em vez do import (que nasce
  // grande e cobriria o grupo semeado inteiro)
  await groups.first().click()
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(groups).toHaveCount(2)

  const pasted = groups.nth(1)
  await dragTo(page, pasted, box.x + box.width * 0.82, box.y + box.height * 0.15)

  await groups.nth(0).click()
  await groups.nth(1).click({ modifiers: ['Shift'] })
  await groups.nth(1).click({ button: 'right' })
  await page.locator('.context-menu button:has-text("Agrupar")').click()
  await expect(groups).toHaveCount(1)
  await expect(groups.locator('image')).toHaveCount(2)

  await groups.first().click({ button: 'right' })
  await page.locator('.context-menu button:has-text("Desagrupar")').click()
  await expect(groups).toHaveCount(2)
})

test('copies and pastes a group', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const group = page.locator('g[data-testid="group"]')
  await group.click()
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(group).toHaveCount(2)
})
