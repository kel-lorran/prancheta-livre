import { test, expect } from '@playwright/test'
import { clickInSheet, dragBy, fillFreeTextPrompt, fitToScreen, gotoApp, sheetBox, storeState } from './helpers'
import type { FreeTextAnnotation, Sheet } from '../src/types'

const TOOL_TITLE = 'Texto livre — rótulo centralizado, com rotação'

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept())
})

test('adds a centered free-text label with a line break', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)

  await page.click(`button[title="${TOOL_TITLE}"]`)
  await clickInSheet(page, box, 0.4, 0.3)

  const area = page.locator('.floating-box textarea').first()
  await area.waitFor({ state: 'visible' })
  await area.pressSequentially('SALA')
  await area.press('Enter') // Enter sozinho quebra linha, não confirma
  await area.pressSequentially('ampla')
  await area.press('Control+Enter') // Ctrl+Enter confirma

  const g = page.locator('g[data-kind="text"]')
  await expect(g).toHaveCount(1)
  await expect(g.locator('text')).toHaveAttribute('text-anchor', 'middle')
  await expect(g.locator('tspan')).toHaveCount(2)

  const state = await storeState<{ sheets: Sheet[] }>(page)
  const ann = state.sheets[0].groups[0].annotations[0] as FreeTextAnnotation
  expect(ann.kind).toBe('text')
  expect(ann.text).toBe('SALA\nampla')
  expect(ann.rotation).toBe(0)
})

test('rotates a free-text label by dragging its handle, snapping to 15° with Shift', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)

  await page.click(`button[title="${TOOL_TITLE}"]`)
  await clickInSheet(page, box, 0.4, 0.3)
  await fillFreeTextPrompt(page, 'CORTE AA')

  await page.click('button[title="Selecionar (V)"]')
  await page.locator('g[data-kind="text"] [data-role="hit"]').click()

  const handle = page.locator('g[data-kind="text"] [data-role="rotate-handle"]')
  const handleBox = await handle.boundingBox()
  if (!handleBox) throw new Error('alça de rotação não encontrada')
  const hx = handleBox.x + handleBox.width / 2
  const hy = handleBox.y + handleBox.height / 2

  // arrasta a alça pra bem à direita, praticamente na mesma altura do centro do texto — o ângulo
  // resultante fica perto de 90° e o Shift arredonda pro múltiplo de 15 mais próximo.
  await page.mouse.move(hx, hy)
  await page.mouse.down()
  await page.keyboard.down('Shift')
  await page.mouse.move(hx + 180, hy, { steps: 6 })
  await page.keyboard.up('Shift')
  await page.mouse.up()

  const state = await storeState<{ sheets: Sheet[] }>(page)
  const ann = state.sheets[0].groups[0].annotations[0] as FreeTextAnnotation
  expect(ann.rotation).toBe(90)
})

test('double-click edits an existing free-text label, preserving the line break', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)

  await page.click(`button[title="${TOOL_TITLE}"]`)
  await clickInSheet(page, box, 0.4, 0.3)
  await fillFreeTextPrompt(page, 'ATENÇÃO:\nviga aparente')

  await page.click('button[title="Selecionar (V)"]')
  await page.locator('g[data-kind="text"] [data-role="hit"]').dblclick()

  const area = page.locator('.floating-box textarea').first()
  await expect(area).toHaveValue('ATENÇÃO:\nviga aparente')
  await area.fill('ATENÇÃO:\nviga a 2,10m')
  await page.click('.floating-box button.ok')

  const state = await storeState<{ sheets: Sheet[] }>(page)
  const ann = state.sheets[0].groups[0].annotations[0] as FreeTextAnnotation
  expect(ann.text).toBe('ATENÇÃO:\nviga a 2,10m')
})

test('moves and deletes a free-text label', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)

  await page.click(`button[title="${TOOL_TITLE}"]`)
  await clickInSheet(page, box, 0.4, 0.3)
  await fillFreeTextPrompt(page, 'QUARTO')

  await page.click('button[title="Selecionar (V)"]')
  const before = await storeState<{ sheets: Sheet[] }>(page)
  const beforePos = (before.sheets[0].groups[0].annotations[0] as FreeTextAnnotation).pos

  await dragBy(page, page.locator('g[data-kind="text"] [data-role="hit"]'), 60, -40)

  const after = await storeState<{ sheets: Sheet[] }>(page)
  const afterPos = (after.sheets[0].groups[0].annotations[0] as FreeTextAnnotation).pos
  expect(Math.abs(afterPos.x - beforePos.x)).toBeGreaterThan(0.05)

  // já selecionado pelo próprio arraste — Delete age direto
  await page.keyboard.press('Delete')
  await expect(page.locator('g[data-kind="text"]')).toHaveCount(0)
})
