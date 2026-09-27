import type { Corner, Point } from '../types'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Canto oposto ao arrastado — o ponto que fica fixo durante o redimensionamento. */
export function cornerAnchor(corner: Corner, orig: Rect): Point {
  return corner === 'nw'
    ? { x: orig.x + orig.w, y: orig.y + orig.h }
    : corner === 'ne'
      ? { x: orig.x, y: orig.y + orig.h }
      : corner === 'sw'
        ? { x: orig.x + orig.w, y: orig.y }
        : { x: orig.x, y: orig.y }
}

/**
 * Redimensionamento com proporção travada, ancorado no canto oposto ao arrastado.
 * `cursorLocal` precisa estar no MESMO sistema de coordenadas que `orig` (mm locais à prancha
 * pro grupo, mm locais ao grupo pra um membro) — nunca em mm de mundo direto, senão o resultado
 * fica errado sempre que a prancha/grupo não estiver exatamente na origem (0,0).
 */
export function computeAnchoredResize(orig: Rect, corner: Corner, cursorLocal: Point, minWidth: number): Rect {
  const anchor = cornerAnchor(corner, orig)
  const aspect = orig.w / orig.h
  let neww = Math.abs(cursorLocal.x - anchor.x)
  let newh = neww / aspect
  neww = Math.max(neww, minWidth)
  newh = Math.max(newh, minWidth / aspect)
  const x = corner === 'ne' || corner === 'se' ? anchor.x : anchor.x - neww
  const y = corner === 'sw' || corner === 'se' ? anchor.y : anchor.y - newh
  return { x, y, w: neww, h: newh }
}
