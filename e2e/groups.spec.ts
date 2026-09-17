import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { clickInSheet, fitToScreen, gotoApp, sheetBox } from './helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample-plan.png')

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept())
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

test('crops an image via the right-click menu, then edits and removes the crop', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)
  const group = page.locator('g[data-testid="group"]')

  await group.click({ button: 'right' })
  await page.locator('.context-menu button:has-text("Recortar")').click()
  await clickInSheet(page, box, 0.3, 0.3)
  await clickInSheet(page, box, 0.5, 0.3)
  await clickInSheet(page, box, 0.4, 0.5)
  await page.keyboard.press('Enter')

  await group.click({ button: 'right' })
  await expect(page.locator('.context-menu button:has-text("Editar recorte")')).toBeVisible()
  await page.locator('.context-menu button:has-text("Remover recorte")').click()

  await group.click({ button: 'right' })
  await expect(page.locator('.context-menu button:has-text("Recortar")')).toBeVisible()
})

test('cancels a crop in progress with Escape without applying anything', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)
  const group = page.locator('g[data-testid="group"]')

  await group.click({ button: 'right' })
  await page.locator('.context-menu button:has-text("Recortar")').click()
  await clickInSheet(page, box, 0.3, 0.3)
  await clickInSheet(page, box, 0.5, 0.3)
  await page.keyboard.press('Escape')

  await group.click({ button: 'right' })
  await expect(page.locator('.context-menu button:has-text("Recortar")')).toBeVisible()
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
  const pastedBox = await pasted.boundingBox()
  if (!pastedBox) throw new Error('grupo colado sem bounding box')
  await page.mouse.move(pastedBox.x + pastedBox.width / 2, pastedBox.y + pastedBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.15, { steps: 5 })
  await page.mouse.up()

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
