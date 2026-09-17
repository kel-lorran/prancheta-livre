import { annotationsInGroupMm, dimsInGroupMm } from '../state/projectStore'
import type { Annotation, ImageGroup, Sheet } from '../types'

export interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}
export function boxContains(outer: Box, inner: Box): boolean {
  return inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY
}

export function groupWorldBox(sheet: Sheet, group: ImageGroup): Box {
  const x = sheet.x + group.x
  const y = sheet.y + group.y
  return { minX: x, minY: y, maxX: x + group.w, maxY: y + group.h }
}

function ptsBox(pts: { x: number; y: number }[], pad = 1): Box {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return { minX: Math.min(...xs) - pad, minY: Math.min(...ys) - pad, maxX: Math.max(...xs) + pad, maxY: Math.max(...ys) + pad }
}

export function dimWorldBoxes(sheet: Sheet, group: ImageGroup): { id: string; box: Box }[] {
  const ox = sheet.x + group.x
  const oy = sheet.y + group.y
  return dimsInGroupMm(group).map((d) => ({
    id: d.id,
    box: ptsBox([
      { x: ox + d.p1.x, y: oy + d.p1.y },
      { x: ox + d.p2.x, y: oy + d.p2.y },
    ]),
  }))
}

function annotationPoints(a: Annotation): { x: number; y: number }[] {
  switch (a.kind) {
    case 'marker':
      return [a.pos]
    case 'leader':
      return [a.anchor, a.label]
    case 'level':
      return [
        { x: a.x1, y: a.y },
        { x: a.x2, y: a.y },
      ]
    case 'callout':
      return [
        { x: a.rect.x, y: a.rect.y },
        { x: a.rect.x + a.rect.w, y: a.rect.y + a.rect.h },
        a.targetPos,
      ]
  }
}

export function annotationWorldBoxes(sheet: Sheet, group: ImageGroup): { id: string; box: Box }[] {
  const ox = sheet.x + group.x
  const oy = sheet.y + group.y
  return annotationsInGroupMm(group).map((a) => ({
    id: a.id,
    box: ptsBox(annotationPoints(a).map((p) => ({ x: ox + p.x, y: oy + p.y }))),
  }))
}
