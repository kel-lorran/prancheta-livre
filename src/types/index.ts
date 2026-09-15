export type ToolName = 'select' | 'calibrate' | 'cota' | 'leader' | 'marker' | 'level' | 'callout'
export type DimToolMode = 'ortho' | 'aligned'
export type DimGeometryMode = 'h' | 'v' | 'aligned'
export type LengthUnit = 'm' | 'mm'
export type SheetSizeKey = 'A4' | 'A3' | 'A2' | 'A1' | 'A0'
export type Orientation = 'retrato' | 'paisagem'
export type DraftTool = 'leader' | 'level' | 'callout'

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

export interface LeaderAnnotation {
  id: string
  kind: 'leader'
  anchor: Point
  label: Point
  text: string
}
export interface MarkerAnnotation {
  id: string
  kind: 'marker'
  pos: Point
}
export interface LevelAnnotation {
  id: string
  kind: 'level'
  y: number
  x1: number
  x2: number
  text: string
}
export interface CalloutAnnotation {
  id: string
  kind: 'callout'
  rect: { x: number; y: number; w: number; h: number }
  targetPos: Point
  text: string
}
export type Annotation = LeaderAnnotation | MarkerAnnotation | LevelAnnotation | CalloutAnnotation
export type AnnotationKind = Annotation['kind']

/** Plain Omit collapses a union's keys to their intersection; this distributes over each member instead. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export type NewAnnotation = DistributiveOmit<Annotation, 'id'>

export interface TitleBlockFields {
  sheetTitle: string
  date: string
  revision: string
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
  annotations: Annotation[]
  titleBlock: TitleBlockFields
}

export interface ProjectInfo {
  name: string
  client: string
  author: string
}

export type Selection =
  | { type: 'sheet' | 'image' | 'dim' | 'annotation'; id: string }
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

export interface DraftState {
  tool: DraftTool | null
  sheetId: string | null
  points: Point[]
  preview: Point | null
}
