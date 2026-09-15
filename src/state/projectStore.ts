import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  Annotation,
  CalState,
  CotaState,
  Dimension,
  DimGeometryMode,
  DimToolMode,
  DraftState,
  DraftTool,
  LengthUnit,
  NewAnnotation,
  Orientation,
  Point,
  ProjectInfo,
  Selection,
  Sheet,
  SheetImage,
  SheetSizeKey,
  TitleBlockFields,
  ToolName,
  ViewState,
} from '../types'
import { resolveOrthoMode, perpendicularOffset } from '../lib/dimGeometry'
import { sheetDimensions } from '../lib/isoSizes'
import { generateSamplePlanDataURL, loadImageSize } from '../lib/samplePlan'

const IDLE_COTA: CotaState = { step: 0, sheetId: null, p1: null, p2: null, resolvedMode: null, previewOffset: null }
const IDLE_CAL: CalState = { step: 0, sheetId: null, p1: null, preview: null }
const IDLE_DRAFT: DraftState = { tool: null, sheetId: null, points: [], preview: null }
const HISTORY_LIMIT = 60

function defaultTitleBlock(): TitleBlockFields {
  return { sheetTitle: '', date: '', revision: '' }
}

interface ProjectState {
  sheets: Sheet[]
  project: ProjectInfo
  selection: Selection
  tool: ToolName
  dimMode: DimToolMode
  dimUnit: LengthUnit
  view: ViewState
  cota: CotaState
  cal: CalState
  draft: DraftState
  past: Sheet[][]
  future: Sheet[][]

  commitHistory: () => void
  undo: () => void
  redo: () => void

  addSheet: (size: SheetSizeKey, orientation: Orientation) => Sheet
  deleteSheet: (id: string) => void
  renameSheet: (id: string, name: string) => void
  setSheetPos: (id: string, x: number, y: number) => void
  setTitleBlockField: (sheetId: string, field: keyof TitleBlockFields, value: string) => void
  setProjectInfo: (info: ProjectInfo) => void

  setImage: (sheetId: string, image: SheetImage) => void
  setImageRect: (sheetId: string, rect: Partial<Pick<SheetImage, 'x' | 'y' | 'w' | 'h'>>) => void
  calibrateImage: (sheetId: string, anchor: Point, dpaper: number, meters: number, denom: number) => { overflow: boolean }
  toggleImageLock: (sheetId: string) => void
  deleteImage: (sheetId: string) => void

  select: (selection: Selection) => void
  deleteDim: (sheetId: string, dimId: string) => void
  overrideDimText: (sheetId: string, dimId: string, text: string | null) => void
  adjustDimOffset: (sheetId: string, dimId: string, offset: number) => void

  addAnnotation: (sheetId: string, ann: NewAnnotation) => void
  patchAnnotation: (sheetId: string, id: string, patch: Record<string, unknown>) => void
  deleteAnnotation: (sheetId: string, id: string) => void

  setTool: (tool: ToolName) => void
  setDimMode: (mode: DimToolMode) => void
  setDimUnit: (unit: LengthUnit) => void

  startCota: (sheetId: string, p1: Point) => void
  setCotaP2: (p2: Point) => void
  setCotaPreviewOffset: (pt: Point) => void
  commitCota: (pt: Point) => void
  cancelCota: () => void

  startCal: (sheetId: string, p1: Point) => void
  setCalPreview: (pt: Point) => void
  cancelCal: () => void

  startDraft: (tool: DraftTool, sheetId: string, p: Point) => void
  addDraftPoint: (p: Point) => void
  setDraftPreview: (p: Point) => void
  cancelDraft: () => void

  setView: (view: ViewState) => void

  loadProject: (sheets: Sheet[], project: ProjectInfo) => void
  seedSample: () => Promise<void>
}

function resolveDims(size: SheetSizeKey, orientation: Orientation) {
  return sheetDimensions(size, orientation)
}

