import { test, expect } from '@playwright/test'
import { fitToScreen, gotoApp } from './helpers'
import type { Page } from '@playwright/test'

/**
 * Escreve uma imagem de verdade na área de transferência via Clipboard API, pra testar o botão
 * "Colar imagem" do jeito que ele realmente funciona hoje: lendo navigator.clipboard.read() no
 * clique, não um dispatchEvent('paste') sintético. O evento passivo 'paste' se mostrou pouco
 * confiável (não disparava nem com Ctrl+V real simulado via teclado, nem com execCommand) — por
 * isso a feature trocou pra essa API explícita.
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
