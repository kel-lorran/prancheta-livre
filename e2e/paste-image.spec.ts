import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { fitToScreen, gotoApp } from './helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample-plan.png')

/**
 * Dispara um evento `paste` sintético com uma imagem no alvo real de colar — não no window, que é
 * só pra onde o evento borbulharia; ele precisa cair exatamente no div contentEditable que recebe
 * o paste de verdade (ver comentário em Canvas.tsx sobre por que ele existe).
 */
async function pasteImage(page: import('@playwright/test').Page, base64: string) {
  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const file = new File([bytes], 'colado.png', { type: 'image/png' })
    const dt = new DataTransfer()
    dt.items.add(file)
    const target = document.querySelector('[data-testid="paste-target"]')
    target?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, base64)
}

test('the hidden paste target is focused by default, so a real Ctrl+V/Win+V has somewhere to land', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const target = page.locator('[data-testid="paste-target"]')
  await expect(target).toBeFocused()
})

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

test('the paste target regains focus after closing a text prompt, so paste keeps working', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const target = page.locator('[data-testid="paste-target"]')
  await expect(target).toBeFocused()

  // abre e fecha o prompt de "Projeto" (um input de verdade) via teclado — isso não dispara mouseup
  await page.click('text=Projeto')
  await expect(page.locator('.floating-box input').first()).toBeFocused()
  await page.keyboard.press('Escape')

  await expect(target).toBeFocused()
})
