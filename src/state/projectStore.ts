import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  Annotation,
  CalState,
  ClipboardEntry,
  CotaState,
  CropState,
  Dimension,
  DimGeometryMode,
  DimToolMode,
  DraftState,
  DraftTool,
  ImageGroup,
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
import { offsetFromFrac, offsetToFrac, toGroupFrac, fromGroupFrac } from '../lib/groupGeometry'
import { sheetDimensions } from '../lib/isoSizes'
import { generateSamplePlanDataURL, loadImageSize } from '../lib/samplePlan'

const IDLE_COTA: CotaState = { step: 0, sheetId: null, groupId: null, p1: null, p2: null, resolvedMode: null, previewOffset: null }
const IDLE_CAL: CalState = { step: 0, mode: 'group', sheetId: null, groupId: null, imageId: null, p1: null, preview: null }
const IDLE_DRAFT: DraftState = { tool: null, sheetId: null, groupId: null, points: [], preview: null }
const HISTORY_LIMIT = 60

function defaultTitleBlock(): TitleBlockFields {
  return { sheetTitle: '', date: '', revision: '' }
}

export interface SelectionItem {
  type: 'sheet' | 'group' | 'member' | 'dim' | 'annotation'
  id: string
}

interface ProjectState {
  sheets: Sheet[]
  project: ProjectInfo
  selection: Selection
  multiSelection: SelectionItem[]
  openGroupId: string | null
  clipboard: ClipboardEntry | null
  tool: ToolName
  dimMode: DimToolMode
  dimUnit: LengthUnit
  view: ViewState
  cota: CotaState
  cal: CalState
  draft: DraftState
  crop: CropState | null
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

  importImage: (sheetId: string, groupId: string | null, img: { href: string; natW: number; natH: number; x: number; y: number; w: number; h: number }) => string
  setGroupRect: (groupId: string, rect: Partial<Pick<ImageGroup, 'x' | 'y' | 'w' | 'h'>>) => void
  setMemberRect: (groupId: string, imageId: string, rect: Partial<Pick<SheetImage, 'x' | 'y' | 'w' | 'h'>>) => void
  toggleGroupLock: (groupId: string) => void
  toggleMemberLock: (groupId: string, imageId: string) => void
  calibrateGroup: (sheetId: string, groupId: string, anchor: Point, dpaper: number, meters: number, denom: number) => { overflow: boolean }
  fitMemberToGroupScale: (sheetId: string, groupId: string, imageId: string, anchor: Point, dpaper: number, meters: number) => { ok: boolean }
  reorderMember: (groupId: string, imageId: string, dir: 'front' | 'back') => void
  deleteMember: (groupId: string, imageId: string) => void
  deleteGroup: (groupId: string) => void
  groupSelection: (groupIds: string[]) => void
  ungroupSelection: (groupId: string) => void
  enterGroup: (groupId: string) => void
  exitGroup: () => void

  startCrop: (sheetId: string, groupId: string, imageId: string, initial?: Point[]) => void
  addCropPoint: (p: Point) => void
  setCropPoint: (index: number, p: Point) => void
  insertCropPointAt: (index: number, p: Point) => void
  setCropPreview: (p: Point) => void
  removeCropPoint: (index: number) => void
  commitCrop: () => void
  cancelCrop: () => void
  clearCrop: (groupId: string, imageId: string) => void

  copySelection: () => void
  cutSelection: () => void
  pasteClipboard: (targetSheetId: string, inPlace: boolean, pastePoint?: Point) => void

  select: (selection: Selection) => void
  setMultiSelection: (items: SelectionItem[]) => void
  toggleMultiSelection: (item: SelectionItem) => void
  deleteDim: (dimId: string) => void
  overrideDimText: (dimId: string, text: string | null) => void
  adjustDimOffset: (dimId: string, offsetMm: number) => void

  addAnnotation: (groupId: string, ann: NewAnnotation) => void
  patchAnnotation: (id: string, patch: Record<string, unknown>) => void
  deleteAnnotation: (id: string) => void
  deleteMultiSelection: () => void

  setTool: (tool: ToolName) => void
  setDimMode: (mode: DimToolMode) => void
  setDimUnit: (unit: LengthUnit) => void

  startCota: (sheetId: string, groupId: string, p1: Point) => void
  setCotaP2: (p2: Point) => void
  setCotaPreviewOffset: (pt: Point) => void
  commitCota: (pt: Point) => void
  cancelCota: () => void

