import type { ImageGroup, Point } from '../types'

/** Converte um ponto local ao grupo (mm) em fração (0..1) do frame do grupo. */
export function toGroupFrac(group: Pick<ImageGroup, 'w' | 'h'>, local: Point): Point {
  return { x: group.w ? local.x / group.w : 0, y: group.h ? local.y / group.h : 0 }
}

/** Converte uma fração (0..1) do frame do grupo em ponto local ao grupo (mm). */
export function fromGroupFrac(group: Pick<ImageGroup, 'w' | 'h'>, frac: Point): Point {
  return { x: frac.x * group.w, y: frac.y * group.h }
}

/** offset de cota é guardado como fração de group.w (simplificação — só precisa escalar de forma
 *  razoável com o grupo, não precisa ser geometricamente exato como p1/p2). */
export function offsetToFrac(group: Pick<ImageGroup, 'w'>, offsetMm: number): number {
  return group.w ? offsetMm / group.w : 0
}
export function offsetFromFrac(group: Pick<ImageGroup, 'w'>, offsetFrac: number): number {
  return offsetFrac * group.w
}
