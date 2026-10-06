import { inflateSync } from 'node:zlib'
import { test, expect } from '@playwright/test'
import { clickInSheet, fillFreeTextPrompt, fitToScreen, gotoApp, sheetBox } from './helpers'

/**
 * Decodifica os content streams de um PDF (FlateDecode) e devolve o texto bruto concatenado —
 * o bastante pra confirmar que o conteúdo (texto de cota, título, anotações) realmente está lá,
 * em vez de só checar que *algum* arquivo .pdf foi baixado.
 */
function decodeContentStreams(pdfBytes: Buffer): string {
  const text = pdfBytes.toString('latin1')
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g
  let out = ''
  let m: RegExpExecArray | null
  while ((m = streamRe.exec(text))) {
    const raw = Buffer.from(m[1], 'latin1')
    try {
      out += inflateSync(raw).toString('latin1')
    } catch {
      out += raw.toString('latin1')
    }
  }
  return out
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept())
})

test('PDF export actually draws dimensions, title block and free text (regression: var(--token) and numeric font-weight made svg2pdf skip them silently)', async ({ page }) => {
  await gotoApp(page)
  await fitToScreen(page)
  const box = await sheetBox(page)

  await page.click('button[title="Texto livre — rótulo centralizado, com rotação"]')
  await clickInSheet(page, box, 0.4, 0.3)
  await fillFreeTextPrompt(page, 'ATENÇÃO:\nviga aparente')
  await page.click('button[title="Selecionar (V)"]')

  const downloadPromise = page.waitForEvent('download')
  await page.click('text=Exportar PDF')
  const download = await downloadPromise
  const path = await download.path()
  if (!path) throw new Error('download sem caminho local')
  const fs = await import('node:fs')
  const bytes = fs.readFileSync(path)
  const content = decodeContentStreams(bytes)

  // asserções em boolean/número, nunca contra a string inteira — content tem centenas de KB de
  // bytes de stream decodificados, e um "toContain"/"toMatch" que falha despeja isso tudo no erro.
  // a cota, o título da prancha e o texto livre precisam estar desenhados de verdade no PDF — o
  // texto em si (glifos via Tj) continua presente mesmo quebrado, então checar só a presença da
  // string não pega a regressão.
  expect(content.includes('(7,88)')).toBe(true)
  expect(content.includes('(Projeto de exemplo)')).toBe(true)
  expect(content.includes('(ATEN')).toBe(true) // "ATENÇÃO:" -- o Ç vira um byte não-ascii, então checa só o prefixo
  expect(content.includes('(viga aparente)')).toBe(true)

  // Isso sim é o que realmente quebrava: fill/stroke="var(--token)" não resolvido fazia o
  // svg2pdf.js cair no modo de renderização de texto "3 Tr" (nem preenche nem traça — invisível),
  // sem erro nenhum no console. "0 g"/"g" de verdade aparece antes do Tj quando está correto.
  expect(/\d Tr\b/.test(content)).toBe(false)
})