  startCal: (mode: 'group' | 'member', sheetId: string, groupId: string, imageId: string | null, p1: Point) => void
  primeFitScale: (sheetId: string, groupId: string, imageId: string) => void
  setCalPreview: (pt: Point) => void
  cancelCal: () => void

  startDraft: (tool: DraftTool, sheetId: string, groupId: string, p: Point) => void
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

function findGroup(sheets: Sheet[], groupId: string): { sheet: Sheet; group: ImageGroup } | undefined {
  for (const sheet of sheets) {
    const group = sheet.groups.find((g) => g.id === groupId)
    if (group) return { sheet, group }
  }
  return undefined
}
function findGroupOfDim(sheets: Sheet[], dimId: string): { sheet: Sheet; group: ImageGroup } | undefined {
  for (const sheet of sheets) {
    for (const group of sheet.groups) {
      if (group.dims.some((d) => d.id === dimId)) return { sheet, group }
    }
  }
  return undefined
}
function findGroupOfAnnotation(sheets: Sheet[], annId: string): { sheet: Sheet; group: ImageGroup } | undefined {
  for (const sheet of sheets) {
    for (const group of sheet.groups) {
      if (group.annotations.some((a) => a.id === annId)) return { sheet, group }
    }
  }
  return undefined
}
function findMember(sheets: Sheet[], imageId: string): { sheet: Sheet; group: ImageGroup; image: SheetImage } | undefined {
  for (const sheet of sheets) {
    for (const group of sheet.groups) {
      const image = group.images.find((im) => im.id === imageId)
      if (image) return { sheet, group, image }
    }
  }
  return undefined
}

function mapGroupInSheets(sheets: Sheet[], groupId: string, fn: (g: ImageGroup) => ImageGroup): Sheet[] {
  return sheets.map((s) => (s.groups.some((g) => g.id === groupId) ? { ...s, groups: s.groups.map((g) => (g.id === groupId ? fn(g) : g)) } : s))
}

/** Reposiciona/redimensiona um grupo (e escala seus membros junto), ancorado num ponto sheet-local. */
function resizeGroupAnchored(group: ImageGroup, anchor: Point, factor: number): ImageGroup {
  return {
    ...group,
    x: anchor.x + (group.x - anchor.x) * factor,
    y: anchor.y + (group.y - anchor.y) * factor,
    w: group.w * factor,
    h: group.h * factor,
    images: group.images.map((im) => ({ ...im, x: im.x * factor, y: im.y * factor, w: im.w * factor, h: im.h * factor })),
  }
}

function annotationPatchToFrac(group: Pick<ImageGroup, 'w' | 'h'>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch }
  for (const key of ['pos', 'anchor', 'label', 'targetPos'] as const) {
    const v = patch[key] as Point | undefined
    if (v) out[key] = toGroupFrac(group, v)
  }
  if (patch.rect) {
    const r = patch.rect as { x: number; y: number; w: number; h: number }
    const tl = toGroupFrac(group, { x: r.x, y: r.y })
    out.rect = { x: tl.x, y: tl.y, w: group.w ? r.w / group.w : 0, h: group.h ? r.h / group.h : 0 }
  }
  if (typeof patch.y === 'number') out.y = group.h ? (patch.y as number) / group.h : 0
  if (typeof patch.x1 === 'number') out.x1 = group.w ? (patch.x1 as number) / group.w : 0
  if (typeof patch.x2 === 'number') out.x2 = group.w ? (patch.x2 as number) / group.w : 0
  return out
}

function annotationFromFrac(group: Pick<ImageGroup, 'w' | 'h'>, ann: Annotation): Annotation {
  switch (ann.kind) {
    case 'marker':
      return { ...ann, pos: fromGroupFrac(group, ann.pos) }
    case 'leader':
      return { ...ann, anchor: fromGroupFrac(group, ann.anchor), label: fromGroupFrac(group, ann.label) }
    case 'level':
      return { ...ann, y: ann.y * group.h, x1: ann.x1 * group.w, x2: ann.x2 * group.w }
    case 'callout': {
      const tl = fromGroupFrac(group, { x: ann.rect.x, y: ann.rect.y })
      return { ...ann, rect: { x: tl.x, y: tl.y, w: ann.rect.w * group.w, h: ann.rect.h * group.h }, targetPos: fromGroupFrac(group, ann.targetPos) }
    }
  }
}

