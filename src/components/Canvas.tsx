import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useProjectStore, findGroupById, findMemberById } from '../state/projectStore'
import { fitToContentView, focusOnSheetView, screenToWorld, sheetAtWorldPoint, groupsAtSheetLocalPoint } from '../lib/viewMath'
import { formatDimText, perpendicularOffset } from '../lib/dimGeometry'
import { loadPersistedProject, saveProject } from '../lib/persistence'
import { annotationWorldBoxes, boxContains, boxesIntersect, dimWorldBoxes, groupWorldBox, type Box } from '../lib/marquee'
import type { DraftTool, ImageGroup, Orientation, Point, ProjectInfo, Sheet, SheetImage, SheetSizeKey } from '../types'
import { SheetView, type Corner } from './SheetView'
import { SheetTab } from './SheetTab'
import { CalibratePrompt } from './CalibratePrompt'
import { TextPrompt } from './TextPrompt'
import { ProjectInfoPrompt } from './ProjectInfoPrompt'
import { Toolbar } from './Toolbar'
import { StatusBar } from './StatusBar'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { TipsModal } from './TipsModal'

interface DragHandle {
  moved: boolean
  startX: number
  startY: number
  onMove: (e: PointerEvent) => void
  onEnd?: (e: PointerEvent) => void
}

type PendingPrompt =
  | { kind: 'calibrate'; sheetId: string; groupId: string; anchor: Point; dpaper: number; x: number; y: number }
  | { kind: 'fitScale'; sheetId: string; groupId: string; imageId: string; anchor: Point; dpaper: number; x: number; y: number }
  | { kind: 'dimText'; dimId: string; initial: string; x: number; y: number }
  | { kind: 'annotationText'; annId: string; initial: string; x: number; y: number }
  | { kind: 'draftText'; draftTool: DraftTool; groupId: string; points: Point[]; initial: string; x: number; y: number }
  | { kind: 'titleBlock'; sheetId: string; field: 'sheetTitle' | 'date' | 'revision'; initial: string; x: number; y: number }
  | { kind: 'projectInfo'; x: number; y: number }
  | null

type MenuState = { x: number; y: number; items: ContextMenuItem[] } | null

const DRAFT_DEFAULT_TEXT: Record<DraftTool, string> = { leader: '', level: '0,00' }
const TIPS_SEEN_KEY = 'prancheta-livre:tips-seen'

