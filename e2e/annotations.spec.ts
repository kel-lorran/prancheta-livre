import { test, expect } from '@playwright/test'
import { clickInSheet, fillFloatingPrompt, fitToScreen, gotoApp, sheetBox } from './helpers'

test('adds a circled marker with a click', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)

  await page.click('button[title="Numeração circulada"]')
  await clickInSheet(page, box, 0.1, 0.2)
  await clickInSheet(page, box, 0.15, 0.2)

  await expect(page.locator('g[data-kind="marker"]')).toHaveCount(2)
  await expect(page.locator('g[data-kind="marker"]').first().locator('text')).toHaveText('1')
  await expect(page.locator('g[data-kind="marker"]').nth(1).locator('text')).toHaveText('2')
})

test('adds a leader with a two-click draft and text prompt', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)

  await page.click('button[title="Chamada de texto (leader)"]')
  await clickInSheet(page, box, 0.4, 0.4)
  await clickInSheet(page, box, 0.7, 0.2)
  await fillFloatingPrompt(page, 'PISO EM PORCELANATO')

  const leader = page.locator('g[data-kind="leader"]')
  await expect(leader).toHaveCount(1)
  await expect(leader.locator('text')).toHaveText('PISO EM PORCELANATO')
})

test('adds a level reference line', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)

  await page.click('button[title="Linha de referência de nível"]')
  await clickInSheet(page, box, 0.15, 0.85)
  await clickInSheet(page, box, 0.6, 0.85)
  await fillFloatingPrompt(page, '0,00 PISO TÉRREO')

  const level = page.locator('g[data-kind="level"]')
  await expect(level).toHaveCount(1)
  await expect(level.locator('text')).toHaveText('0,00 PISO TÉRREO')
})

test('adds a detail callout referencing another area', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)

  await page.click('button[title="Chamada de detalhe (referência a outra vista)"]')
  await clickInSheet(page, box, 0.55, 0.35)
  await clickInSheet(page, box, 0.68, 0.5)
  await clickInSheet(page, box, 0.85, 0.2)
  await fillFloatingPrompt(page, 'DETALHE A')

  const callout = page.locator('g[data-kind="callout"]')
  await expect(callout).toHaveCount(1)
  await expect(callout.locator('text')).toHaveText('DETALHE A')
})

test('selects and deletes an annotation', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)

  await page.click('button[title="Numeração circulada"]')
  await clickInSheet(page, box, 0.2, 0.2)
  await expect(page.locator('g[data-kind="marker"]')).toHaveCount(1)

  await page.click('button[title="Selecionar (V)"]')
  await page.locator('g[data-kind="marker"]').click()
  await page.keyboard.press('Delete')
  await expect(page.locator('g[data-kind="marker"]')).toHaveCount(0)
})