/** Anotação nova (pontos em mm local ao grupo, vindos do Canvas) convertida pra fração antes de gravar. */
function newAnnotationToFrac(group: Pick<ImageGroup, 'w' | 'h'>, ann: NewAnnotation): NewAnnotation {
  switch (ann.kind) {
    case 'marker':
      return { ...ann, pos: toGroupFrac(group, ann.pos) }
    case 'leader':
      return { ...ann, anchor: toGroupFrac(group, ann.anchor), label: toGroupFrac(group, ann.label) }
    case 'level':
      return { ...ann, y: group.h ? ann.y / group.h : 0, x1: group.w ? ann.x1 / group.w : 0, x2: group.w ? ann.x2 / group.w : 0 }
    case 'callout': {
      const tl = toGroupFrac(group, { x: ann.rect.x, y: ann.rect.y })
      return { ...ann, rect: { x: tl.x, y: tl.y, w: group.w ? ann.rect.w / group.w : 0, h: group.h ? ann.rect.h / group.h : 0 }, targetPos: toGroupFrac(group, ann.targetPos) }
    }
  }
}

export function groupOfMember(sheets: Sheet[], imageId: string) {
  return findMember(sheets, imageId)
}
export function dimsInGroupMm(group: ImageGroup): Dimension[] {
  return group.dims.map((d) => ({ ...d, p1: fromGroupFrac(group, d.p1), p2: fromGroupFrac(group, d.p2), offset: offsetFromFrac(group, d.offset) }))
}
export function annotationsInGroupMm(group: ImageGroup): Annotation[] {
  return group.annotations.map((a) => annotationFromFrac(group, a))
}

