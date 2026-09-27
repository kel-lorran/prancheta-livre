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

/**
 * Bounds locais ao grupo (relativos à origem do grupo) que cobrem tanto o frame declarado
 * (0,0,w,h) quanto a posição real de cada imagem-membro. Um membro pode ser movido/redimensionado
 * independente do frame (dentro do contexto do grupo) e passar a se estender além dele — sem isso,
 * clique/seleção/marquee usando só `group.w/h` erram o alvo em qualquer área da imagem que "sobra"
 * do frame original. Não muda o frame armazenado nem a matemática de fração de cota/anotação —
 * é só a área usada pra decidir "isso pertence a este grupo" em testes de acerto.
 */
export function groupLocalBounds(group: Pick<ImageGroup, 'w' | 'h' | 'images'>): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = 0
  let minY = 0
  let maxX = group.w
  let maxY = group.h
  for (const im of group.images) {
    minX = Math.min(minX, im.x)
    minY = Math.min(minY, im.y)
    maxX = Math.max(maxX, im.x + im.w)
    maxY = Math.max(maxY, im.y + im.h)
  }
  return { minX, minY, maxX, maxY }
}
