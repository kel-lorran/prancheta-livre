import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { fitToContentView, focusOnSheetView, screenToWorld, sheetAtWorldPoint } from '../lib/viewMath'
import { formatDimText, perpendicularOffset } from '../lib/dimGeometry'
import { loadPersistedProject, saveProject } from '../lib/persistence'
import type { DraftTool, Orientation, Point, ProjectInfo, Sheet, SheetSizeKey } from '../types'
import { SheetView, type Corner } from './SheetView'
import { SheetTab } from './SheetTab'
import { CalibratePrompt } from './CalibratePrompt'
import { TextPrompt } from './TextPrompt'
import { ProjectInfoPrompt } from './ProjectInfoPrompt'
import { Toolbar } from './Toolbar'
import { StatusBar } from './StatusBar'

interface DragHandle {
  moved: boolean
  startX: number
  startY: number
  onMove: (e: PointerEvent) => void
  onEnd?: (e: PointerEvent) => void
}

type PendingPrompt =
  | { kind: 'calibrate'; sheetId: string; anchor: Point; dpaper: number; x: number; y: number }
  | { kind: 'dimText'; sheetId: string; dimId: string; initial: string; x: number; y: number }
  | { kind: 'annotationText'; sheetId: string; annId: string; initial: string; x: number; y: number }
  | { kind: 'draftText'; draftTool: DraftTool; sheetId: string; points: Point[]; initial: string; x: number; y: number }
  | { kind: 'titleBlock'; sheetId: string; field: 'sheetTitle' | 'date' | 'revision'; initial: string; x: number; y: number }
  | { kind: 'projectInfo'; x: number; y: number }
  | null

const DRAFT_DEFAULT_TEXT: Record<DraftTool, string> = { leader: '', level: '0,00', callout: 'DETALHE A' }