export function Canvas() {
  const svgRef = useRef<SVGSVGElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projectFileInputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<DragHandle | null>(null)
  const suppressClickRef = useRef(false)
  const warnTimerRef = useRef<number | undefined>(undefined)
  const altCycleRef = useRef<{ key: string; index: number } | null>(null)

  const sheets = useProjectStore((s) => s.sheets)
  const project = useProjectStore((s) => s.project)
  const selection = useProjectStore((s) => s.selection)
  const multiSelection = useProjectStore((s) => s.multiSelection)
  const openGroupId = useProjectStore((s) => s.openGroupId)
  const tool = useProjectStore((s) => s.tool)
  const cota = useProjectStore((s) => s.cota)
  const cal = useProjectStore((s) => s.cal)
  const draft = useProjectStore((s) => s.draft)
  const crop = useProjectStore((s) => s.crop)
  const view = useProjectStore((s) => s.view)

  const setSheetPos = useProjectStore((s) => s.setSheetPos)
  const importImage = useProjectStore((s) => s.importImage)
  const setGroupRect = useProjectStore((s) => s.setGroupRect)
  const setMemberRect = useProjectStore((s) => s.setMemberRect)
  const toggleMemberLock = useProjectStore((s) => s.toggleMemberLock)
  const calibrateGroup = useProjectStore((s) => s.calibrateGroup)
  const fitMemberToGroupScale = useProjectStore((s) => s.fitMemberToGroupScale)
  const reorderMember = useProjectStore((s) => s.reorderMember)
  const deleteMember = useProjectStore((s) => s.deleteMember)
  const deleteGroup = useProjectStore((s) => s.deleteGroup)
  const groupSelectionAction = useProjectStore((s) => s.groupSelection)
  const ungroupSelection = useProjectStore((s) => s.ungroupSelection)
  const enterGroup = useProjectStore((s) => s.enterGroup)
  const exitGroup = useProjectStore((s) => s.exitGroup)
  const startCrop = useProjectStore((s) => s.startCrop)
  const addCropPoint = useProjectStore((s) => s.addCropPoint)
  const setCropPoint = useProjectStore((s) => s.setCropPoint)
  const insertCropPointAt = useProjectStore((s) => s.insertCropPointAt)
  const removeCropPoint = useProjectStore((s) => s.removeCropPoint)
  const commitCrop = useProjectStore((s) => s.commitCrop)
  const cancelCrop = useProjectStore((s) => s.cancelCrop)
  const clearCrop = useProjectStore((s) => s.clearCrop)
  const copySelection = useProjectStore((s) => s.copySelection)
  const cutSelection = useProjectStore((s) => s.cutSelection)
  const deleteSheet = useProjectStore((s) => s.deleteSheet)
  const renameSheet = useProjectStore((s) => s.renameSheet)
  const select = useProjectStore((s) => s.select)
  const setMultiSelection = useProjectStore((s) => s.setMultiSelection)
  const toggleMultiSelection = useProjectStore((s) => s.toggleMultiSelection)
  const adjustDimOffset = useProjectStore((s) => s.adjustDimOffset)
  const overrideDimText = useProjectStore((s) => s.overrideDimText)
  const addAnnotation = useProjectStore((s) => s.addAnnotation)
  const patchAnnotation = useProjectStore((s) => s.patchAnnotation)
  const setTitleBlockField = useProjectStore((s) => s.setTitleBlockField)
  const setProjectInfo = useProjectStore((s) => s.setProjectInfo)
  const setTool = useProjectStore((s) => s.setTool)
  const startCota = useProjectStore((s) => s.startCota)
  const setCotaP2 = useProjectStore((s) => s.setCotaP2)
  const commitCota = useProjectStore((s) => s.commitCota)
  const startCal = useProjectStore((s) => s.startCal)
  const primeFitScale = useProjectStore((s) => s.primeFitScale)
  const cancelCal = useProjectStore((s) => s.cancelCal)
  const startDraft = useProjectStore((s) => s.startDraft)
  const addDraftPoint = useProjectStore((s) => s.addDraftPoint)
  const cancelDraft = useProjectStore((s) => s.cancelDraft)
  const setView = useProjectStore((s) => s.setView)
  const seedSample = useProjectStore((s) => s.seedSample)

  const [warning, setWarning] = useState<string | null>(null)
  const [coords, setCoords] = useState('')
  const [prompt, setPrompt] = useState<PendingPrompt>(null)
  const [menu, setMenu] = useState<MenuState>(null)
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [showTips, setShowTips] = useState(false)

  function warn(msg: string) {
    window.clearTimeout(warnTimerRef.current)
    setWarning(msg)
    warnTimerRef.current = window.setTimeout(() => setWarning(null), 2600)
  }

  // ---------------- boot: resume a saved project, or seed the sample ----------------
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    ;(async () => {
      const saved = await loadPersistedProject().catch(() => null)
      if (saved && saved.sheets.length) {
        useProjectStore.getState().loadProject(saved.sheets, saved.project)
      } else {
        await seedSample()
      }
    })()
    try {
      if (!localStorage.getItem(TIPS_SEEN_KEY)) setShowTips(true)
    } catch {
      /* localStorage indisponível — não bloqueia o app */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function closeTips() {
    setShowTips(false)
    try {
      localStorage.setItem(TIPS_SEEN_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  // ---------------- autosave (debounced) ----------------
  useEffect(() => {
    let timer: number | undefined
    const unsub = useProjectStore.subscribe((state, prev) => {
      if (state.sheets === prev.sheets && state.project === prev.project) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const s = useProjectStore.getState()
        saveProject(s.sheets, s.project).catch(() => {})
      }, 800)
    })
    return () => {
      window.clearTimeout(timer)
      unsub()
    }
  }, [])

  function getRect(): DOMRect {
    return svgRef.current!.getBoundingClientRect()
  }
  function toWorld(clientX: number, clientY: number): Point {
    return screenToWorld(useProjectStore.getState().view, getRect(), clientX, clientY)
  }

  // ---------------- drag lifecycle (native listeners, always read live store state) ----------------
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const rect = getRect()
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        setCoords('')
      } else {
        const pt = toWorld(e.clientX, e.clientY)
        setCoords(`x ${pt.x.toFixed(0)}mm  y ${pt.y.toFixed(0)}mm`)
      }

      const drag = dragRef.current
      if (!drag) {
        const state = useProjectStore.getState()
        if (state.tool === 'cota' && state.cota.step === 2 && state.cota.groupId) {
          const g = findGroupById(state.sheets, state.cota.groupId)
          if (g) {
            const pt = toWorld(e.clientX, e.clientY)
            state.setCotaPreviewOffset({ x: pt.x - g.sheet.x - g.group.x, y: pt.y - g.sheet.y - g.group.y })
          }
        }
        if ((state.tool === 'calibrate' || state.tool === 'fitScale') && state.cal.step === 1 && state.cal.groupId) {
          const g = findGroupById(state.sheets, state.cal.groupId)
          if (g) {
            const pt = toWorld(e.clientX, e.clientY)
            state.setCalPreview({ x: pt.x - g.sheet.x - g.group.x, y: pt.y - g.sheet.y - g.group.y })
          }
        }
        if ((state.tool === 'leader' || state.tool === 'level') && state.draft.tool && state.draft.groupId) {
          const g = findGroupById(state.sheets, state.draft.groupId)
          if (g) {
            const pt = toWorld(e.clientX, e.clientY)
            state.setDraftPreview({ x: pt.x - g.sheet.x - g.group.x, y: pt.y - g.sheet.y - g.group.y })
          }
        }
        if (state.crop) {
          const g = findGroupById(state.sheets, state.crop.groupId)
          const m = g?.group.images.find((im) => im.id === state.crop!.imageId)
          if (g && m) {
            const pt = toWorld(e.clientX, e.clientY)
            const localX = pt.x - g.sheet.x - g.group.x - m.x
            const localY = pt.y - g.sheet.y - g.group.y - m.y
            state.setCropPreview({ x: m.w ? localX / m.w : 0, y: m.h ? localY / m.h : 0 })
          }
        }
        return
      }
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 3) drag.moved = true
      drag.onMove(e)
    }
    function onUp(e: PointerEvent) {
      const drag = dragRef.current
      if (drag) {
        drag.onEnd?.(e)
        if (drag.moved) suppressClickRef.current = true
        dragRef.current = null
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------- wheel zoom ----------------
  useEffect(() => {
    const el = canvasWrapRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = getRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const v = useProjectStore.getState().view
      const wx = (cx - v.panX) / v.zoom
      const wy = (cy - v.panY) / v.zoom
      const factor = Math.pow(1.0012, -e.deltaY)
      const newZoom = Math.max(0.15, Math.min(10, v.zoom * factor))
      useProjectStore.getState().setView({ panX: cx - wx * newZoom, panY: cy - wy * newZoom, zoom: newZoom })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------- keyboard shortcuts ----------------
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const state = useProjectStore.getState()
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        state.undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || ((e.key === 'z' || e.key === 'Z') && e.shiftKey))) {
        e.preventDefault()
        state.redo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && !e.shiftKey) {
        if (state.selection.type === 'group' || state.selection.type === 'member') {
          e.preventDefault()
          state.copySelection()
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
        if (state.selection.type === 'group' || state.selection.type === 'member') {
          e.preventDefault()
          state.cutSelection()
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault()
        const sheet = state.openGroupId ? findGroupById(state.sheets, state.openGroupId)?.sheet : state.selection.type === 'sheet' ? state.sheets.find((s) => s.id === state.selection.id) : state.sheets.find((s) => s.groups.some((g) => g.id === state.selection.id) || s.groups.some((g) => g.images.some((im) => im.id === state.selection.id)))
        if (sheet) state.pasteClipboard(sheet.id, e.shiftKey)
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault()
        const groupIds = [...(state.selection.type === 'group' ? [state.selection.id] : []), ...state.multiSelection.filter((i) => i.type === 'group').map((i) => i.id)]
        const unique = [...new Set(groupIds)]
        if (e.shiftKey) {
          if (state.selection.type === 'group') state.ungroupSelection(state.selection.id)
        } else if (unique.length >= 2) {
          state.groupSelection(unique)
        }
        return
      }
      if (e.key === 'Enter') {
        if (state.crop) {
          e.preventDefault()
          state.commitCrop()
          return
        }
        if (state.selection.type === 'group') {
          e.preventDefault()
          state.enterGroup(state.selection.id)
          return
        }
      }
      if (e.key === 'Escape') {
        state.cancelCota()
        state.cancelCal()
        state.cancelDraft()
        state.cancelCrop()
        if (state.openGroupId) state.exitGroup()
        else state.select({ type: null, id: null })
        setPrompt(null)
        setMenu(null)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelectionLive()
        return
      }
      if (e.key === 'v' || e.key === 'V') state.setTool('select')
      if (e.key === 'd' || e.key === 'D') state.setTool('cota')
      if (e.key === 'c' || e.key === 'C') state.setTool('calibrate')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function deleteSelectionLive() {
    const state = useProjectStore.getState()
    if (state.multiSelection.length) {
      state.deleteMultiSelection()
      return
    }
    const sel = state.selection
    if (sel.type === 'dim') {
      state.deleteDim(sel.id)
    } else if (sel.type === 'annotation') {
      state.deleteAnnotation(sel.id)
    } else if (sel.type === 'member') {
      const found = findMemberById(state.sheets, sel.id)
      if (found) state.deleteMember(found.group.id, sel.id)
    } else if (sel.type === 'group') {
      if (confirm('Excluir este grupo? Cotas e anotações dele também serão removidas.')) {
        state.deleteGroup(sel.id)
      }
    } else if (sel.type === 'sheet') {
      const sheet = state.sheets.find((s) => s.id === sel.id)
      if (sheet && confirm(`Excluir a prancha "${sheet.name}"?`)) state.deleteSheet(sheet.id)
    }
  }

  // ---------------- drag initiators ----------------
  function beginPan(e: { clientX: number; clientY: number }) {
    canvasWrapRef.current?.classList.add('panning')
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      onMove(ev) {
        const v = useProjectStore.getState().view
        setView({ panX: v.panX + ev.movementX, panY: v.panY + ev.movementY, zoom: v.zoom })
      },
      onEnd() {
        canvasWrapRef.current?.classList.remove('panning')
      },
    }
  }

  function beginMarquee(e: { clientX: number; clientY: number }) {
    const rect = getRect()
    const startClientX = e.clientX
    const startClientY = e.clientY
    setMarquee({ x1: startClientX - rect.left, y1: startClientY - rect.top, x2: startClientX - rect.left, y2: startClientY - rect.top })
    dragRef.current = {
      moved: false,
      startX: startClientX,
      startY: startClientY,
      onMove(ev) {
        setMarquee({ x1: startClientX - rect.left, y1: startClientY - rect.top, x2: ev.clientX - rect.left, y2: ev.clientY - rect.top })
      },
      onEnd(ev) {
        const window_ = ev.clientX >= startClientX // esquerda->direita = Window (contém); direita->esquerda = Crossing (toca)
        const p1 = toWorld(startClientX, startClientY)
        const p2 = toWorld(ev.clientX, ev.clientY)
        const box: Box = { minX: Math.min(p1.x, p2.x), minY: Math.min(p1.y, p2.y), maxX: Math.max(p1.x, p2.x), maxY: Math.max(p1.y, p2.y) }
        setMarquee(null)
        if (Math.abs(ev.clientX - startClientX) < 3 && Math.abs(ev.clientY - startClientY) < 3) return
        const items: { type: 'group' | 'dim' | 'annotation'; id: string }[] = []
        for (const sheet of sheets) {
          for (const group of sheet.groups) {
            const gbox = groupWorldBox(sheet, group)
            if (window_ ? boxContains(box, gbox) : boxesIntersect(box, gbox)) items.push({ type: 'group', id: group.id })
            for (const d of dimWorldBoxes(sheet, group)) if (window_ ? boxContains(box, d.box) : boxesIntersect(box, d.box)) items.push({ type: 'dim', id: d.id })
            for (const a of annotationWorldBoxes(sheet, group)) if (window_ ? boxContains(box, a.box) : boxesIntersect(box, a.box)) items.push({ type: 'annotation', id: a.id })
          }
        }
        // select() zera multiSelection como efeito colateral (single-select normal) — por isso
        // precisa rodar ANTES de setMultiSelection aqui, nunca depois.
        select({ type: null, id: null })
        setMultiSelection(items)
      },
    }
  }

  function beginMoveSheet(e: React.PointerEvent, sheet: Sheet) {
    useProjectStore.getState().commitHistory()
    const start = toWorld(e.clientX, e.clientY)
    const orig = { x: sheet.x, y: sheet.y }
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      onMove(ev) {
        const cur = toWorld(ev.clientX, ev.clientY)
        setSheetPos(sheet.id, orig.x + (cur.x - start.x), orig.y + (cur.y - start.y))
      },
    }
  }

  function beginMoveGroup(e: React.PointerEvent, group: ImageGroup) {
    useProjectStore.getState().commitHistory()
    const start = toWorld(e.clientX, e.clientY)
    const orig = { x: group.x, y: group.y }
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      onMove(ev) {
        const cur = toWorld(ev.clientX, ev.clientY)
        setGroupRect(group.id, { x: orig.x + (cur.x - start.x), y: orig.y + (cur.y - start.y) })
      },
    }
  }

  function beginMoveMember(e: React.PointerEvent, group: ImageGroup, image: SheetImage) {
    useProjectStore.getState().commitHistory()
    const start = toWorld(e.clientX, e.clientY)
    const orig = { x: image.x, y: image.y }
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      onMove(ev) {
        const cur = toWorld(ev.clientX, ev.clientY)
        setMemberRect(group.id, image.id, { x: orig.x + (cur.x - start.x), y: orig.y + (cur.y - start.y) })
      },
    }
  }

  function cornerAnchor(corner: Corner, orig: { x: number; y: number; w: number; h: number }) {
    return corner === 'nw'
      ? { x: orig.x + orig.w, y: orig.y + orig.h }
      : corner === 'ne'
        ? { x: orig.x, y: orig.y + orig.h }
        : corner === 'sw'
          ? { x: orig.x + orig.w, y: orig.y }
          : { x: orig.x, y: orig.y }
  }

  function beginResizeGroup(e: React.PointerEvent, group: ImageGroup, corner: Corner) {
    useProjectStore.getState().commitHistory()
    const orig = { x: group.x, y: group.y, w: group.w, h: group.h }
    const anchor = cornerAnchor(corner, orig)
    const aspect = orig.w / orig.h
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      onMove(ev) {
        const cur = toWorld(ev.clientX, ev.clientY)
        let neww = Math.abs(cur.x - anchor.x)
        let newh = neww / aspect
        neww = Math.max(neww, 10)
        newh = Math.max(newh, 10 / aspect)
        const x = corner === 'ne' || corner === 'se' ? anchor.x : anchor.x - neww
        const y = corner === 'sw' || corner === 'se' ? anchor.y : anchor.y - newh
        const factor = neww / orig.w
        const g = findGroupById(useProjectStore.getState().sheets, group.id)?.group
        if (!g) return
        setGroupRect(group.id, { x, y, w: neww, h: newh })
        setMemberRectsForGroupResize(group.id, g, factor)
      },
    }
  }

  function setMemberRectsForGroupResize(groupId: string, origGroup: ImageGroup, factor: number) {
    // redimensiona os membros proporcionalmente ao vivo (mesmo princípio de calibrateGroup, mas em cada frame do arraste)
    for (const im of origGroup.images) {
      setMemberRect(groupId, im.id, { x: im.x * factor, y: im.y * factor, w: im.w * factor, h: im.h * factor })
    }
  }

  function beginResizeMember(e: React.PointerEvent, group: ImageGroup, image: SheetImage, corner: Corner) {
    useProjectStore.getState().commitHistory()
    const orig = { x: image.x, y: image.y, w: image.w, h: image.h }
    const anchor = cornerAnchor(corner, orig)
    const aspect = orig.w / orig.h
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      onMove(ev) {
        const cur = toWorld(ev.clientX, ev.clientY)
        let neww = Math.abs(cur.x - anchor.x)
        let newh = neww / aspect
        neww = Math.max(neww, 5)
        newh = Math.max(newh, 5 / aspect)
        const x = corner === 'ne' || corner === 'se' ? anchor.x : anchor.x - neww
        const y = corner === 'sw' || corner === 'se' ? anchor.y : anchor.y - newh
        setMemberRect(group.id, image.id, { x, y, w: neww, h: newh })
      },
    }
  }

  function beginAdjustDim(e: React.PointerEvent, sheet: Sheet, group: ImageGroup, dimId: string) {
    useProjectStore.getState().commitHistory()
    // precisa da geometria em mm-local-ao-grupo pra achar o offset perpendicular corretamente
    const found = findGroupById(useProjectStore.getState().sheets, group.id)
    const dim = found?.group.dims.find((d) => d.id === dimId)
    if (!dim || !found) return
    const p1mm = { x: dim.p1.x * found.group.w, y: dim.p1.y * found.group.h }
    const p2mm = { x: dim.p2.x * found.group.w, y: dim.p2.y * found.group.h }
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      onMove(ev) {
        const cur = toWorld(ev.clientX, ev.clientY)
        const local = { x: cur.x - sheet.x - group.x, y: cur.y - sheet.y - group.y }
        const offset = perpendicularOffset(dim.mode, p1mm, p2mm, local)
        adjustDimOffset(dimId, offset || 0.001)
      },
    }
  }

  function beginDragField(e: React.PointerEvent, _sheet: Sheet, _group: ImageGroup, annId: string, build: (dx: number, dy: number) => Record<string, unknown>) {
    useProjectStore.getState().commitHistory()
    const start = toWorld(e.clientX, e.clientY)
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      onMove(ev) {
        const cur = toWorld(ev.clientX, ev.clientY)
        patchAnnotation(annId, build(cur.x - start.x, cur.y - start.y))
      },
    }
  }

  function beginDragCropVertex(e: React.PointerEvent, index: number) {
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      onMove(ev) {
        const state = useProjectStore.getState()
        const c = state.crop
        if (!c) return
        const g = findGroupById(state.sheets, c.groupId)
        const m = g?.group.images.find((im) => im.id === c.imageId)
        if (!g || !m) return
        const cur = toWorld(ev.clientX, ev.clientY)
        const localX = cur.x - g.sheet.x - g.group.x - m.x
        const localY = cur.y - g.sheet.y - g.group.y - m.y
        setCropPoint(index, { x: m.w ? localX / m.w : 0, y: m.h ? localY / m.h : 0 })
      },
    }
  }

  // ---------------- pointer/click routing ----------------
  function onStagePointerDown(e: React.PointerEvent) {
    setMenu(null)
    if (e.button === 1) {
      e.preventDefault()
      beginPan(e)
      return
    }
    if (e.button !== 0 || tool !== 'select') return
    if (crop) return
    beginMarquee(e)
  }

  function altCycleGroup(e: React.PointerEvent, sheet: Sheet): ImageGroup | null {
    const pt = toWorld(e.clientX, e.clientY)
    const local = { x: pt.x - sheet.x, y: pt.y - sheet.y }
    const candidates = groupsAtSheetLocalPoint(sheet, local)
    if (!candidates.length) return null
    const key = `${sheet.id}:${Math.round(local.x)}:${Math.round(local.y)}`
    const prev = altCycleRef.current
    const nextIndex = prev && prev.key === key ? (prev.index + 1) % candidates.length : 0
    altCycleRef.current = { key, index: nextIndex }
    return candidates[nextIndex]
  }

  function onGroupPointerDown(e: React.PointerEvent, sheet: Sheet, group: ImageGroup) {
    if (e.button !== 0 || tool !== 'select') return
    e.stopPropagation()
    suppressClickRef.current = true
    if (openGroupId && openGroupId !== group.id) exitGroup()
    if (e.altKey) {
      const picked = altCycleGroup(e, sheet)
      if (picked) select({ type: 'group', id: picked.id })
      return
    }
    if (e.shiftKey) {
      toggleMultiSelection({ type: 'group', id: group.id })
      return
    }
    select({ type: 'group', id: group.id })
    beginMoveGroup(e, group)
  }
  function onGroupHandlePointerDown(e: React.PointerEvent, _sheet: Sheet, group: ImageGroup, corner: Corner) {
    if (e.button !== 0 || tool !== 'select') return
    e.stopPropagation()
    suppressClickRef.current = true
    beginResizeGroup(e, group, corner)
  }
  function onGroupDoubleClick(e: React.MouseEvent, _sheet: Sheet, group: ImageGroup) {
    if (tool !== 'select') return
    e.stopPropagation()
    enterGroup(group.id)
    select({ type: 'group', id: group.id })
  }
  function onGroupContextMenu(e: React.MouseEvent, sheet: Sheet, group: ImageGroup) {
    e.preventDefault()
    e.stopPropagation()
    select({ type: 'group', id: group.id })
    const items: ContextMenuItem[] = []
    if (openGroupId !== group.id) items.push({ label: 'Entrar no grupo', onSelect: () => enterGroup(group.id) })
    if (group.images.length === 1) {
      const im = group.images[0]
      items.push(im.crop ? { label: 'Editar recorte', onSelect: () => startCrop(sheet.id, group.id, im.id, im.crop!) } : { label: 'Recortar', onSelect: () => startCrop(sheet.id, group.id, im.id) })
      if (im.crop) items.push({ label: 'Remover recorte', onSelect: () => clearCrop(group.id, im.id) })
    }
    const selectedGroupIds = [...new Set([...(selection.type === 'group' ? [selection.id] : []), ...multiSelection.filter((i) => i.type === 'group').map((i) => i.id), group.id])]
    if (selectedGroupIds.length >= 2) items.push({ label: 'Agrupar', onSelect: () => groupSelectionAction(selectedGroupIds) })
    if (group.images.length > 1) items.push({ label: 'Desagrupar', onSelect: () => ungroupSelection(group.id) })
    items.push({ label: group.locked ? 'Destravar grupo' : 'Travar grupo', onSelect: () => useProjectStore.getState().toggleGroupLock(group.id) })
    items.push({ label: 'Copiar', onSelect: () => { select({ type: 'group', id: group.id }); copySelection() } })
    items.push({ label: 'Cortar', onSelect: () => { select({ type: 'group', id: group.id }); cutSelection() } })
    items.push({ label: 'Excluir grupo', danger: true, onSelect: () => { if (confirm('Excluir este grupo? Cotas e anotações dele também serão removidas.')) deleteGroup(group.id) } })
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  function onMemberPointerDown(e: React.PointerEvent, sheet: Sheet, group: ImageGroup, image: SheetImage) {
    if (e.button !== 0 || tool !== 'select') return
    e.stopPropagation()
    suppressClickRef.current = true
    if (e.altKey) {
      const picked = altCycleGroup(e, sheet)
      if (picked) select({ type: 'group', id: picked.id })
      return
    }
    if (e.shiftKey) {
      toggleMultiSelection({ type: 'member', id: image.id })
      return
    }
    select({ type: 'member', id: image.id })
    beginMoveMember(e, group, image)
  }
  function onMemberHandlePointerDown(e: React.PointerEvent, _sheet: Sheet, group: ImageGroup, image: SheetImage, corner: Corner) {
    if (e.button !== 0 || tool !== 'select') return
    e.stopPropagation()
    suppressClickRef.current = true
    beginResizeMember(e, group, image, corner)
  }
  function onMemberContextMenu(e: React.MouseEvent, sheet: Sheet, group: ImageGroup, image: SheetImage) {
    e.preventDefault()
    e.stopPropagation()
    select({ type: 'member', id: image.id })
    const items: ContextMenuItem[] = []
    items.push(image.crop ? { label: 'Editar recorte', onSelect: () => startCrop(sheet.id, group.id, image.id, image.crop!) } : { label: 'Recortar', onSelect: () => startCrop(sheet.id, group.id, image.id) })
    if (image.crop) items.push({ label: 'Remover recorte', onSelect: () => clearCrop(group.id, image.id) })
    items.push({
      label: 'Ajustar à escala do grupo',
      disabled: !group.realMetersPerMm,
      onSelect: () => {
        setTool('fitScale')
        primeFitScale(sheet.id, group.id, image.id)
      },
    })
    items.push({ label: image.locked ? 'Destravar imagem' : 'Travar imagem', onSelect: () => toggleMemberLock(group.id, image.id) })
    items.push({ label: 'Trazer para frente', onSelect: () => reorderMember(group.id, image.id, 'front') })
    items.push({ label: 'Enviar para trás', onSelect: () => reorderMember(group.id, image.id, 'back') })
    items.push({ label: 'Copiar', onSelect: () => { select({ type: 'member', id: image.id }); copySelection() } })
    items.push({ label: 'Cortar', onSelect: () => { select({ type: 'member', id: image.id }); cutSelection() } })
    items.push({ label: 'Excluir imagem', danger: true, onSelect: () => deleteMember(group.id, image.id) })
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  function onDimPointerDown(e: React.PointerEvent, sheet: Sheet, group: ImageGroup, dimId: string) {
    if (e.button !== 0 || tool !== 'select') return
    e.stopPropagation()
    suppressClickRef.current = true
    if (e.shiftKey) {
      toggleMultiSelection({ type: 'dim', id: dimId })
      return
    }
    select({ type: 'dim', id: dimId })
    beginAdjustDim(e, sheet, group, dimId)
  }
  function onDimDoubleClick(e: React.MouseEvent, _sheet: Sheet, group: ImageGroup, dimId: string) {
    if (tool !== 'select') return
    e.stopPropagation()
    const dim = group.dims.find((d) => d.id === dimId)
    if (!dim) return
    select({ type: 'dim', id: dimId })
    const mm = { ...dim, p1: { x: dim.p1.x * group.w, y: dim.p1.y * group.h }, p2: { x: dim.p2.x * group.w, y: dim.p2.y * group.h } }
    const current = formatDimText(mm, group.realMetersPerMm)
    setPrompt({ kind: 'dimText', dimId, initial: current, x: e.clientX - 40, y: e.clientY - 40 })
  }

  function onAnnotationPrimaryDown(e: React.PointerEvent, sheet: Sheet, group: ImageGroup, annId: string) {
    if (e.button !== 0 || tool !== 'select') return
    e.stopPropagation()
    suppressClickRef.current = true
    if (e.shiftKey) {
      toggleMultiSelection({ type: 'annotation', id: annId })
      return
    }
    select({ type: 'annotation', id: annId })
    const ann = group.annotations.find((a) => a.id === annId)
    if (!ann) return
    if (ann.kind === 'marker') {
      const orig = { x: ann.pos.x * group.w, y: ann.pos.y * group.h }
      beginDragField(e, sheet, group, annId, (dx, dy) => ({ pos: { x: orig.x + dx, y: orig.y + dy } }))
    } else if (ann.kind === 'leader') {
      const orig = { x: ann.anchor.x * group.w, y: ann.anchor.y * group.h }
      beginDragField(e, sheet, group, annId, (dx, dy) => ({ anchor: { x: orig.x + dx, y: orig.y + dy } }))
    } else if (ann.kind === 'level') {
      const origY = ann.y * group.h
      beginDragField(e, sheet, group, annId, (_dx, dy) => ({ y: origY + dy }))
    }
  }
  function onAnnotationSecondaryDown(e: React.PointerEvent, sheet: Sheet, group: ImageGroup, annId: string) {
    if (e.button !== 0 || tool !== 'select') return
    e.stopPropagation()
    suppressClickRef.current = true
    select({ type: 'annotation', id: annId })
    const ann = group.annotations.find((a) => a.id === annId)
    if (!ann) return
    if (ann.kind === 'leader') {
      const orig = { x: ann.label.x * group.w, y: ann.label.y * group.h }
      beginDragField(e, sheet, group, annId, (dx, dy) => ({ label: { x: orig.x + dx, y: orig.y + dy } }))
    }
  }
  function onAnnotationDoubleClick(e: React.MouseEvent, _sheet: Sheet, group: ImageGroup, annId: string) {
    if (tool !== 'select') return
    e.stopPropagation()
    const ann = group.annotations.find((a) => a.id === annId)
    if (!ann || ann.kind === 'marker') return
    select({ type: 'annotation', id: annId })
    setPrompt({ kind: 'annotationText', annId, initial: ann.text, x: e.clientX - 40, y: e.clientY - 40 })
  }

  function onTitleBlockEdit(e: React.MouseEvent, sheet: Sheet, field: 'sheetTitle' | 'date' | 'revision', current: string) {
    e.stopPropagation()
    setPrompt({ kind: 'titleBlock', sheetId: sheet.id, field, initial: current, x: e.clientX - 40, y: e.clientY - 40 })
  }

  function onCropVertexPointerDown(e: React.PointerEvent, index: number) {
    e.stopPropagation()
    beginDragCropVertex(e, index)
  }
  function onCropVertexDoubleClick(e: React.MouseEvent, index: number) {
    e.stopPropagation()
    removeCropPoint(index)
  }
  function onCropEdgeClick(e: React.MouseEvent, index: number, midpoint: Point) {
    e.stopPropagation()
    insertCropPointAt(index, midpoint)
  }

  function onStageClick(e: React.MouseEvent) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (crop) {
      handleCropClick(e)
      return
    }
    if (tool === 'cota') {
      handleCotaClick(e)
      return
    }
    if (tool === 'calibrate') {
      handleCalibrateClick(e)
      return
    }
    if (tool === 'fitScale') {
      handleFitScaleClick(e)
      return
    }
    if (tool === 'marker') {
      handleMarkerClick(e)
      return
    }
    if (tool === 'leader' || tool === 'level') {
      handleDraftClick(e)
      return
    }
    const pt = toWorld(e.clientX, e.clientY)
    const sheet = sheetAtWorldPoint(sheets, pt)
    if (openGroupId) {
      const g = findGroupById(sheets, openGroupId)
      if (g) {
        const local = { x: pt.x - g.sheet.x, y: pt.y - g.sheet.y }
        const inside = local.x >= g.group.x && local.x <= g.group.x + g.group.w && local.y >= g.group.y && local.y <= g.group.y + g.group.h
        if (!inside) {
          exitGroup()
          select(sheet ? { type: 'sheet', id: sheet.id } : { type: null, id: null })
          return
        }
      }
    }
    select(sheet ? { type: 'sheet', id: sheet.id } : { type: null, id: null })
  }

  function handleCropClick(e: React.MouseEvent) {
    if (!crop) return
    const g = findGroupById(sheets, crop.groupId)
    const m = g?.group.images.find((im) => im.id === crop.imageId)
    if (!g || !m) {
      cancelCrop()
      return
    }
    const pt = toWorld(e.clientX, e.clientY)
    const localX = pt.x - g.sheet.x - g.group.x - m.x
    const localY = pt.y - g.sheet.y - g.group.y - m.y
    const inside = localX >= 0 && localX <= m.w && localY >= 0 && localY <= m.h
    if (!inside) {
      commitCrop()
      return
    }
    addCropPoint({ x: m.w ? localX / m.w : 0, y: m.h ? localY / m.h : 0 })
  }

  function handleCotaClick(e: React.MouseEvent) {
    const pt = toWorld(e.clientX, e.clientY)
    const sheet = sheetAtWorldPoint(sheets, pt)
    if (cota.step === 0) {
      if (!sheet) return
      const group = topGroupAt(sheet, pt)
      if (!group || !group.realMetersPerMm) {
        warn('Calibre a escala do grupo antes de cotar.')
        return
      }
      startCota(sheet.id, group.id, { x: pt.x - sheet.x - group.x, y: pt.y - sheet.y - group.y })
    } else if (cota.step === 1) {
      if (!sheet || !cota.groupId) return
      const group = findGroupById(sheets, cota.groupId)?.group
      if (!group) return
      setCotaP2({ x: pt.x - sheet.x - group.x, y: pt.y - sheet.y - group.y })
    } else if (cota.step === 2) {
      if (!sheet || !cota.groupId) return
      const group = findGroupById(sheets, cota.groupId)?.group
      if (!group) return
      commitCota({ x: pt.x - sheet.x - group.x, y: pt.y - sheet.y - group.y })
    }
  }

  function topGroupAt(sheet: Sheet, worldPt: Point): ImageGroup | null {
    const local = { x: worldPt.x - sheet.x, y: worldPt.y - sheet.y }
    const hits = groupsAtSheetLocalPoint(sheet, local)
    if (hits[0]) return hits[0]
    // Cota/anotação não precisam cair exatamente dentro do frame do grupo (uma linha de nível, por
    // exemplo, costuma passar da borda da imagem) — com um grupo só na prancha não há ambiguidade.
    return sheet.groups.length === 1 ? sheet.groups[0] : null
  }

  function handleCalibrateClick(e: React.MouseEvent) {
    const pt = toWorld(e.clientX, e.clientY)
    const sheet = sheetAtWorldPoint(sheets, pt)
    if (cal.step === 0) {
      if (!sheet) return
      const group = topGroupAt(sheet, pt)
      if (!group) {
        warn('Importe uma imagem nesta prancha antes de calibrar.')
        return
      }
      startCal('group', sheet.id, group.id, null, { x: pt.x - sheet.x - group.x, y: pt.y - sheet.y - group.y })
    } else {
      if (!sheet || !cal.groupId || !cal.p1) return
      const group = findGroupById(sheets, cal.groupId)?.group
      if (!group) return
      const p2 = { x: pt.x - sheet.x - group.x, y: pt.y - sheet.y - group.y }
      const dpaper = Math.hypot(p2.x - cal.p1.x, p2.y - cal.p1.y)
      if (dpaper < 0.5) {
        warn('Escolha dois pontos mais distantes.')
        cancelCal()
        return
      }
      setPrompt({ kind: 'calibrate', sheetId: sheet.id, groupId: cal.groupId, anchor: cal.p1, dpaper, x: e.clientX + 12, y: e.clientY + 12 })
    }
  }

  function handleFitScaleClick(e: React.MouseEvent) {
    const pt = toWorld(e.clientX, e.clientY)
    if (!cal.groupId || !cal.imageId) return
    const found = findGroupById(sheets, cal.groupId)
    if (!found) return
    const { sheet, group } = found
    const local = { x: pt.x - sheet.x - group.x, y: pt.y - sheet.y - group.y }
    if (cal.step === 0) {
      startCal('member', sheet.id, group.id, cal.imageId, local)
    } else {
      if (!cal.p1) return
      const dpaper = Math.hypot(local.x - cal.p1.x, local.y - cal.p1.y)
      if (dpaper < 0.5) {
        warn('Escolha dois pontos mais distantes.')
        cancelCal()
        return
      }
      setPrompt({ kind: 'fitScale', sheetId: sheet.id, groupId: group.id, imageId: cal.imageId, anchor: cal.p1, dpaper, x: e.clientX + 12, y: e.clientY + 12 })
    }
  }

  function handleMarkerClick(e: React.MouseEvent) {
    const pt = toWorld(e.clientX, e.clientY)
    const sheet = sheetAtWorldPoint(sheets, pt)
    if (!sheet) return
    const group = topGroupAt(sheet, pt)
    if (!group) {
      warn('Clique sobre um grupo de imagem.')
      return
    }
    addAnnotation(group.id, { kind: 'marker', pos: { x: pt.x - sheet.x - group.x, y: pt.y - sheet.y - group.y } })
  }

  function handleDraftClick(e: React.MouseEvent) {
    const pt = toWorld(e.clientX, e.clientY)
    const sheet = sheetAtWorldPoint(sheets, pt)
    const draftTool = tool as DraftTool
    if (!draft.tool) {
      if (!sheet) return
      const group = topGroupAt(sheet, pt)
      if (!group) {
        warn('Clique sobre um grupo de imagem.')
        return
      }
      startDraft(draftTool, sheet.id, group.id, { x: pt.x - sheet.x - group.x, y: pt.y - sheet.y - group.y })
      return
    }
    if (!sheet || !draft.groupId) {
      warn('Continue clicando no mesmo grupo onde começou (Esc cancela).')
      return
    }
    const group = findGroupById(sheets, draft.groupId)?.group
    if (!group) return
    const local = { x: pt.x - sheet.x - group.x, y: pt.y - sheet.y - group.y }
    const needed = 2
    const newPoints = [...draft.points, local]
    if (newPoints.length < needed) {
      addDraftPoint(local)
      return
    }
    setPrompt({ kind: 'draftText', draftTool, groupId: draft.groupId, points: newPoints, initial: DRAFT_DEFAULT_TEXT[draftTool], x: e.clientX + 12, y: e.clientY + 12 })
  }

  function handleCalibrateConfirm(meters: number, denom: number) {
    if (prompt?.kind === 'calibrate') {
      const { sheetId, groupId, anchor, dpaper } = prompt
      const { overflow } = calibrateGroup(sheetId, groupId, anchor, dpaper, meters, denom)
      setPrompt(null)
      cancelCal()
      setTool('select')
      select({ type: 'group', id: groupId })
      if (overflow) warn('Nessa escala o grupo ficou maior que a prancha — use uma prancha maior ou uma escala mais afastada (denominador maior).')
      return
    }
    if (prompt?.kind === 'fitScale') {
      const { sheetId, groupId, imageId, anchor, dpaper } = prompt
      fitMemberToGroupScale(sheetId, groupId, imageId, anchor, dpaper, meters)
      setPrompt(null)
      cancelCal()
      setTool('select')
      select({ type: 'member', id: imageId })
    }
  }
  function handleCalibrateCancel() {
    setPrompt(null)
    cancelCal()
  }

  function handleTextConfirm(value: string) {
    if (prompt?.kind === 'dimText') {
      overrideDimText(prompt.dimId, value.trim() === '' ? null : value.trim())
      setPrompt(null)
      return
    }
    if (prompt?.kind === 'annotationText') {
      patchAnnotation(prompt.annId, { text: value.trim() })
      setPrompt(null)
      return
    }
    if (prompt?.kind === 'titleBlock') {
      setTitleBlockField(prompt.sheetId, prompt.field, value.trim())
      setPrompt(null)
      return
    }
    if (prompt?.kind === 'draftText') {
      const { draftTool, groupId, points } = prompt
      const text = value.trim()
      if (draftTool === 'leader') {
        addAnnotation(groupId, { kind: 'leader', anchor: points[0], label: points[1], text })
      } else {
        const [p1, p2] = points
        addAnnotation(groupId, { kind: 'level', y: p1.y, x1: Math.min(p1.x, p2.x), x2: Math.max(p1.x, p2.x), text })
      }
      setPrompt(null)
      cancelDraft()
      return
    }
  }
  function handleTextCancel() {
    if (prompt?.kind === 'draftText') cancelDraft()
    setPrompt(null)
  }

  function handleProjectInfoConfirm(info: ProjectInfo) {
    setProjectInfo(info)
    setPrompt(null)
  }

  // ---------------- sheet tab callbacks ----------------
  function onTabPointerDown(e: React.PointerEvent, sheet: Sheet) {
    if (e.button !== 0) return
    select({ type: 'sheet', id: sheet.id })
    beginMoveSheet(e, sheet)
  }
  function handleTabDelete(sheet: Sheet) {
    if (confirm(`Excluir a prancha "${sheet.name}"? Isso remove todos os grupos, imagens e cotas dela.`)) deleteSheet(sheet.id)
  }

  // ---------------- toolbar callbacks ----------------
  function handleAddSheet(size: SheetSizeKey, orientation: Orientation) {
    const sheet = useProjectStore.getState().addSheet(size, orientation)
    setView(focusOnSheetView(sheet, getRect()))
  }
  function currentImportTarget(): { sheet: Sheet; groupId: string | null } | null {
    if (openGroupId) {
      const found = findGroupById(sheets, openGroupId)
      if (found) return { sheet: found.sheet, groupId: openGroupId }
    }
    if (selection.type === 'sheet') {
      const sheet = sheets.find((s) => s.id === selection.id)
      if (sheet) return { sheet, groupId: null }
    }
    // Grupo/membro/cota/anotação selecionados, mas não "entrados" — ainda dá pra importar como
    // um grupo novo na mesma prancha (só entrar no grupo via duplo clique/Enter mira o import nele).
    if (selection.type === 'group') {
      const found = findGroupById(sheets, selection.id)
      if (found) return { sheet: found.sheet, groupId: null }
    }
    if (selection.type === 'member') {
      const found = findMemberById(sheets, selection.id)
      if (found) return { sheet: found.sheet, groupId: null }
    }
    return null
  }
  function handleImportClick() {
    if (!currentImportTarget()) return
    fileInputRef.current?.click()
  }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const file = input.files?.[0]
    if (!file) return
    const target = currentImportTarget()
    if (!target) {
      input.value = ''
      return
    }
    const { sheet, groupId } = target
    const reader = new FileReader()
    reader.onload = () => {
      const href = reader.result as string
      const img = new Image()
      img.onload = () => {
        let x: number, y: number, w: number, h: number
        if (groupId) {
          const group = findGroupById(sheets, groupId)?.group
          const maxW = group ? group.w * 0.6 : sheet.w * 0.4
          w = maxW
          h = (w * img.naturalHeight) / img.naturalWidth
          x = group ? (group.w - w) / 2 : 0
          y = group ? (group.h - h) / 2 : 0
        } else {
          const maxW = sheet.w * 0.85
          const maxH = sheet.h * 0.85
          w = maxW
          h = (w * img.naturalHeight) / img.naturalWidth
          if (h > maxH) {
            h = maxH
            w = (h * img.naturalWidth) / img.naturalHeight
          }
          // cascata pra não empilhar exatamente em cima de um grupo já existente na prancha
          const cascade = sheet.groups.length * 18
          x = (sheet.w - w) / 2 + cascade
          y = (sheet.h - h) / 2 + cascade
        }
        importImage(sheet.id, groupId, { href, natW: img.naturalWidth, natH: img.naturalHeight, x, y, w, h })
      }
      img.src = href
    }
    reader.readAsDataURL(file)
    input.value = ''
  }
  function handleFit() {
    setView(fitToContentView(sheets, getRect()))
  }
  function handleZoomIn() {
    const v = view
    setView({ ...v, zoom: Math.min(10, v.zoom * 1.25) })
  }
  function handleZoomOut() {
    const v = view
    setView({ ...v, zoom: Math.max(0.15, v.zoom / 1.25) })
  }
  function handleRename(sheet: Sheet, name: string) {
    renameSheet(sheet.id, name)
  }
  function handleEditProject() {
    setPrompt({ kind: 'projectInfo', x: 140, y: 70 })
  }
  async function handleExportPdf() {
    try {
      const { exportPdf } = await import('../lib/pdfExport')
      await exportPdf(sheets, project)
    } catch {
      warn('Não foi possível gerar o PDF.')
    }
  }
  async function handleExportProject() {
    try {
      const { exportProjectZip } = await import('../lib/projectFile')
      await exportProjectZip(sheets, project)
    } catch {
      warn('Não foi possível exportar o projeto.')
    }
  }
  function handleImportProjectClick() {
    projectFileInputRef.current?.click()
  }
  async function handleProjectFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (sheets.length && !confirm('Importar um projeto substitui tudo o que está aberto agora. Continuar?')) return
    try {
      const { importProjectZip } = await import('../lib/projectFile')
      const { sheets: newSheets, project: newProject } = await importProjectZip(file)
      useProjectStore.getState().loadProject(newSheets, newProject)
    } catch {
      warn('Não foi possível importar: arquivo inválido.')
    }
  }

  const zoomPercent = Math.round((view.zoom / 2.6) * 100)
  const canImport = !!currentImportTarget()

  return (
    <div id="app">
      <Toolbar
        onAddSheet={handleAddSheet}
        onImportClick={handleImportClick}
        canImport={canImport}
        onFit={handleFit}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        zoomPercent={zoomPercent}
        onEditProject={handleEditProject}
        onExportPdf={handleExportPdf}
        onExportProject={handleExportProject}
        onImportProjectClick={handleImportProjectClick}
        onShowTips={() => setShowTips(true)}
      />
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" hidden onChange={handleFileChange} />
      <input ref={projectFileInputRef} type="file" accept=".zip" hidden onChange={handleProjectFileChange} />

      <div id="canvasWrap" ref={canvasWrapRef} className={tool !== 'select' ? 'tool-draw' : ''}>
        <svg id="stage" ref={svgRef} onPointerDown={onStagePointerDown} onClick={onStageClick} onContextMenu={(e) => e.preventDefault()}>
          <g transform={`translate(${view.panX} ${view.panY}) scale(${view.zoom})`}>
            {sheets.map((sheet, i) => (
              <SheetView
                key={sheet.id}
                sheet={sheet}
                tool={tool}
                selection={selection}
                multiSelection={multiSelection}
                openGroupId={openGroupId}
                cota={cota}
                cal={cal}
                draft={draft}
                crop={crop}
                project={project}
                sheetNumber={i + 1}
                sheetTotal={sheets.length}
                handlers={{
                  onGroupPointerDown,
                  onGroupHandlePointerDown,
                  onGroupDoubleClick,
                  onGroupContextMenu,
                  onMemberPointerDown,
                  onMemberHandlePointerDown,
                  onMemberContextMenu,
                  onDimPointerDown,
                  onDimDoubleClick,
                  onAnnotationPrimaryDown,
                  onAnnotationSecondaryDown,
                  onAnnotationDoubleClick,
                  onTitleBlockEdit,
                  onCropVertexPointerDown,
                  onCropVertexDoubleClick,
                  onCropEdgeClick,
                }}
              />
            ))}
          </g>
        </svg>

        <div id="overlays">
          {sheets.map((sheet) => (
            <SheetTab
              key={sheet.id}
              sheet={sheet}
              view={view}
              selected={
                (selection.type === 'sheet' && selection.id === sheet.id) ||
                sheet.groups.some((g) => (selection.type === 'group' && selection.id === g.id) || (selection.type === 'member' && g.images.some((im) => im.id === selection.id)) || (selection.type === 'dim' && g.dims.some((d) => d.id === selection.id)) || (selection.type === 'annotation' && g.annotations.some((a) => a.id === selection.id)))
              }
              onPointerDown={onTabPointerDown}
              onRename={handleRename}
              onDelete={handleTabDelete}
            />
          ))}
          {marquee && (
            <div
              className="marquee-box"
              style={{
                left: Math.min(marquee.x1, marquee.x2),
                top: Math.min(marquee.y1, marquee.y2),
                width: Math.abs(marquee.x2 - marquee.x1),
                height: Math.abs(marquee.y2 - marquee.y1),
                borderStyle: marquee.x2 >= marquee.x1 ? 'solid' : 'dashed',
              }}
            />
          )}
        </div>

        {sheets.length === 0 && (
          <div className="empty-hint">
            Crie sua primeira prancha em <b>+ Prancha</b>, acima.
          </div>
        )}
      </div>

      <StatusBar warning={warning} coords={coords} />

      {prompt?.kind === 'calibrate' && <CalibratePrompt mode="group" x={prompt.x} y={prompt.y} onConfirm={handleCalibrateConfirm} onCancel={handleCalibrateCancel} />}
      {prompt?.kind === 'fitScale' && <CalibratePrompt mode="member" x={prompt.x} y={prompt.y} onConfirm={handleCalibrateConfirm} onCancel={handleCalibrateCancel} />}
      {(prompt?.kind === 'dimText' || prompt?.kind === 'annotationText' || prompt?.kind === 'titleBlock' || prompt?.kind === 'draftText') && (
        <TextPrompt x={prompt.x} y={prompt.y} initial={prompt.initial} onConfirm={handleTextConfirm} onCancel={handleTextCancel} />
      )}
      {prompt?.kind === 'projectInfo' && <ProjectInfoPrompt x={prompt.x} y={prompt.y} initial={project} onConfirm={handleProjectInfoConfirm} onCancel={() => setPrompt(null)} />}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
      {crop && (
        <div className="crop-hint">
          Clique pra adicionar pontos ao recorte (mínimo 3) · Enter ou clique fora confirma · Esc cancela
          {crop.points.length >= 3 && (
            <button className="ok" onClick={commitCrop}>
              Concluir recorte
            </button>
          )}
        </div>
      )}
      {showTips && <TipsModal onClose={closeTips} />}
    </div>
  )
}
