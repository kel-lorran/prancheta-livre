import { describe, expect, it } from 'vitest'
import { fromGroupFrac, groupLocalBounds, offsetFromFrac, offsetToFrac, toGroupFrac } from './groupGeometry'
import type { ImageGroup } from '../types'

const group = { w: 200, h: 100 }

describe('toGroupFrac / fromGroupFrac', () => {
  it('round-trip a point through fraction and back', () => {
    const local = { x: 150, y: 40 }
    const frac = toGroupFrac(group, local)
    expect(frac).toEqual({ x: 0.75, y: 0.4 })
    expect(fromGroupFrac(group, frac)).toEqual(local)
  })

  it('does not divide by zero when the group has no size yet', () => {
    expect(toGroupFrac({ w: 0, h: 0 }, { x: 10, y: 10 })).toEqual({ x: 0, y: 0 })
  })

  // Isso é o mecanismo central por trás de "recalibrar não reseta cota": o mesmo par
  // (xf, yf) tem que apontar pro mesmo ponto visual do conteúdo depois que o frame do
  // grupo muda de tamanho, sem precisar reescrever nada guardado.
  it('the same fraction lands on the same relative content point after the group resizes', () => {
    const before = { w: 200, h: 100 }
    const after = { w: 400, h: 200 } // grupo dobrou de tamanho (ex.: recalibração)
    const frac = toGroupFrac(before, { x: 150, y: 40 }) // 75% / 40%
    expect(fromGroupFrac(after, frac)).toEqual({ x: 300, y: 80 }) // mesmos 75% / 40%, na nova escala
  })
})

describe('offsetToFrac / offsetFromFrac', () => {
  it('round-trip an offset through fraction and back', () => {
    const frac = offsetToFrac(group, -54)
    expect(frac).toBe(-0.27)
    expect(offsetFromFrac(group, frac)).toBeCloseTo(-54)
  })
})

describe('groupLocalBounds', () => {
  function makeGroup(images: ImageGroup['images']): Pick<ImageGroup, 'w' | 'h' | 'images'> {
    return { w: 180, h: 120, images }
  }

  it('equals the declared frame when every member fits inside it', () => {
    const g = makeGroup([{ id: 'a', href: '', natW: 1, natH: 1, x: 0, y: 0, w: 180, h: 120, locked: false, crop: null }])
    expect(groupLocalBounds(g)).toEqual({ minX: 0, minY: 0, maxX: 180, maxY: 120 })
  })

  // Regressão: um membro redimensionado/movido dentro do grupo pode passar do frame declarado.
  // Sem essa união, cliques na parte "sobrando" da imagem eram tratados como fora do grupo.
  it('expands to cover a member that was resized past the declared frame', () => {
    const g = makeGroup([{ id: 'a', href: '', natW: 1, natH: 1, x: -20, y: 0, w: 300, h: 200, locked: false, crop: null }])
    expect(groupLocalBounds(g)).toEqual({ minX: -20, minY: 0, maxX: 280, maxY: 200 })
  })

  it('unions the frame with every member when there are several', () => {
    const g = makeGroup([
      { id: 'a', href: '', natW: 1, natH: 1, x: 0, y: 0, w: 50, h: 50, locked: false, crop: null },
      { id: 'b', href: '', natW: 1, natH: 1, x: 160, y: -30, w: 60, h: 60, locked: false, crop: null },
    ])
    expect(groupLocalBounds(g)).toEqual({ minX: 0, minY: -30, maxX: 220, maxY: 120 })
  })
})
