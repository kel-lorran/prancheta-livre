import type { Page } from '@playwright/test'

export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/')
  await page.locator('.sheet-tab').first().waitFor({ state: 'visible' })
}

export async function fitToScreen(page: Page): Promise<void> {
  await page.click('button[title="Ajustar à tela"]')
  await page.waitForTimeout(150)
}

/** Bounding box (in viewport px) of the given sheet's paper rect — defaults to the first sheet. */
export async function sheetBox(page: Page, nth = 0) {
  const box = await page.locator('[data-testid="sheet-paper"]').nth(nth).boundingBox()
  if (!box) throw new Error('sheet-paper bounding box not found')
  return box
}

/** Click at a fractional position (0..1 in x/y) inside a sheet's box. */
export async function clickInSheet(page: Page, box: { x: number; y: number; width: number; height: number }, fx: number, fy: number) {
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
}

export async function fillFloatingPrompt(page: Page, text: string) {
  const input = page.locator('.floating-box input[type="text"]').first()
  await input.waitFor({ state: 'visible' })
  await input.fill(text)
  await page.click('.floating-box button.ok')
}

/** Fills the calibration prompt (real length in meters, default 1:100 scale) and confirms. */
export async function fillCalibratePrompt(page: Page, meters: number) {
  const input = page.locator('.floating-box input[type="number"]').first()
  await input.waitFor({ state: 'visible' })
  await input.fill(String(meters))
  await page.click('.floating-box button.ok')
}

