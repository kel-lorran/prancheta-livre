import type { Orientation, SheetSizeKey } from '../types'

/** Dimensões ISO 216 em mm, sempre como [lado menor, lado maior]. */
export const ISO_SIZES: Record<SheetSizeKey, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
}

export const SHEET_SIZE_KEYS: SheetSizeKey[] = ['A4', 'A3', 'A2', 'A1', 'A0']

/** Escalas padrão de arquitetura (denominador de 1:N). */
export const STANDARD_SCALES = [20, 25, 50, 75, 100, 125, 150, 200, 250, 500, 1000]

export function sheetDimensions(size: SheetSizeKey, orientation: Orientation): { w: number; h: number } {
  const [short, long] = ISO_SIZES[size]
  return orientation === 'retrato' ? { w: short, h: long } : { w: long, h: short }
}
