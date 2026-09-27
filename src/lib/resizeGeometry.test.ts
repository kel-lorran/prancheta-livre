import { describe, expect, it } from 'vitest'
import { computeAnchoredResize, cornerAnchor } from './resizeGeometry'

describe('cornerAnchor', () => {
  it('returns the opposite corner for each handle', () => {
    const orig = { x: 10, y: 20, w: 100, h: 50 }
    expect(cornerAnchor('se', orig)).toEqual({ x: 10, y: 20 })
    expect(cornerAnchor('nw', orig)).toEqual({ x: 110, y: 70 })
    expect(cornerAnchor('ne', orig)).toEqual({ x: 10, y: 70 })
    expect(cornerAnchor('sw', orig)).toEqual({ x: 110, y: 20 })
  })
})

describe('computeAnchoredResize', () => {
  // Regressão: o cursor tem que já estar convertido pro mesmo espaço de coordenadas de `orig`
  // (mm locais à prancha pro grupo, mm locais ao grupo pra um membro) antes de chegar aqui — essa
  // função nunca deveria receber mm de mundo direto. O bug real (Canvas.tsx passando `toWorld()`
  // sem descontar a origem da prancha/grupo) não morava aqui dentro, e sim em quem chamava; esse
  // teste documenta o contrato que evita reintroduzir o mesmo erro.
  it('grows the image away from the anchor, keeping aspect ratio', () => {
    const orig = { x: 0, y: 0, w: 180, h: 120 } // aspect 1.5
    const grown = computeAnchoredResize(orig, 'se', { x: 360, y: 999 /* y é ignorado, w manda */ }, 5)
    expect(grown.x).toBe(0)
    expect(grown.y).toBe(0)
    expect(grown.w).toBe(360)
    expect(grown.h).toBeCloseTo(240) // 360 / 1.5
  })

  it('shrinks toward the anchor when the cursor moves closer to it', () => {
    const orig = { x: 0, y: 0, w: 180, h: 120 }
    const shrunk = computeAnchoredResize(orig, 'se', { x: 90, y: 0 }, 5)
    expect(shrunk.w).toBe(90)
    expect(shrunk.h).toBeCloseTo(60)
  })

  it('never shrinks below the minimum width (and derived minimum height)', () => {
    const orig = { x: 0, y: 0, w: 180, h: 120 }
    const tiny = computeAnchoredResize(orig, 'se', { x: 1, y: 0 }, 5)
    expect(tiny.w).toBe(5)
    expect(tiny.h).toBeCloseTo(5 / 1.5)
  })

  it('nw anchors at the opposite (se) corner, so growing moves x/y negative', () => {
    const orig = { x: 100, y: 80, w: 180, h: 120 } // se anchor = (280, 200)
    const grown = computeAnchoredResize(orig, 'nw', { x: 100, y: 0 }, 5)
    // cursor a 180mm do anchor (280-100) -> mesma largura de antes, mas ancorado do outro lado
    expect(grown.w).toBe(180)
    expect(grown.x).toBe(280 - 180)
    expect(grown.y).toBe(200 - 120)
  })

  it('ne and sw keep one axis pinned to the anchor and grow the other away from it', () => {
    const orig = { x: 0, y: 0, w: 180, h: 120 } // ne anchor = (0, 120)
    const ne = computeAnchoredResize(orig, 'ne', { x: 200, y: 0 }, 5)
    expect(ne.x).toBe(0) // ne fixa x no anchor
    expect(ne.y).toBe(120 - ne.h)

    const swOrig = { x: 0, y: 0, w: 180, h: 120 } // sw anchor = (180, 0)
    const sw = computeAnchoredResize(swOrig, 'sw', { x: -20, y: 0 }, 5)
    expect(sw.y).toBe(0) // sw fixa y no anchor
    expect(sw.x).toBe(180 - sw.w)
  })
})
