export type ToolName = 'select' | 'calibrate' | 'cota'
export type DimToolMode = 'ortho' | 'aligned'
export type DimGeometryMode = 'h' | 'v' | 'aligned'
export type LengthUnit = 'm' | 'mm'
export type SheetSizeKey = 'A4' | 'A3' | 'A2' | 'A1' | 'A0'
export type Orientation = 'retrato' | 'paisagem'

export interface Point {
  x: number
  y: number
}

export interface SheetImage {
  href: string
  natW: number
  natH: number
  x: number
  y: number
  w: number
  h: number
  locked: boolean
  realMetersPerMm: number | null
}

export interface Dimension {
  id: string
  mode: DimGeometryMode
  p1: Point
  p2: Point
  offset: number
  unit: LengthUnit
  text: string | null
}

export interface Sheet {
  id: string
  name: string
  size: SheetSizeKey
  orientation: Orientation
  x: number
  y: number
  w: number
  h: number
  image: SheetImage | null
  dims: Dimension[]
}

export type Selection =
  | { type: 'sheet' | 'image' | 'dim'; id: string }
  | { type: null; id: null }

export interface ViewState {
  panX: number
  panY: number
  zoom: number
}

export interface CotaState {
  step: 0 | 1 | 2
  sheetId: string | null
  p1: Point | null
  p2: Point | null
  resolvedMode: DimGeometryMode | null
  previewOffset: number | null
}

export interface CalState {
  step: 0 | 1
  sheetId: string | null
  p1: Point | null
  preview: Point | null
}
