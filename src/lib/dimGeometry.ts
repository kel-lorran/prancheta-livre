import type { Dimension, DimGeometryMode, Point } from '../types'

/**
 * Afastamentos conforme NBR 6492 (Representação de projetos de arquitetura):
 * linha de chamada para 2-3mm do ponto cotado, texto 1,5mm acima da linha,
 * altura do texto 3,0mm no desenho impresso (1 unidade de mundo = 1mm de papel).
 */
export const DIM_GAP = 2
export const DIM_OVERSHOOT = 1.5
export const DIM_TICK = 1.8
export const DIM_TEXT_HEIGHT = 3.0
export const DIM_TEXT_GAP = 1.5

export interface DimGeometry {
  lineA: Point
  lineB: Point
  extA: [number, number, number, number]
  extB: [number, number, number, number]
  tickA: [number, number, number, number]
  tickB: [number, number, number, number]
  mid: Point
  angle: number
  valueMm: number
  outx: number
  outy: number
}

/** Decide se dois pontos formam uma cota mais horizontal ou vertical (cota ortogonal automática). */
export function resolveOrthoMode(p1: Point, p2: Point): DimGeometryMode {
  return Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y) ? 'h' : 'v'
}

export function perpendicularOffset(mode: DimGeometryMode, p1: Point, p2: Point, pt: Point): number {
  if (mode === 'h') return pt.y - p1.y
  if (mode === 'v') return pt.x - p1.x
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 0.0001
  const nx = -dy / len
  const ny = dx / len
  return (pt.x - p1.x) * nx + (pt.y - p1.y) * ny
}

export function dimGeometry(d: { mode: DimGeometryMode; p1: Point; p2: Point; offset: number }): DimGeometry {
  const gap = DIM_GAP
  const overshoot = DIM_OVERSHOOT
  const tick = DIM_TICK
  let lineA: Point, lineB: Point
  let extA: [number, number, number, number]
  let extB: [number, number, number, number]
  let angle: number
  let valueMm: number

  if (d.mode === 'h') {
    valueMm = Math.abs(d.p2.x - d.p1.x)
    const y = d.p1.y + d.offset
    const x1 = Math.min(d.p1.x, d.p2.x)
    const x2 = Math.max(d.p1.x, d.p2.x)
    lineA = { x: x1, y }
    lineB = { x: x2, y }
    const s1 = Math.sign(y - d.p1.y) || 1
    const s2 = Math.sign(y - d.p2.y) || 1
    extA = [d.p1.x, d.p1.y + s1 * gap, d.p1.x, y + s1 * overshoot]
    extB = [d.p2.x, d.p2.y + s2 * gap, d.p2.x, y + s2 * overshoot]
    angle = 0
  } else if (d.mode === 'v') {
    valueMm = Math.abs(d.p2.y - d.p1.y)
    const x = d.p1.x + d.offset
    const y1 = Math.min(d.p1.y, d.p2.y)
    const y2 = Math.max(d.p1.y, d.p2.y)
    lineA = { x, y: y1 }
    lineB = { x, y: y2 }
    const s1 = Math.sign(x - d.p1.x) || 1
    const s2 = Math.sign(x - d.p2.x) || 1
    extA = [d.p1.x + s1 * gap, d.p1.y, x + s1 * overshoot, d.p1.y]
    extB = [d.p2.x + s2 * gap, d.p2.y, x + s2 * overshoot, d.p2.y]
    angle = -90
  } else {
    const dx = d.p2.x - d.p1.x
    const dy = d.p2.y - d.p1.y
    const len = Math.hypot(dx, dy) || 0.0001
    valueMm = len
    const ux = dx / len
    const uy = dy / len
    const nx = -uy
    const ny = ux
    const off = d.offset
    const s = Math.sign(off) || 1
    lineA = { x: d.p1.x + nx * off, y: d.p1.y + ny * off }
    lineB = { x: d.p2.x + nx * off, y: d.p2.y + ny * off }
    extA = [d.p1.x + nx * gap * s, d.p1.y + ny * gap * s, d.p1.x + nx * (off + overshoot * s), d.p1.y + ny * (off + overshoot * s)]
    extB = [d.p2.x + nx * gap * s, d.p2.y + ny * gap * s, d.p2.x + nx * (off + overshoot * s), d.p2.y + ny * (off + overshoot * s)]
    angle = (Math.atan2(dy, dx) * 180) / Math.PI
    if (angle > 90 || angle < -90) angle += 180
  }

  const mid = { x: (lineA.x + lineB.x) / 2, y: (lineA.y + lineB.y) / 2 }
  const dirx = lineB.x - lineA.x
  const diry = lineB.y - lineA.y
  const dlen = Math.hypot(dirx, diry) || 0.0001
  const ux2 = dirx / dlen
  const uy2 = diry / dlen
  const tnx = -uy2 * tick
  const tny = ux2 * tick
  const tickA: [number, number, number, number] = [
    lineA.x - ux2 * tick * 0.5 - tnx * 0.5,
    lineA.y - uy2 * tick * 0.5 - tny * 0.5,
    lineA.x + ux2 * tick * 0.5 + tnx * 0.5,
    lineA.y + uy2 * tick * 0.5 + tny * 0.5,
  ]
  const tickB: [number, number, number, number] = [
    lineB.x - ux2 * tick * 0.5 - tnx * 0.5,
    lineB.y - uy2 * tick * 0.5 - tny * 0.5,
    lineB.x + ux2 * tick * 0.5 + tnx * 0.5,
    lineB.y + uy2 * tick * 0.5 + tny * 0.5,
  ]

  // Posição do texto: regra absoluta da NBR 6492 — sempre acima da linha (horizontal)
  // ou sempre à esquerda dela (vertical), nunca relativa ao lado do objeto.
  let outx: number, outy: number
  if (d.mode === 'h') {
    outx = 0
    outy = -1
  } else if (d.mode === 'v') {
    outx = -1
    outy = 0
  } else {
    let nx = -diry / dlen
    let ny = dirx / dlen
    if (ny > 1e-6 || (Math.abs(ny) <= 1e-6 && nx > 0)) {
      nx = -nx
      ny = -ny
    }
    outx = nx
    outy = ny
  }

  return { lineA, lineB, extA, extB, tickA, tickB, mid, angle, valueMm, outx, outy }
}

export function formatDimText(d: Dimension, realMetersPerMm: number | null): string {
  if (d.text != null) return d.text
  const real = dimGeometry(d).valueMm * (realMetersPerMm ?? 0)
  if (d.unit === 'm') return real.toFixed(2).replace('.', ',')
  return Math.round(real * 1000) + 'mm'
}