function findSheetOf(sheets: Sheet[], annotationId: string): Sheet | undefined {
  return sheets.find((s) => s.annotations.some((a) => a.id === annotationId))
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  sheets: [],
  project: { name: '', client: '', author: '' },
  selection: { type: null, id: null },
  tool: 'select',
  dimMode: 'ortho',
  dimUnit: 'mm',
  view: { panX: 80, panY: 60, zoom: 2.6 },
  cota: IDLE_COTA,
  cal: IDLE_CAL,
  draft: IDLE_DRAFT,
  past: [],
  future: [],

  commitHistory() {
    set((state) => ({ past: [...state.past, state.sheets].slice(-HISTORY_LIMIT), future: [] }))
  },
  undo() {
    const { past, sheets, future } = get()
    if (!past.length) return
    const previous = past[past.length - 1]
    set({ sheets: previous, past: past.slice(0, -1), future: [sheets, ...future].slice(0, HISTORY_LIMIT), selection: { type: null, id: null } })
  },
  redo() {
    const { future, sheets, past } = get()
    if (!future.length) return
    const next = future[0]
    set({ sheets: next, future: future.slice(1), past: [...past, sheets].slice(-HISTORY_LIMIT), selection: { type: null, id: null } })
  },

  addSheet(size, orientation) {
    get().commitHistory()
    const { w, h } = resolveDims(size, orientation)
    const sheets = get().sheets
    let origin = { x: 0, y: 0 }
    if (sheets.length) {
      let maxX = -Infinity
      let minY = Infinity
      sheets.forEach((s) => {
        maxX = Math.max(maxX, s.x + s.w)
        minY = Math.min(minY, s.y)
      })
      origin = { x: maxX + 40, y: minY }
    }
    const sheet: Sheet = {
      id: uuidv4(),
      name: `Prancha ${sheets.length + 1}`,
      size,
      orientation,
      x: origin.x,
      y: origin.y,
      w,
      h,
      image: null,
      dims: [],
      annotations: [],
      titleBlock: defaultTitleBlock(),
    }
    set((state) => ({ sheets: [...state.sheets, sheet], selection: { type: 'sheet', id: sheet.id } }))
    return sheet
  },

  deleteSheet(id) {
    get().commitHistory()
    set((state) => ({
      sheets: state.sheets.filter((s) => s.id !== id),
      selection: state.selection.id === id ? { type: null, id: null } : state.selection,
    }))
  },

  renameSheet(id, name) {
    get().commitHistory()
    set((state) => ({ sheets: state.sheets.map((s) => (s.id === id ? { ...s, name } : s)) }))
  },

  setSheetPos(id, x, y) {
    set((state) => ({ sheets: state.sheets.map((s) => (s.id === id ? { ...s, x, y } : s)) }))
  },

  setTitleBlockField(sheetId, field, value) {
    get().commitHistory()
    set((state) => ({
      sheets: state.sheets.map((s) => (s.id === sheetId ? { ...s, titleBlock: { ...s.titleBlock, [field]: value } } : s)),
    }))
  },

  setProjectInfo(info) {
    get().commitHistory()
    set({ project: info })
  },

  setImage(sheetId, image) {
    get().commitHistory()
    set((state) => ({ sheets: state.sheets.map((s) => (s.id === sheetId ? { ...s, image, dims: [] } : s)) }))
  },

  setImageRect(sheetId, rect) {
    set((state) => ({
      sheets: state.sheets.map((s) => (s.id === sheetId && s.image ? { ...s, image: { ...s.image, ...rect } } : s)),
    }))
  },

  calibrateImage(sheetId, anchor, dpaper, meters, denom) {
    const sheet = get().sheets.find((s) => s.id === sheetId)
    if (!sheet || !sheet.image) return { overflow: false }
    get().commitHistory()
    const im = sheet.image
    const targetPaperMm = (meters * 1000) / denom
    const factor = targetPaperMm / dpaper
    const newW = im.w * factor
    const newH = im.h * factor
    const newImage: SheetImage = {
      ...im,
      x: anchor.x + (im.x - anchor.x) * factor,
      y: anchor.y + (im.y - anchor.y) * factor,
      w: newW,
      h: newH,
      realMetersPerMm: denom / 1000,
      locked: true,
    }
    set((state) => ({
      sheets: state.sheets.map((s) => (s.id === sheetId ? { ...s, image: newImage, dims: [] } : s)),
    }))
    return { overflow: newW > sheet.w * 1.02 || newH > sheet.h * 1.02 }
  },

  toggleImageLock(sheetId) {
    get().commitHistory()
    set((state) => ({
      sheets: state.sheets.map((s) => {
        if (s.id !== sheetId || !s.image) return s
        if (s.image.locked) {
          return { ...s, image: { ...s.image, locked: false, realMetersPerMm: null }, dims: [] }
        }
        return { ...s, image: { ...s.image, locked: true } }
      }),
    }))
  },

  deleteImage(sheetId) {
    get().commitHistory()
    set((state) => ({ sheets: state.sheets.map((s) => (s.id === sheetId ? { ...s, image: null, dims: [] } : s)) }))
  },

  select(selection) {
    set({ selection })
  },

  deleteDim(sheetId, dimId) {
    get().commitHistory()
    set((state) => ({
      sheets: state.sheets.map((s) => (s.id === sheetId ? { ...s, dims: s.dims.filter((d) => d.id !== dimId) } : s)),
      selection: state.selection.type === 'dim' && state.selection.id === dimId ? { type: null, id: null } : state.selection,
    }))
  },

  overrideDimText(sheetId, dimId, text) {
    get().commitHistory()
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId ? { ...s, dims: s.dims.map((d) => (d.id === dimId ? { ...d, text } : d)) } : s,
      ),
    }))
  },

  adjustDimOffset(sheetId, dimId, offset) {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId ? { ...s, dims: s.dims.map((d) => (d.id === dimId ? { ...d, offset } : d)) } : s,
      ),
    }))
  },

  addAnnotation(sheetId, ann) {
    get().commitHistory()
    const full = { ...ann, id: uuidv4() } as Annotation
    set((state) => ({
      sheets: state.sheets.map((s) => (s.id === sheetId ? { ...s, annotations: [...s.annotations, full] } : s)),
      selection: { type: 'annotation', id: full.id },
    }))
  },

  patchAnnotation(sheetId, id, patch) {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? { ...s, annotations: s.annotations.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)) }
          : s,
      ),
    }))
  },

  deleteAnnotation(sheetId, id) {
    get().commitHistory()
    set((state) => ({
      sheets: state.sheets.map((s) => (s.id === sheetId ? { ...s, annotations: s.annotations.filter((a) => a.id !== id) } : s)),
      selection: state.selection.type === 'annotation' && state.selection.id === id ? { type: null, id: null } : state.selection,
    }))
  },

  setTool(tool) {
    set({ tool, cota: IDLE_COTA, cal: IDLE_CAL, draft: IDLE_DRAFT })
  },

  setDimMode(mode) {
    set({ dimMode: mode, cota: IDLE_COTA })
  },

  setDimUnit(unit) {
    set({ dimUnit: unit })
  },

  startCota(sheetId, p1) {
    set({ cota: { step: 1, sheetId, p1, p2: null, resolvedMode: null, previewOffset: null } })
  },

  setCotaP2(p2) {
    const { cota, dimMode } = get()
    if (cota.step !== 1 || !cota.p1) return
    const resolvedMode: DimGeometryMode = dimMode === 'aligned' ? 'aligned' : resolveOrthoMode(cota.p1, p2)
    set({ cota: { ...cota, p2, resolvedMode, step: 2 } })
  },

  setCotaPreviewOffset(pt) {
    const { cota } = get()
    if (cota.step !== 2 || !cota.p1 || !cota.p2 || !cota.resolvedMode) return
    const offset = perpendicularOffset(cota.resolvedMode, cota.p1, cota.p2, pt) || 0.001
    set({ cota: { ...cota, previewOffset: offset } })
  },

  commitCota(pt) {
    const { cota, dimUnit } = get()
    if (cota.step !== 2 || !cota.sheetId || !cota.p1 || !cota.p2 || !cota.resolvedMode) return
    get().commitHistory()
    const offset = perpendicularOffset(cota.resolvedMode, cota.p1, cota.p2, pt) || 0.001
    const dim: Dimension = {
      id: uuidv4(),
      mode: cota.resolvedMode,
      p1: cota.p1,
      p2: cota.p2,
      offset,
      unit: dimUnit,
      text: null,
    }
    const sheetId = cota.sheetId
    set((state) => ({
      sheets: state.sheets.map((s) => (s.id === sheetId ? { ...s, dims: [...s.dims, dim] } : s)),
      cota: IDLE_COTA,
    }))
  },

  cancelCota() {
    set({ cota: IDLE_COTA })
  },

  startCal(sheetId, p1) {
    set({ cal: { step: 1, sheetId, p1, preview: null } })
  },

  setCalPreview(pt) {
    const { cal } = get()
    if (cal.step !== 1) return
    set({ cal: { ...cal, preview: pt } })
  },

  cancelCal() {
    set({ cal: IDLE_CAL })
  },

  startDraft(tool, sheetId, p) {
    set({ draft: { tool, sheetId, points: [p], preview: null } })
  },
  addDraftPoint(p) {
    set((state) => ({ draft: { ...state.draft, points: [...state.draft.points, p] } }))
  },
  setDraftPreview(p) {
    set((state) => ({ draft: { ...state.draft, preview: p } }))
  },
  cancelDraft() {
    set({ draft: IDLE_DRAFT })
  },

  setView(view) {
    set({ view })
  },

  loadProject(sheets, project) {
    set({ sheets, project, selection: { type: null, id: null }, past: [], future: [] })
  },

  async seedSample() {
    const dataUrl = generateSamplePlanDataURL()
    const { natW, natH } = await loadImageSize(dataUrl)
    const dispW = 180
    const dispH = (dispW * natH) / natW
    const sx = dispW / natW
    const sy = dispH / natH
    const imgX = 120
    const imgY = 80
    const P = (px: number, py: number): Point => ({ x: imgX + px * sx, y: imgY + py * sy })
    const tl = P(100, 150)
    const tr = P(1500, 150)
    const bl = P(100, 850)
    const pw = P(800, 850)

    const sheet: Sheet = {
      id: uuidv4(),
      name: 'Planta baixa · térreo (exemplo)',
      size: 'A3',
      orientation: 'paisagem',
      x: 0,
      y: 0,
      w: resolveDims('A3', 'paisagem').w,
      h: resolveDims('A3', 'paisagem').h,
      image: {
        href: dataUrl,
        natW,
        natH,
        x: imgX,
        y: imgY,
        w: dispW,
        h: dispH,
        locked: true,
        realMetersPerMm: 0.05,
      },
      dims: [
        { id: uuidv4(), mode: 'h', p1: tl, p2: tr, offset: -27, unit: 'm', text: null },
        { id: uuidv4(), mode: 'v', p1: tl, p2: bl, offset: -16, unit: 'm', text: null },
        { id: uuidv4(), mode: 'aligned', p1: tl, p2: pw, offset: -9, unit: 'm', text: null },
      ],
      annotations: [],
      titleBlock: { sheetTitle: 'Planta baixa · térreo', date: '', revision: '' },
    }
    set({ sheets: [sheet], project: { name: 'Projeto de exemplo', client: '', author: '' }, selection: { type: 'sheet', id: sheet.id }, past: [], future: [] })
  },
}))

export function annotationSheetOf(sheets: Sheet[], annotationId: string): Sheet | undefined {
  return findSheetOf(sheets, annotationId)
}
