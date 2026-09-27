import type { Locator, Page } from '@playwright/test'

export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/')
  await page.locator('.sheet-tab').first().waitFor({ state: 'visible' })
  const tipsClose = page.locator('.tips-modal button.ok')
  if (await tipsClose.isVisible().catch(() => false)) await tipsClose.click()
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

/**
 * Drags a locator's own center by (dx, dy) screen pixels — move+down+move+up in one call, instead
 * of rewriting the same four lines in every test that needs to grab a handle or drag an element.
 */
export async function dragBy(page: Page, locator: Locator, dx: number, dy: number, steps = 5): Promise<void> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('dragBy: locator has no bounding box')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps })
  await page.mouse.up()
}

/** Same as dragBy, but drops the locator's center at an absolute (targetX, targetY) screen point. */
export async function dragTo(page: Page, locator: Locator, targetX: number, targetY: number, steps = 5): Promise<void> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('dragTo: locator has no bounding box')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(targetX, targetY, { steps })
  await page.mouse.up()
}

/**
 * What DOM element actually receives a click at this exact screen point right now — pointer-events
 * and paint order included. Answers "why didn't my click hit the thing I meant" directly, instead
 * of guessing from a screenshot or a boundingBox() that ignores what's stacked on top.
 */
export async function elementAtPoint(page: Page, x: number, y: number): Promise<{ tag: string; attrs: string[] } | null> {
  return page.evaluate(
    ([px, py]) => {
      const el = document.elementFromPoint(px, py)
      if (!el) return null
      return { tag: el.tagName, attrs: Array.from(el.attributes).map((a) => `${a.name}=${a.value}`) }
    },
    [x, y] as [number, number],
  )
}

/**
 * Reads live Zustand state from the running app (only available on `npm run dev` — main.tsx skips
 * this entirely in production builds). Use this instead of inferring app state from pixels
 * whenever what you actually need is "did the data change", not "does it look right on screen".
 */
export async function storeState<T = unknown>(page: Page): Promise<T> {
  return page.evaluate(() => {
    const store = (window as unknown as { __testStore?: { getState: () => unknown } }).__testStore
    if (!store) throw new Error('window.__testStore not found — is the app running in dev mode?')
    return store.getState()
  }) as Promise<T>
}

