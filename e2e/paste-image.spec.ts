import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { fitToScreen, gotoApp } from './helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample-plan.png')

/** Dispara um evento `paste` sintético com uma imagem — sem depender da área de transferência real do SO. */
async function pasteImage(page: import('@playwright/test').Page, base64: string) {
  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const file = new File([bytes], 'colado.png', { type: 'image/png' })
    const dt = new DataTransfer()
    dt.items.add(file)
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, base64)
}

test('pastes an image from the clipboard as a new group', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)

  // clica numa área vazia da prancha pra selecionar a prancha (alvo válido pra importar)
  await page.locator('[data-testid="sheet-paper"]').click({ position: { x: 10, y: 10 } })

  const groups = page.locator('g[data-testid="group"]')
  await expect(groups).toHaveCount(1)

  const base64 = fs.readFileSync(FIXTURE_PNG).toString('base64')
  await pasteImage(page, base64)

  await expect(groups).toHaveCount(2)
})

test('pasting an image with no sheet selected warns instead of silently failing', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)

  // nada selecionado — Esc garante
  await page.keyboard.press('Escape')

  const base64 = fs.readFileSync(FIXTURE_PNG).toString('base64')
  await pasteImage(page, base64)

  await expect(page.locator('#statusbar.warn .hint')).toHaveText('Selecione uma prancha (ou entre num grupo) antes de importar uma imagem.')
  await expect(page.locator('g[data-testid="group"]')).toHaveCount(1)
})
