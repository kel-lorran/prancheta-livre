import type { ImageGroup, Point, Sheet, ViewState } from '../types'

export function screenToWorld(view: ViewState, rect: DOMRect, clientX: number, clientY: number): Point {
  return {
    x: (clientX - rect.left - view.panX) / view.zoom,
    y: (clientY - rect.top - view.panY) / view.zoom,
  }
}

export function sheetAtWorldPoint(sheets: Sheet[], pt: Point): Sheet | null {
  for (let i = sheets.length - 1; i >= 0; i--) {
    const s = sheets[i]
    if (pt.x >= s.x && pt.x <= s.x + s.w && pt.y >= s.y && pt.y <= s.y + s.h) return s
  }
  return null
}

/** Grupos cujo frame contém o ponto (sheet-local mm), do topo pro fundo — pra clique normal (primeiro) e Alt+clique (ciclar). */
export function groupsAtSheetLocalPoint(sheet: Sheet, pt: Point): ImageGroup[] {
  const hit: ImageGroup[] = []
  for (let i = sheet.groups.length - 1; i >= 0; i--) {
    const g = sheet.groups[i]
    if (pt.x >= g.x && pt.x <= g.x + g.w && pt.y >= g.y && pt.y <= g.y + g.h) hit.push(g)
  }
  return hit
}

export function fitToContentView(sheets: Sheet[], rect: DOMRect): ViewState {
  if (!sheets.length) return { panX: 80, panY: 60, zoom: 2.6 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  sheets.forEach((s) => {
    minX = Math.min(minX, s.x)
    minY = Math.min(minY, s.y)
    maxX = Math.max(maxX, s.x + s.w)
    maxY = Math.max(maxY, s.y + s.h)
  })
  const margin = 50
  const zoom = Math.max(
    0.1,
    Math.min(6, Math.min((rect.width - margin * 2) / (maxX - minX), (rect.height - margin * 2) / (maxY - minY))),
  )
  return {
    zoom,
    panX: margin + ((rect.width - margin * 2) - (maxX - minX) * zoom) / 2 - minX * zoom,
    panY: margin + ((rect.height - margin * 2) - (maxY - minY) * zoom) / 2 - minY * zoom,
  }
}

export function focusOnSheetView(sheet: Sheet, rect: DOMRect): ViewState {
  const margin = 60
  const availW = rect.width - margin * 2
  const availH = rect.height - margin * 2
  const zoom = Math.max(0.15, Math.min(8, Math.min(availW / sheet.w, availH / sheet.h)))
  return {
    zoom,
    panX: margin + (availW - sheet.w * zoom) / 2 - sheet.x * zoom,
    panY: margin + (availH - sheet.h * zoom) / 2 - sheet.y * zoom,
  }
}