let clipboardIdBump = 0
function cloneGroupWithNewIds(group: ImageGroup): ImageGroup {
  clipboardIdBump++
  return {
    ...group,
    id: uuidv4(),
    images: group.images.map((im) => ({ ...im, id: uuidv4() })),
    dims: group.dims.map((d) => ({ ...d, id: uuidv4() })),
    annotations: group.annotations.map((a) => ({ ...a, id: uuidv4() + '-' + clipboardIdBump })),
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  sheets: [],
  project: { name: '', client: '', author: '' },
  selection: { type: null, id: null },
  multiSelection: [],
  openGroupId: null,
  clipboard: null,
  tool: 'select',
  dimMode: 'ortho',
  dimUnit: 'mm',
  view: { panX: 80, panY: 60, zoom: 2.6 },
  cota: IDLE_COTA,
  cal: IDLE_CAL,
  draft: IDLE_DRAFT,
  crop: null,
  past: [],
  future: [],

  commitHistory() {
    set((state) => ({ past: [...state.past, state.sheets].slice(-HISTORY_LIMIT), future: [] }))
  },
  undo() {
    const { past, sheets, future } = get()
    if (!past.length) return
    const previous = past[past.length - 1]
    set({ sheets: previous, past: past.slice(0, -1), future: [sheets, ...future].slice(0, HISTORY_LIMIT), selection: { type: null, id: null }, multiSelection: [] })
  },
  redo() {
    const { future, sheets, past } = get()
    if (!future.length) return
    const next = future[0]
    set({ sheets: next, future: future.slice(1), past: [...past, sheets].slice(-HISTORY_LIMIT), selection: { type: null, id: null }, multiSelection: [] })
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
      groups: [],
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
      openGroupId: state.sheets.find((s) => s.id === id)?.groups.some((g) => g.id === state.openGroupId) ? null : state.openGroupId,
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

  importImage(sheetId, groupId, img) {
    get().commitHistory()
    const newImage: SheetImage = { id: uuidv4(), href: img.href, natW: img.natW, natH: img.natH, x: img.x, y: img.y, w: img.w, h: img.h, locked: false, crop: null }
    if (groupId) {
      set((state) => ({ sheets: mapGroupInSheets(state.sheets, groupId, (g) => ({ ...g, images: [...g.images, newImage] })) }))
      set({ selection: { type: 'member', id: newImage.id } })
      return groupId
    }
    const newGroup: ImageGroup = { id: uuidv4(), x: img.x, y: img.y, w: img.w, h: img.h, locked: false, realMetersPerMm: null, images: [newImage], dims: [], annotations: [] }
    set((state) => ({ sheets: state.sheets.map((s) => (s.id === sheetId ? { ...s, groups: [...s.groups, newGroup] } : s)) }))
    set({ selection: { type: 'group', id: newGroup.id } })
    return newGroup.id
  },

  setGroupRect(groupId, rect) {
    set((state) => ({ sheets: mapGroupInSheets(state.sheets, groupId, (g) => ({ ...g, ...rect })) }))
  },
  setMemberRect(groupId, imageId, rect) {
    set((state) => ({
      sheets: mapGroupInSheets(state.sheets, groupId, (g) => ({ ...g, images: g.images.map((im) => (im.id === imageId ? { ...im, ...rect } : im)) })),
    }))
  },

  toggleGroupLock(groupId) {
    get().commitHistory()
    set((state) => ({
      sheets: mapGroupInSheets(state.sheets, groupId, (g) => (g.locked ? { ...g, locked: false, realMetersPerMm: null } : { ...g, locked: true })),
    }))
  },
  toggleMemberLock(groupId, imageId) {
    get().commitHistory()
    set((state) => ({
      sheets: mapGroupInSheets(state.sheets, groupId, (g) => ({ ...g, images: g.images.map((im) => (im.id === imageId ? { ...im, locked: !im.locked } : im)) })),
    }))
  },

  calibrateGroup(_sheetId, groupId, anchor, dpaper, meters, denom) {
    const found = findGroup(get().sheets, groupId)
    if (!found) return { overflow: false }
    get().commitHistory()
    const targetPaperMm = (meters * 1000) / denom
    const factor = targetPaperMm / dpaper
    const resized = resizeGroupAnchored(found.group, anchor, factor)
    const newGroup: ImageGroup = { ...resized, realMetersPerMm: denom / 1000, locked: true }
    set((state) => ({ sheets: mapGroupInSheets(state.sheets, groupId, () => newGroup) }))
    const sheet = found.sheet
    return { overflow: newGroup.w > sheet.w * 1.02 || newGroup.h > sheet.h * 1.02 }
  },

  fitMemberToGroupScale(_sheetId, groupId, imageId, anchor, dpaper, meters) {
    const found = findGroup(get().sheets, groupId)
    if (!found || !found.group.realMetersPerMm) return { ok: false }
    get().commitHistory()
    const targetPaperMm = meters / found.group.realMetersPerMm
    const factor = targetPaperMm / dpaper
    set((state) => ({
      sheets: mapGroupInSheets(state.sheets, groupId, (g) => ({
        ...g,
        images: g.images.map((im) => {
          if (im.id !== imageId) return im
          return {
            ...im,
            x: anchor.x + (im.x - anchor.x) * factor,
            y: anchor.y + (im.y - anchor.y) * factor,
            w: im.w * factor,
            h: im.h * factor,
          }
        }),
      })),
    }))
    return { ok: true }
  },

  reorderMember(groupId, imageId, dir) {
    get().commitHistory()
    set((state) => ({
      sheets: mapGroupInSheets(state.sheets, groupId, (g) => {
        const idx = g.images.findIndex((im) => im.id === imageId)
        if (idx < 0) return g
        const images = [...g.images]
        const [im] = images.splice(idx, 1)
        if (dir === 'front') images.push(im)
        else images.unshift(im)
        return { ...g, images }
      }),
    }))
  },

  deleteMember(groupId, imageId) {
    const found = findGroup(get().sheets, groupId)
    if (!found) return
    if (found.group.images.length <= 1) {
      get().deleteGroup(groupId)
      return
    }
    get().commitHistory()
    set((state) => ({
      sheets: mapGroupInSheets(state.sheets, groupId, (g) => ({ ...g, images: g.images.filter((im) => im.id !== imageId) })),
      selection: state.selection.type === 'member' && state.selection.id === imageId ? { type: 'group', id: groupId } : state.selection,
    }))
  },

  deleteGroup(groupId) {
    get().commitHistory()
    set((state) => ({
      sheets: state.sheets.map((s) => ({ ...s, groups: s.groups.filter((g) => g.id !== groupId) })),
      selection: state.selection.id === groupId || (state.selection.type === 'member' && findMember(state.sheets, state.selection.id)?.group.id === groupId) ? { type: null, id: null } : state.selection,
      openGroupId: state.openGroupId === groupId ? null : state.openGroupId,
    }))
  },

  groupSelection(groupIds) {
    if (groupIds.length < 2) return
    const sheets = get().sheets
    const found = groupIds.map((id) => findGroup(sheets, id)).filter((f): f is { sheet: Sheet; group: ImageGroup } => !!f)
    if (found.length < 2 || found.some((f) => f.sheet.id !== found[0].sheet.id)) return
    get().commitHistory()
    const primary = found[0].group
    const merged: ImageGroup = { ...primary, images: [...primary.images], dims: [...primary.dims], annotations: [...primary.annotations] }
    for (const f of found.slice(1)) {
      const g = f.group
      // Preserva o tamanho real de cada membro: se as duas partes já tinham calibração própria,
      // recalcula o w/h de cada membro pra bater com a escala do grupo resultante.
      const scaleFactor = g.realMetersPerMm && merged.realMetersPerMm ? g.realMetersPerMm / merged.realMetersPerMm : 1
      for (const im of g.images) {
        // membro entra nas coordenadas locais do grupo primário, com offset proporcional à posição relativa dos frames
        merged.images.push({
          ...im,
          x: (g.x - merged.x) * scaleFactor + im.x * scaleFactor,
          y: (g.y - merged.y) * scaleFactor + im.y * scaleFactor,
          w: im.w * scaleFactor,
          h: im.h * scaleFactor,
        })
      }
      // cotas/anotações do grupo secundário: converte fração relativa ao frame dele pra fração relativa ao frame do primário
      for (const d of g.dims) {
        const abs1 = fromGroupFrac(g, d.p1)
        const abs2 = fromGroupFrac(g, d.p2)
        const local1 = { x: (g.x - merged.x) * scaleFactor + abs1.x * scaleFactor, y: (g.y - merged.y) * scaleFactor + abs1.y * scaleFactor }
        const local2 = { x: (g.x - merged.x) * scaleFactor + abs2.x * scaleFactor, y: (g.y - merged.y) * scaleFactor + abs2.y * scaleFactor }
        merged.dims.push({ ...d, p1: toGroupFrac(merged, local1), p2: toGroupFrac(merged, local2), offset: offsetToFrac(merged, offsetFromFrac(g, d.offset) * scaleFactor) })
      }
      for (const a of g.annotations) {
        const abs = annotationFromFrac(g, a)
        const shifted = shiftAnnotationAbs(abs, (g.x - merged.x) * scaleFactor, (g.y - merged.y) * scaleFactor, scaleFactor)
        merged.annotations.push(newAnnotationToFrac(merged, shifted as unknown as NewAnnotation) as Annotation)
      }
    }
    const removeIds = new Set(groupIds.slice(1))
    set((state) => ({
      sheets: state.sheets.map((s) => (s.id === found[0].sheet.id ? { ...s, groups: [...s.groups.filter((g) => !removeIds.has(g.id) && g.id !== primary.id), merged] } : s)),
      selection: { type: 'group', id: merged.id },
      multiSelection: [],
    }))
  },

  ungroupSelection(groupId) {
    const found = findGroup(get().sheets, groupId)
    if (!found || found.group.images.length < 2) return
    get().commitHistory()
    const g = found.group
    const newGroups: ImageGroup[] = g.images.map((im) => ({
      id: uuidv4(),
      x: g.x + im.x,
      y: g.y + im.y,
      w: im.w,
      h: im.h,
      locked: im.locked,
      realMetersPerMm: g.realMetersPerMm,
      images: [{ ...im, x: 0, y: 0 }],
      dims: [],
      annotations: [],
    }))
    set((state) => ({
      sheets: state.sheets.map((s) => (s.id === found.sheet.id ? { ...s, groups: [...s.groups.filter((x) => x.id !== groupId), ...newGroups] } : s)),
      selection: { type: null, id: null },
      multiSelection: [],
    }))
  },

  enterGroup(groupId) {
    set({ openGroupId: groupId })
  },
  exitGroup() {
    set({ openGroupId: null })
  },

  startCrop(sheetId, groupId, imageId, initial) {
    set({ crop: { sheetId, groupId, imageId, points: initial ? [...initial] : [], preview: null } })
  },
  addCropPoint(p) {
    set((state) => (state.crop ? { crop: { ...state.crop, points: [...state.crop.points, p] } } : {}))
  },
  setCropPoint(index, p) {
    set((state) => (state.crop ? { crop: { ...state.crop, points: state.crop.points.map((pt, i) => (i === index ? p : pt)) } } : {}))
  },
  insertCropPointAt(index, p) {
    set((state) => {
      if (!state.crop) return {}
      const points = [...state.crop.points]
      points.splice(index + 1, 0, p)
      return { crop: { ...state.crop, points } }
    })
  },
  setCropPreview(p) {
    set((state) => (state.crop ? { crop: { ...state.crop, preview: p } } : {}))
  },
  removeCropPoint(index) {
    set((state) => (state.crop ? { crop: { ...state.crop, points: state.crop.points.filter((_, i) => i !== index) } } : {}))
  },
  commitCrop() {
    const c = get().crop
    if (!c || c.points.length < 3) {
      set({ crop: null })
      return
    }
    get().commitHistory()
    set((state) => ({
      sheets: mapGroupInSheets(state.sheets, c.groupId, (g) => ({ ...g, images: g.images.map((im) => (im.id === c.imageId ? { ...im, crop: c.points } : im)) })),
      crop: null,
    }))
  },
  cancelCrop() {
    set({ crop: null })
  },
  clearCrop(groupId, imageId) {
    get().commitHistory()
    set((state) => ({ sheets: mapGroupInSheets(state.sheets, groupId, (g) => ({ ...g, images: g.images.map((im) => (im.id === imageId ? { ...im, crop: null } : im)) })) }))
  },

  copySelection() {
    const { selection, sheets } = get()
    if (selection.type === 'group') {
      const found = findGroup(sheets, selection.id)
      if (found) set({ clipboard: { group: cloneGroupWithNewIds(found.group) } })
    } else if (selection.type === 'member') {
      const found = findMember(sheets, selection.id)
      if (found) {
        const soloGroup: ImageGroup = { id: uuidv4(), x: found.group.x + found.image.x, y: found.group.y + found.image.y, w: found.image.w, h: found.image.h, locked: false, realMetersPerMm: null, images: [{ ...found.image, id: uuidv4(), x: 0, y: 0 }], dims: [], annotations: [] }
        set({ clipboard: { group: soloGroup } })
      }
    }
  },
  cutSelection() {
    const { selection } = get()
    get().copySelection()
    if (selection.type === 'group') get().deleteGroup(selection.id)
    else if (selection.type === 'member') {
      const found = findMember(get().sheets, selection.id)
      if (found) get().deleteMember(found.group.id, selection.id)
    }
  },
  pasteClipboard(targetSheetId, inPlace, pastePoint) {
    const clip = get().clipboard
    if (!clip) return
    get().commitHistory()
    const fresh = cloneGroupWithNewIds(clip.group)
    const openGroupId = get().openGroupId
    if (!inPlace && pastePoint) {
      fresh.x = pastePoint.x
      fresh.y = pastePoint.y
    } else if (!inPlace) {
      fresh.x += 12
      fresh.y += 12
    }
    if (openGroupId) {
      const target = findGroup(get().sheets, openGroupId)
      if (target) {
        const members = fresh.images.map((im) => ({ ...im, x: fresh.x - target.group.x + im.x, y: fresh.y - target.group.y + im.y }))
        set((state) => ({
          sheets: mapGroupInSheets(state.sheets, openGroupId, (g) => ({ ...g, images: [...g.images, ...members] })),
          selection: { type: 'member', id: members[0].id },
        }))
        return
      }
    }
    set((state) => ({
      sheets: state.sheets.map((s) => (s.id === targetSheetId ? { ...s, groups: [...s.groups, fresh] } : s)),
      selection: { type: 'group', id: fresh.id },
    }))
  },

  select(selection) {
    set({ selection, multiSelection: [] })
  },
  setMultiSelection(items) {
    set({ multiSelection: items })
  },
  toggleMultiSelection(item) {
    set((state) => {
      const exists = state.multiSelection.some((i) => i.type === item.type && i.id === item.id)
      return { multiSelection: exists ? state.multiSelection.filter((i) => !(i.type === item.type && i.id === item.id)) : [...state.multiSelection, item] }
    })
  },

  deleteDim(dimId) {
    const found = findGroupOfDim(get().sheets, dimId)
    if (!found) return
    get().commitHistory()
    set((state) => ({
      sheets: mapGroupInSheets(state.sheets, found.group.id, (g) => ({ ...g, dims: g.dims.filter((d) => d.id !== dimId) })),
      selection: state.selection.type === 'dim' && state.selection.id === dimId ? { type: null, id: null } : state.selection,
    }))
  },

  overrideDimText(dimId, text) {
    const found = findGroupOfDim(get().sheets, dimId)
    if (!found) return
    get().commitHistory()
    set((state) => ({ sheets: mapGroupInSheets(state.sheets, found.group.id, (g) => ({ ...g, dims: g.dims.map((d) => (d.id === dimId ? { ...d, text } : d)) })) }))
  },

  adjustDimOffset(dimId, offsetMm) {
    const found = findGroupOfDim(get().sheets, dimId)
    if (!found) return
    const offset = offsetToFrac(found.group, offsetMm)
    set((state) => ({ sheets: mapGroupInSheets(state.sheets, found.group.id, (g) => ({ ...g, dims: g.dims.map((d) => (d.id === dimId ? { ...d, offset } : d)) })) }))
  },

  addAnnotation(groupId, ann) {
    const found = findGroup(get().sheets, groupId)
    if (!found) return
    get().commitHistory()
    const frac = newAnnotationToFrac(found.group, ann)
    const full = { ...frac, id: uuidv4() } as Annotation
    set((state) => ({
      sheets: mapGroupInSheets(state.sheets, groupId, (g) => ({ ...g, annotations: [...g.annotations, full] })),
      selection: { type: 'annotation', id: full.id },
    }))
  },

  patchAnnotation(id, patch) {
    const found = findGroupOfAnnotation(get().sheets, id)
    if (!found) return
    const fracPatch = annotationPatchToFrac(found.group, patch)
    set((state) => ({
      sheets: mapGroupInSheets(state.sheets, found.group.id, (g) => ({ ...g, annotations: g.annotations.map((a) => (a.id === id ? ({ ...a, ...fracPatch } as Annotation) : a)) })),
    }))
  },

  deleteAnnotation(id) {
    const found = findGroupOfAnnotation(get().sheets, id)
    if (!found) return
    get().commitHistory()
    set((state) => ({
      sheets: mapGroupInSheets(state.sheets, found.group.id, (g) => ({ ...g, annotations: g.annotations.filter((a) => a.id !== id) })),
      selection: state.selection.type === 'annotation' && state.selection.id === id ? { type: null, id: null } : state.selection,
    }))
  },

  deleteMultiSelection() {
    const items = get().multiSelection
    if (!items.length) return
    get().commitHistory()
    const dimIds = new Set(items.filter((i) => i.type === 'dim').map((i) => i.id))
    const annIds = new Set(items.filter((i) => i.type === 'annotation').map((i) => i.id))
    const groupIds = new Set(items.filter((i) => i.type === 'group').map((i) => i.id))
    set((state) => ({
      sheets: state.sheets.map((s) => ({
        ...s,
        groups: s.groups.filter((g) => !groupIds.has(g.id)).map((g) => ({ ...g, dims: g.dims.filter((d) => !dimIds.has(d.id)), annotations: g.annotations.filter((a) => !annIds.has(a.id)) })),
      })),
      multiSelection: [],
      selection: { type: null, id: null },
    }))
  },

  setTool(tool) {
    if (get().crop) get().commitCrop()
    set({ tool, cota: IDLE_COTA, cal: IDLE_CAL, draft: IDLE_DRAFT })
  },

  setDimMode(mode) {
    set({ dimMode: mode, cota: IDLE_COTA })
  },

  setDimUnit(unit) {
    set({ dimUnit: unit })
  },

  startCota(sheetId, groupId, p1) {
    set({ cota: { step: 1, sheetId, groupId, p1, p2: null, resolvedMode: null, previewOffset: null } })
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
    if (cota.step !== 2 || !cota.groupId || !cota.p1 || !cota.p2 || !cota.resolvedMode) return
    const found = findGroup(get().sheets, cota.groupId)
    if (!found) return
    get().commitHistory()
    const offsetMm = perpendicularOffset(cota.resolvedMode, cota.p1, cota.p2, pt) || 0.001
    const dim: Dimension = {
      id: uuidv4(),
      mode: cota.resolvedMode,
      p1: toGroupFrac(found.group, cota.p1),
      p2: toGroupFrac(found.group, cota.p2),
      offset: offsetToFrac(found.group, offsetMm),
      unit: dimUnit,
      text: null,
    }
    const groupId = cota.groupId
    set((state) => ({
      sheets: mapGroupInSheets(state.sheets, groupId, (g) => ({ ...g, dims: [...g.dims, dim] })),
      cota: IDLE_COTA,
    }))
  },

  cancelCota() {
    set({ cota: IDLE_COTA })
  },

  startCal(mode, sheetId, groupId, imageId, p1) {
    set({ cal: { step: 1, mode, sheetId, groupId, imageId, p1, preview: null } })
  },
  /** Prepara o alvo (grupo+membro) do "Ajustar à escala do grupo" antes do primeiro clique — startCal
   *  já espera receber p1, então não serve pra isso sozinho. */
  primeFitScale(sheetId, groupId, imageId) {
    set({ cal: { step: 0, mode: 'member', sheetId, groupId, imageId, p1: null, preview: null } })
  },

  setCalPreview(pt) {
    const { cal } = get()
    if (cal.step !== 1) return
    set({ cal: { ...cal, preview: pt } })
  },

  cancelCal() {
    set({ cal: IDLE_CAL })
  },

  startDraft(tool, sheetId, groupId, p) {
    set({ draft: { tool, sheetId, groupId, points: [p], preview: null } })
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
    set({ sheets, project, selection: { type: null, id: null }, multiSelection: [], openGroupId: null, past: [], future: [] })
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

    const group: ImageGroup = {
      id: uuidv4(),
      x: imgX,
      y: imgY,
      w: dispW,
      h: dispH,
      locked: true,
      realMetersPerMm: 0.05,
      images: [{ id: uuidv4(), href: dataUrl, natW, natH, x: 0, y: 0, w: dispW, h: dispH, locked: true, crop: null }],
      dims: [],
      annotations: [],
    }
    // pontos criados em mm sheet-local; converte pra local-ao-grupo e depois fração, igual ao fluxo real
    const toLocal = (p: Point) => ({ x: p.x - imgX, y: p.y - imgY })
    group.dims = [
      { id: uuidv4(), mode: 'h', p1: toGroupFrac(group, toLocal(tl)), p2: toGroupFrac(group, toLocal(tr)), offset: offsetToFrac(group, -27), unit: 'm', text: null },
      { id: uuidv4(), mode: 'v', p1: toGroupFrac(group, toLocal(tl)), p2: toGroupFrac(group, toLocal(bl)), offset: offsetToFrac(group, -16), unit: 'm', text: null },
      { id: uuidv4(), mode: 'aligned', p1: toGroupFrac(group, toLocal(tl)), p2: toGroupFrac(group, toLocal(pw)), offset: offsetToFrac(group, -9), unit: 'm', text: null },
    ]

    const sheet: Sheet = {
      id: uuidv4(),
      name: 'Planta baixa · térreo (exemplo)',
      size: 'A3',
      orientation: 'paisagem',
      x: 0,
      y: 0,
      w: resolveDims('A3', 'paisagem').w,
      h: resolveDims('A3', 'paisagem').h,
      groups: [group],
      titleBlock: { sheetTitle: 'Planta baixa · térreo', date: '', revision: '' },
    }
    set({ sheets: [sheet], project: { name: 'Projeto de exemplo', client: '', author: '' }, selection: { type: 'sheet', id: sheet.id }, multiSelection: [], openGroupId: null, past: [], future: [] })
  },
}))

