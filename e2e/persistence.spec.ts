import { test, expect } from '@playwright/test'
import { fillFloatingPrompt, gotoApp } from './helpers'

test('autosaves to IndexedDB and resumes after a reload', async ({ page }) => {
  await gotoApp(page)

  const tab = page.locator('.sheet-tab').first()
  await tab.locator('.name').click()
  const input = tab.locator('.rename-input')
  await input.fill('Planta reaberta depois do reload')
  await input.press('Enter')

  // give the debounced autosave time to flush to IndexedDB
  await page.waitForTimeout(1200)
  await page.reload()
  await page.locator('.sheet-tab').first().waitFor({ state: 'visible' })

  await expect(page.locator('.sheet-tab').first().locator('.name')).toHaveText('Planta reaberta depois do reload')
  await expect(page.locator('.sheet-tab')).toHaveCount(1)
})

test('exports a project .zip file', async ({ page }) => {
  await gotoApp(page)
  const downloadPromise = page.waitForEvent('download')
  await page.click('text=Exportar projeto')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.zip$/)
})

test('exports a PDF file', async ({ page }) => {
  await gotoApp(page)
  const downloadPromise = page.waitForEvent('download')
  await page.click('text=Exportar PDF')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
})

test('edits project info from the toolbar', async ({ page }) => {
  await gotoApp(page)
  await page.click('text=Projeto')
  await fillFloatingPrompt(page, 'Residência Alto da Serra')
  await expect(page.locator('svg text', { hasText: 'Residência Alto da Serra' })).toBeVisible()
})
