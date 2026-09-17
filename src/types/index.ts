export type ToolName = 'select' | 'calibrate' | 'fitScale' | 'cota' | 'leader' | 'marker' | 'level'
export type DimToolMode = 'ortho' | 'aligned'
export type DimGeometryMode = 'h' | 'v' | 'aligned'
export type LengthUnit = 'm' | 'mm'
export type SheetSizeKey = 'A4' | 'A3' | 'A2' | 'A1' | 'A0'
export type Orientation = 'retrato' | 'paisagem'
export type DraftTool = 'leader' | 'level'

export interface Point {
  x: number
  y: number
}

/** Uma imagem individual dentro de um grupo. Posição é local ao frame do grupo (mm). */
export interface SheetImage {
  id: string
  href: string
  natW: number
  natH: number
  x: number
  y: number
  w: number
  h: number
  locked: boolean
  /** Polígono de recorte, em frações (0..1) do próprio bounding box da imagem — sobrevive a mover/redimensionar o grupo. */
  crop: Point[] | null
}

/**
 * Grupo de imagens — nunca existe imagem sem grupo; uma imagem solta é só um grupo de 1 membro.
 * Dono da calibração, cotas e anotações: essas descrevem a cena composta, não uma imagem isolada.
 */
export interface ImageGroup {
  id: string
  x: number
  y: number
  w: number
  h: number
  locked: boolean
  realMetersPerMm: number | null
  images: SheetImage[]
  dims: Dimension[]
  annotations: Annotation[]
}

/** p1/p2 e offset são frações (0..1) do frame do grupo — não mm absolutos da prancha. */
export interface Dimension {
  id: string
  mode: DimGeometryMode
  p1: Point
  p2: Point
  offset: number
  unit: LengthUnit
  text: string | null
}

/** Pontos das anotações abaixo também são frações (0..1) do frame do grupo. */
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
/** Mantida só para ler projetos antigos — a ferramenta está desativada (ver Toolbar). */
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
  groups: ImageGroup[]
  titleBlock: TitleBlockFields
}

export interface ProjectInfo {
  name: string
  client: string
  author: string
}

export type Selection =
  | { type: 'sheet' | 'group' | 'member' | 'dim' | 'annotation'; id: string }
  | { type: null; id: null }

export interface ViewState {
  panX: number
  panY: number
  zoom: number
}

export interface CotaState {
  step: 0 | 1 | 2
  sheetId: string | null
  groupId: string | null
  /** Coordenadas locais ao grupo (mm), não frações — convertidas em fração só ao gravar. */
  p1: Point | null
  p2: Point | null
  resolvedMode: DimGeometryMode | null
  previewOffset: number | null
}

/** Serve tanto pra "Calibrar" (define a escala de um grupo novo) quanto "Ajustar à escala do
 *  grupo" (redimensiona só um membro pra bater com a escala que o grupo já tem) — `mode` distingue. */
export interface CalState {
  step: 0 | 1
  mode: 'group' | 'member'
  sheetId: string | null
  groupId: string | null
  imageId: string | null
  p1: Point | null
  preview: Point | null
}

export interface DraftState {
  tool: DraftTool | null
  sheetId: string | null
  groupId: string | null
  points: Point[]
  preview: Point | null
}

/** Recorte poligonal em edição — pontos em fração (0..1) do bounding box da própria imagem. */
export interface CropState {
  sheetId: string
  groupId: string
  imageId: string
  points: Point[]
  preview: Point | null
}

/** Área de transferência: sempre um grupo — copiar um único membro sintetiza um grupo-de-1. */
export interface ClipboardEntry {
  group: ImageGroup
}
