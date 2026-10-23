import { test, expect } from '@playwright/test'
import { fitToScreen, gotoApp } from './helpers'
import type { Page } from '@playwright/test'

/**
 * Colar imagem tem dois caminhos: o evento passivo 'paste' (automático, pega Ctrl+V/Win+V de
 * verdade — mas não dá pra confirmar que o navegador dispara o evento num ambiente de teste
 * sandboxed sem display/gerenciador de área de transferência real, então os testes dele abaixo
 * são só estruturais) e o botão "Colar imagem" (explícito, via navigator.clipboard.read() no
 * clique — esse sim testado de ponta a ponta com uma imagem de verdade na área de transferência).
 */
async function writeImageToClipboard(page: Page) {
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 50
    canvas.height = 50
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'red'
    ctx.fillRect(0, 0, 50, 50)
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  })
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('pastes an image from the clipboard as a new group via the "Colar imagem" button', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  await writeImageToClipboard(page)

  // clica numa área vazia da prancha pra selecionar a prancha (alvo válido pra importar)
  await page.locator('[data-testid="sheet-paper"]').click({ position: { x: 10, y: 10 } })

  const groups = page.locator('g[data-testid="group"]')
  await expect(groups).toHaveCount(1)

  await page.click('button[title="Colar imagem da área de transferência"]')

  await expect(groups).toHaveCount(2)
})

test('"Colar imagem" is disabled with no sheet selected', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  await page.keyboard.press('Escape')

  await expect(page.locator('button', { hasText: 'Colar imagem' })).toBeDisabled()
})

test('pasting with nothing image-like on the clipboard warns instead of silently failing', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  await page.locator('[data-testid="sheet-paper"]').click({ position: { x: 10, y: 10 } })

  await page.evaluate(async () => {
    await navigator.clipboard.writeText('não é uma imagem')
  })

  await page.click('button[title="Colar imagem da área de transferência"]')

  await expect(page.locator('#statusbar.warn .hint')).toHaveText('Não encontrei nenhuma imagem na área de transferência.')
  await expect(page.locator('g[data-testid="group"]')).toHaveCount(1)
})

test('the hidden paste target is focused by default, so a real Ctrl+V/Win+V has somewhere to land', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  await expect(page.locator('[data-testid="paste-target"]')).toBeFocused()
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

test('a paste event landing on the hidden target imports an image (structural check — can\'t confirm a real browser fires it in this sandbox)', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  await page.locator('[data-testid="sheet-paper"]').click({ position: { x: 10, y: 10 } })

  const groups = page.locator('g[data-testid="group"]')
  await expect(groups).toHaveCount(1)

  await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 50
    canvas.height = 50
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'blue'
    ctx.fillRect(0, 0, 50, 50)
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
    const file = new File([blob], 'colado.png', { type: 'image/png' })
    const dt = new DataTransfer()
    dt.items.add(file)
    const target = document.querySelector('[data-testid="paste-target"]')
    target?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })

  await expect(groups).toHaveCount(2)
})