export function Canvas() {
  const svgRef = useRef<SVGSVGElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projectFileInputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<DragHandle | null>(null)
  const suppressClickRef = useRef(false)
  const warnTimerRef = useRef<number | undefined>(undefined)

  const sheets = useProjectStore((s) => s.sheets)
  const project = useProjectStore((s) => s.project)
  const selection = useProjectStore((s) => s.selection)
  const tool = useProjectStore((s) => s.tool)
  const cota = useProjectStore((s) => s.cota)
  const cal = useProjectStore((s) => s.cal)
  const draft = useProjectStore((s) => s.draft)
  const view = useProjectStore((s) => s.view)

  const setSheetPos = useProjectStore((s) => s.setSheetPos)
  const setImage = useProjectStore((s) => s.setImage)
  const setImageRect = useProjectStore((s) => s.setImageRect)
  const calibrateImage = useProjectStore((s) => s.calibrateImage)
  const toggleImageLock = useProjectStore((s) => s.toggleImageLock)
  const deleteSheet = useProjectStore((s) => s.deleteSheet)
  const renameSheet = useProjectStore((s) => s.renameSheet)
  const select = useProjectStore((s) => s.select)
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
  const cancelCal = useProjectStore((s) => s.cancelCal)
  const startDraft = useProjectStore((s) => s.startDraft)
  const addDraftPoint = useProjectStore((s) => s.addDraftPoint)
  const cancelDraft = useProjectStore((s) => s.cancelDraft)
  const setView = useProjectStore((s) => s.setView)
  const seedSample = useProjectStore((s) => s.seedSample)

  const [warning, setWarning] = useState<string | null>(null)
  const [coords, setCoords] = useState('')
  const [prompt, setPrompt] = useState<PendingPrompt>(null)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        if (state.tool === 'cota' && state.cota.step === 2 && state.cota.sheetId && state.cota.resolvedMode && state.cota.p1 && state.cota.p2) {
          const sheet = state.sheets.find((s) => s.id === state.cota.sheetId)
          if (sheet) {
            const pt = toWorld(e.clientX, e.clientY)
            state.setCotaPreviewOffset({ x: pt.x - sheet.x, y: pt.y - sheet.y })
          }
        }
        if (state.tool === 'calibrate' && state.cal.step === 1 && state.cal.sheetId) {
          const sheet = state.sheets.find((s) => s.id === state.cal.sheetId)
          if (sheet) {
            const pt = toWorld(e.clientX, e.clientY)
            state.setCalPreview({ x: pt.x - sheet.x, y: pt.y - sheet.y })
          }
        }
        if ((state.tool === 'leader' || state.tool === 'level' || state.tool === 'callout') && state.draft.tool && state.draft.sheetId) {
          const sheet = state.sheets.find((s) => s.id === state.draft.sheetId)
          if (sheet) {
            const pt = toWorld(e.clientX, e.clientY)
            state.setDraftPreview({ x: pt.x - sheet.x, y: pt.y - sheet.y })
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
      if (e.key === 'Escape') {
        state.cancelCota()
        state.cancelCal()
        state.cancelDraft()
        state.select({ type: null, id: null })
        setPrompt(null)
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
    const sel = state.selection
    if (sel.type === 'dim') {
      const sheet = state.sheets.find((s) => s.dims.some((d) => d.id === sel.id))
      if (sheet) state.deleteDim(sheet.id, sel.id)
    } else if (sel.type === 'annotation') {
      const sheet = state.sheets.find((s) => s.annotations.some((a) => a.id === sel.id))
      if (sheet) state.deleteAnnotation(sheet.id, sel.id)
    } else if (sel.type === 'image') {
      if (confirm('Remover a imagem desta prancha? As cotas associadas também serão removidas.')) {
        state.deleteImage(sel.id)
        state.select({ type: 'sheet', id: sel.id })
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

  function beginMoveImage(e: React.PointerEvent, sheet: Sheet) {
    if (!sheet.image) return
    useProjectStore.getState().commitHistory()
    const start = toWorld(e.clientX, e.clientY)
    const orig = { x: sheet.image.x, y: sheet.image.y }
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      onMove(ev) {
        const cur = toWorld(ev.clientX, ev.clientY)
        setImageRect(sheet.id, { x: orig.x + (cur.x - start.x), y: orig.y + (cur.y - start.y) })
      },
    }
  }

  function beginResize(e: React.PointerEvent, sheet: Sheet, corner: Corner) {
    const im = sheet.image
    if (!im) return
    useProjectStore.getState().commitHistory()
    const orig = { x: im.x, y: im.y, w: im.w, h: im.h }
    const anchor =
      corner === 'nw'
        ? { x: orig.x + orig.w, y: orig.y + orig.h }
        : corner === 'ne'
          ? { x: orig.x, y: orig.y + orig.h }
          : corner === 'sw'
            ? { x: orig.x + orig.w, y: orig.y }
            : { x: orig.x, y: orig.y }
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
        setImageRect(sheet.id, { x, y, w: neww, h: newh })
      },
    }
  }

  function beginAdjustDim(e: React.PointerEvent, sheet: Sheet, dimId: string) {
    const dim = sheet.dims.find((d) => d.id === dimId)
    if (!dim) return
    useProjectStore.getState().commitHistory()
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      onMove(ev) {
        const cur = toWorld(ev.clientX, ev.clientY)
        const offset = perpendicularOffset(dim.mode, dim.p1, dim.p2, { x: cur.x - sheet.x, y: cur.y - sheet.y })
        adjustDimOffset(sheet.id, dimId, offset || 0.001)
      },
    }
  }

  function beginDragField(e: React.PointerEvent, sheet: Sheet, annId: string, build: (dx: number, dy: number) => Record<string, unknown>) {
    useProjectStore.getState().commitHistory()
    const start = toWorld(e.clientX, e.clientY)
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      onMove(ev) {
        const cur = toWorld(ev.clientX, ev.clientY)
        patchAnnotation(sheet.id, annId, build(cur.x - start.x, cur.y - start.y))
      },
    }
  }

  // ---------------- pointer/click routing ----------------
  function onStagePointerDown(e: React.PointerEvent) {
    if (e.button === 1) {
      e.preventDefault()
      beginPan(e)
      return
    }
    if (e.button !== 0 || tool !== 'select') return
    beginPan(e)
  }

  function onImagePointerDown(e: React.PointerEvent, sheet: Sheet) {
    if (e.button !== 0 || tool !== 'select') return
    e.stopPropagation()
    suppressClickRef.current = true
    select({ type: 'image', id: sheet.id })
    beginMoveImage(e, sheet)
  }
  function onHandlePointerDown(e: React.PointerEvent, sheet: Sheet, corner: Corner) {
    if (e.button !== 0 || tool !== 'select') return
    e.stopPropagation()
    suppressClickRef.current = true
    beginResize(e, sheet, corner)
  }
  function onDimPointerDown(e: React.PointerEvent, sheet: Sheet, dimId: string) {
    if (e.button !== 0 || tool !== 'select') return
    e.stopPropagation()
    suppressClickRef.current = true
    select({ type: 'dim', id: dimId })
    beginAdjustDim(e, sheet, dimId)
  }
  function onDimDoubleClick(e: React.MouseEvent, sheet: Sheet, dimId: string) {
    if (tool !== 'select') return
    e.stopPropagation()
    const dim = sheet.dims.find((d) => d.id === dimId)
    if (!dim) return
    select({ type: 'dim', id: dimId })
    const current = formatDimText(dim, sheet.image?.realMetersPerMm ?? null)
    setPrompt({ kind: 'dimText', sheetId: sheet.id, dimId, initial: current, x: e.clientX - 40, y: e.clientY - 40 })
  }

  function onAnnotationPrimaryDown(e: React.PointerEvent, sheet: Sheet, annId: string) {
    if (e.button !== 0 || tool !== 'select') return
    e.stopPropagation()
    suppressClickRef.current = true
    select({ type: 'annotation', id: annId })
    const ann = sheet.annotations.find((a) => a.id === annId)
    if (!ann) return
    if (ann.kind === 'marker') {
      const orig = ann.pos
      beginDragField(e, sheet, annId, (dx, dy) => ({ pos: { x: orig.x + dx, y: orig.y + dy } }))
    } else if (ann.kind === 'leader') {
      const orig = ann.anchor
      beginDragField(e, sheet, annId, (dx, dy) => ({ anchor: { x: orig.x + dx, y: orig.y + dy } }))
    } else if (ann.kind === 'level') {
      const origY = ann.y
      beginDragField(e, sheet, annId, (_dx, dy) => ({ y: origY + dy }))
    } else if (ann.kind === 'callout') {
      const orig = ann.rect
      beginDragField(e, sheet, annId, (dx, dy) => ({ rect: { ...orig, x: orig.x + dx, y: orig.y + dy } }))
    }
  }
  function onAnnotationSecondaryDown(e: React.PointerEvent, sheet: Sheet, annId: string) {
    if (e.button !== 0 || tool !== 'select') return
    e.stopPropagation()
    suppressClickRef.current = true
    select({ type: 'annotation', id: annId })
    const ann = sheet.annotations.find((a) => a.id === annId)
    if (!ann) return
    if (ann.kind === 'leader') {
      const orig = ann.label
      beginDragField(e, sheet, annId, (dx, dy) => ({ label: { x: orig.x + dx, y: orig.y + dy } }))
    } else if (ann.kind === 'callout') {
      const orig = ann.targetPos
      beginDragField(e, sheet, annId, (dx, dy) => ({ targetPos: { x: orig.x + dx, y: orig.y + dy } }))
    }
  }
  function onAnnotationDoubleClick(e: React.MouseEvent, sheet: Sheet, annId: string) {
    if (tool !== 'select') return
    e.stopPropagation()
    const ann = sheet.annotations.find((a) => a.id === annId)
    if (!ann || ann.kind === 'marker') return
    select({ type: 'annotation', id: annId })
    setPrompt({ kind: 'annotationText', sheetId: sheet.id, annId, initial: ann.text, x: e.clientX - 40, y: e.clientY - 40 })
  }

  function onTitleBlockEdit(e: React.MouseEvent, sheet: Sheet, field: 'sheetTitle' | 'date' | 'revision', current: string) {
    e.stopPropagation()
    setPrompt({ kind: 'titleBlock', sheetId: sheet.id, field, initial: current, x: e.clientX - 40, y: e.clientY - 40 })
  }

  function onStageClick(e: React.MouseEvent) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
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
    if (tool === 'marker') {
      handleMarkerClick(e)
      return
    }
    if (tool === 'leader' || tool === 'level' || tool === 'callout') {
      handleDraftClick(e)
      return
    }
    const pt = toWorld(e.clientX, e.clientY)
    const sheet = sheetAtWorldPoint(sheets, pt)
    select(sheet ? { type: 'sheet', id: sheet.id } : { type: null, id: null })
  }

  function handleCotaClick(e: React.MouseEvent) {
    const pt = toWorld(e.clientX, e.clientY)
    const sheet = sheetAtWorldPoint(sheets, pt)
    if (cota.step === 0) {
      if (!sheet) return
      if (!sheet.image || !sheet.image.realMetersPerMm) {
        warn('Calibre a escala da imagem desta prancha antes de cotar.')
        return
      }
      startCota(sheet.id, { x: pt.x - sheet.x, y: pt.y - sheet.y })
    } else if (cota.step === 1) {
      if (!sheet || sheet.id !== cota.sheetId) return
      setCotaP2({ x: pt.x - sheet.x, y: pt.y - sheet.y })
    } else if (cota.step === 2) {
      if (!sheet || sheet.id !== cota.sheetId) return
      commitCota({ x: pt.x - sheet.x, y: pt.y - sheet.y })
    }
  }

  function handleCalibrateClick(e: React.MouseEvent) {
    const pt = toWorld(e.clientX, e.clientY)
    const sheet = sheetAtWorldPoint(sheets, pt)
    if (cal.step === 0) {
      if (!sheet) return
      if (!sheet.image) {
        warn('Importe uma imagem nesta prancha antes de calibrar.')
        return
      }
      startCal(sheet.id, { x: pt.x - sheet.x, y: pt.y - sheet.y })
    } else {
      if (!sheet || sheet.id !== cal.sheetId || !cal.p1) return
      const p2 = { x: pt.x - sheet.x, y: pt.y - sheet.y }
      const dpaper = Math.hypot(p2.x - cal.p1.x, p2.y - cal.p1.y)
      if (dpaper < 0.5) {
        warn('Escolha dois pontos mais distantes.')
        cancelCal()
        return
      }
      setPrompt({ kind: 'calibrate', sheetId: sheet.id, anchor: cal.p1, dpaper, x: e.clientX + 12, y: e.clientY + 12 })
    }
  }

  function handleMarkerClick(e: React.MouseEvent) {
    const pt = toWorld(e.clientX, e.clientY)
    const sheet = sheetAtWorldPoint(sheets, pt)
    if (!sheet) return
    addAnnotation(sheet.id, { kind: 'marker', pos: { x: pt.x - sheet.x, y: pt.y - sheet.y } })
  }

  function handleDraftClick(e: React.MouseEvent) {
    const pt = toWorld(e.clientX, e.clientY)
    const sheet = sheetAtWorldPoint(sheets, pt)
    const draftTool = tool as DraftTool
    if (!draft.tool) {
      if (!sheet) return
      startDraft(draftTool, sheet.id, { x: pt.x - sheet.x, y: pt.y - sheet.y })
      return
    }
    if (!sheet || sheet.id !== draft.sheetId) {
      warn('Continue clicando na mesma prancha onde começou (Esc cancela).')
      return
    }
    const local = { x: pt.x - sheet.x, y: pt.y - sheet.y }
    const needed = draftTool === 'callout' ? 3 : 2
    const newPoints = [...draft.points, local]
    if (newPoints.length < needed) {
      addDraftPoint(local)
      return
    }
    setPrompt({ kind: 'draftText', draftTool, sheetId: sheet.id, points: newPoints, initial: DRAFT_DEFAULT_TEXT[draftTool], x: e.clientX + 12, y: e.clientY + 12 })
  }

  function handleCalibrateConfirm(meters: number, denom: number) {
    if (prompt?.kind !== 'calibrate') return
    const { sheetId, anchor, dpaper } = prompt
    const { overflow } = calibrateImage(sheetId, anchor, dpaper, meters, denom)
    setPrompt(null)
    cancelCal()
    setTool('select')
    select({ type: 'image', id: sheetId })
    if (overflow) {
      warn('Nessa escala a imagem ficou maior que a prancha — use uma prancha maior ou uma escala mais afastada (denominador maior).')
    }
  }
  function handleCalibrateCancel() {
    setPrompt(null)
    cancelCal()
  }

  function handleTextConfirm(value: string) {
    if (prompt?.kind === 'dimText') {
      overrideDimText(prompt.sheetId, prompt.dimId, value.trim() === '' ? null : value.trim())
      setPrompt(null)
      return
    }
    if (prompt?.kind === 'annotationText') {
      patchAnnotation(prompt.sheetId, prompt.annId, { text: value.trim() })
      setPrompt(null)
      return
    }
    if (prompt?.kind === 'titleBlock') {
      setTitleBlockField(prompt.sheetId, prompt.field, value.trim())
      setPrompt(null)
      return
    }
    if (prompt?.kind === 'draftText') {
      const { draftTool, sheetId, points } = prompt
      const text = value.trim()
      if (draftTool === 'leader') {
        addAnnotation(sheetId, { kind: 'leader', anchor: points[0], label: points[1], text })
      } else if (draftTool === 'level') {
        const [p1, p2] = points
        addAnnotation(sheetId, { kind: 'level', y: p1.y, x1: Math.min(p1.x, p2.x), x2: Math.max(p1.x, p2.x), text })
      } else {
        const [p1, p2, p3] = points
        const rect = { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y) }
        addAnnotation(sheetId, { kind: 'callout', rect, targetPos: p3, text })
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
    if (confirm(`Excluir a prancha "${sheet.name}"? Isso remove a imagem e todas as cotas dela.`)) deleteSheet(sheet.id)
  }
  function handleToggleLock(sheet: Sheet) {
    if (sheet.image?.locked) {
      if (confirm('Destravar a imagem permite reposicioná-la e invalida a calibração de escala e as cotas desta prancha. Continuar?')) {
        toggleImageLock(sheet.id)
        select({ type: 'image', id: sheet.id })
      }
    } else {
      toggleImageLock(sheet.id)
    }
  }

  // ---------------- toolbar callbacks ----------------
  function handleAddSheet(size: SheetSizeKey, orientation: Orientation) {
    const sheet = useProjectStore.getState().addSheet(size, orientation)
    setView(focusOnSheetView(sheet, getRect()))
  }
  function handleImportClick() {
    if (selection.type !== 'sheet') return
    fileInputRef.current?.click()
  }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const file = input.files?.[0]
    if (!file) return
    const sheet = sheets.find((s) => s.id === selection.id)
    if (!sheet) {
      input.value = ''
      return
    }
    const doImport = () => {
      const reader = new FileReader()
      reader.onload = () => {
        const href = reader.result as string
        const img = new Image()
        img.onload = () => {
          const maxW = sheet.w * 0.85
          const maxH = sheet.h * 0.85
          let w = maxW
          let h = (w * img.naturalHeight) / img.naturalWidth
          if (h > maxH) {
            h = maxH
            w = (h * img.naturalWidth) / img.naturalHeight
          }
          setImage(sheet.id, {
            href,
            natW: img.naturalWidth,
            natH: img.naturalHeight,
            x: (sheet.w - w) / 2,
            y: (sheet.h - h) / 2,
            w,
            h,
            locked: false,
            realMetersPerMm: null,
          })
          select({ type: 'image', id: sheet.id })
        }
        img.src = href
      }
      reader.readAsDataURL(file)
    }
    if (sheet.image) {
      if (confirm('Esta prancha já tem uma imagem. Substituir? As cotas existentes serão removidas.')) doImport()
    } else {
      doImport()
    }
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

  return (
    <div id="app">
      <Toolbar
        onAddSheet={handleAddSheet}
        onImportClick={handleImportClick}
        onFit={handleFit}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        zoomPercent={zoomPercent}
        onEditProject={handleEditProject}
        onExportPdf={handleExportPdf}
        onExportProject={handleExportProject}
        onImportProjectClick={handleImportProjectClick}
      />
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" hidden onChange={handleFileChange} />
      <input ref={projectFileInputRef} type="file" accept=".zip" hidden onChange={handleProjectFileChange} />

      <div id="canvasWrap" ref={canvasWrapRef} className={tool !== 'select' ? 'tool-draw' : ''}>
        <svg id="stage" ref={svgRef} onPointerDown={onStagePointerDown} onClick={onStageClick}>
          <g transform={`translate(${view.panX} ${view.panY}) scale(${view.zoom})`}>
            {sheets.map((sheet, i) => (
              <SheetView
                key={sheet.id}
                sheet={sheet}
                tool={tool}
                selection={selection}
                cota={cota}
                cal={cal}
                draft={draft}
                project={project}
                sheetNumber={i + 1}
                sheetTotal={sheets.length}
                handlers={{
                  onImagePointerDown,
                  onHandlePointerDown,
                  onDimPointerDown,
                  onDimDoubleClick,
                  onAnnotationPrimaryDown,
                  onAnnotationSecondaryDown,
                  onAnnotationDoubleClick,
                  onTitleBlockEdit,
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
                (selection.type === 'image' && selection.id === sheet.id) ||
                (selection.type === 'dim' && sheet.dims.some((d) => d.id === selection.id)) ||
                (selection.type === 'annotation' && sheet.annotations.some((a) => a.id === selection.id))
              }
              onPointerDown={onTabPointerDown}
              onRename={handleRename}
              onDelete={handleTabDelete}
              onToggleLock={handleToggleLock}
            />
          ))}
        </div>

        {sheets.length === 0 && (
          <div className="empty-hint">
            Crie sua primeira prancha em <b>+ Prancha</b>, acima.
          </div>
        )}
      </div>

      <StatusBar warning={warning} coords={coords} />

      {prompt?.kind === 'calibrate' && <CalibratePrompt x={prompt.x} y={prompt.y} onConfirm={handleCalibrateConfirm} onCancel={handleCalibrateCancel} />}
      {(prompt?.kind === 'dimText' || prompt?.kind === 'annotationText' || prompt?.kind === 'titleBlock' || prompt?.kind === 'draftText') && (
        <TextPrompt x={prompt.x} y={prompt.y} initial={prompt.initial} onConfirm={handleTextConfirm} onCancel={handleTextCancel} />
      )}
      {prompt?.kind === 'projectInfo' && <ProjectInfoPrompt x={prompt.x} y={prompt.y} initial={project} onConfirm={handleProjectInfoConfirm} onCancel={() => setPrompt(null)} />}
    </div>
  )
}
