import { test, expect } from '@playwright/test'
import { gotoApp } from './helpers'

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept())
})

test('seeds a calibrated sample sheet on first load', async ({ page }) => {
  await gotoApp(page)
  await expect(page.locator('.sheet-tab')).toHaveCount(1)
  await expect(page.locator('.sheet-tab .badge')).toContainText('1:50')
  await expect(page.locator('g[data-dim]')).toHaveCount(3)
})

test('adds, renames and deletes a sheet', async ({ page }) => {
  await gotoApp(page)
  await page.click('text=+ Prancha')
  await expect(page.locator('.sheet-tab')).toHaveCount(2)

  const newTab = page.locator('.sheet-tab').nth(1)
  await newTab.locator('.name').click()
  const input = newTab.locator('.rename-input')
  await input.fill('Fachada principal')
  await input.press('Enter')
  await expect(newTab.locator('.name')).toHaveText('Fachada principal')

  await newTab.locator('button.mini').click()
  await expect(page.locator('.sheet-tab')).toHaveCount(1)
})

test('undo/redo restores an added sheet', async ({ page }) => {
  await gotoApp(page)
  await expect(page.locator('.sheet-tab')).toHaveCount(1)

  await page.click('text=+ Prancha')
  await expect(page.locator('.sheet-tab')).toHaveCount(2)

  await page.click('button[title="Desfazer (Ctrl+Z)"]')
  await expect(page.locator('.sheet-tab')).toHaveCount(1)

  await page.click('button[title="Refazer (Ctrl+Shift+Z)"]')
  await expect(page.locator('.sheet-tab')).toHaveCount(2)
})