function shiftAnnotationAbs(ann: Annotation, dx: number, dy: number, scale: number): Annotation {
  switch (ann.kind) {
    case 'marker':
      return { ...ann, pos: { x: ann.pos.x * scale + dx, y: ann.pos.y * scale + dy } }
    case 'leader':
      return { ...ann, anchor: { x: ann.anchor.x * scale + dx, y: ann.anchor.y * scale + dy }, label: { x: ann.label.x * scale + dx, y: ann.label.y * scale + dy } }
    case 'level':
      return { ...ann, y: ann.y * scale + dy, x1: ann.x1 * scale + dx, x2: ann.x2 * scale + dx }
    case 'callout':
      return { ...ann, rect: { x: ann.rect.x * scale + dx, y: ann.rect.y * scale + dy, w: ann.rect.w * scale, h: ann.rect.h * scale }, targetPos: { x: ann.targetPos.x * scale + dx, y: ann.targetPos.y * scale + dy } }
  }
}

export function annotationSheetOf(sheets: Sheet[], annotationId: string) {
  return findGroupOfAnnotation(sheets, annotationId)?.sheet
}
export function findGroupById(sheets: Sheet[], groupId: string) {
  return findGroup(sheets, groupId)
}
export function findMemberById(sheets: Sheet[], imageId: string) {
  return findMember(sheets, imageId)
}
