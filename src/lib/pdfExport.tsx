import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'
import type { CalState, CotaState, DraftState, ProjectInfo, Sheet } from '../types'
import { SheetView, type SheetHandlers } from '../components/SheetView'

const IDLE_COTA: CotaState = { step: 0, sheetId: null, p1: null, p2: null, resolvedMode: null, previewOffset: null }
const IDLE_CAL: CalState = { step: 0, sheetId: null, p1: null, preview: null }
const IDLE_DRAFT: DraftState = { tool: null, sheetId: null, points: [], preview: null }
const NOOP_HANDLERS: SheetHandlers = {
  onImagePointerDown: () => {},
  onHandlePointerDown: () => {},
  onDimPointerDown: () => {},
  onDimDoubleClick: () => {},
  onAnnotationPrimaryDown: () => {},
  onAnnotationSecondaryDown: () => {},
  onAnnotationDoubleClick: () => {},
  onTitleBlockEdit: () => {},
}

const SVGNS = 'http://www.w3.org/2000/svg'

function renderSheetSvg(sheet: Sheet, project: ProjectInfo, sheetNumber: number, sheetTotal: number): { svgEl: SVGSVGElement; cleanup: () => void } {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-100000px'
  container.style.top = '0'
  document.body.appendChild(container)

  const svgEl = document.createElementNS(SVGNS, 'svg') as SVGSVGElement
  svgEl.setAttribute('width', String(sheet.w))
  svgEl.setAttribute('height', String(sheet.h))
  svgEl.setAttribute('viewBox', `0 0 ${sheet.w} ${sheet.h}`)
  container.appendChild(svgEl)

  const root = createRoot(svgEl)
  flushSync(() => {
    root.render(
      <SheetView
        sheet={{ ...sheet, x: 0, y: 0 }}
        tool="select"
        selection={{ type: null, id: null }}
        cota={IDLE_COTA}
        cal={IDLE_CAL}
        draft={IDLE_DRAFT}
        project={project}
        sheetNumber={sheetNumber}
        sheetTotal={sheetTotal}
        handlers={NOOP_HANDLERS}
      />,
    )
  })

  return {
    svgEl,
    cleanup() {
      root.unmount()
      container.remove()
    },
  }
}

function fileSlug(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'prancheta-livre'
}

export async function exportPdf(sheets: Sheet[], project: ProjectInfo): Promise<void> {
  if (!sheets.length) return
  let pdf: jsPDF | null = null
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i]
    const orientation = sheet.w >= sheet.h ? 'landscape' : 'portrait'
    if (!pdf) {
      pdf = new jsPDF({ unit: 'mm', format: [sheet.w, sheet.h], orientation })
    } else {
      pdf.addPage([sheet.w, sheet.h], orientation)
    }
    const { svgEl, cleanup } = renderSheetSvg(sheet, project, i + 1, sheets.length)
    try {
      await svg2pdf(svgEl, pdf, { x: 0, y: 0, width: sheet.w, height: sheet.h })
    } finally {
      cleanup()
    }
  }
  pdf!.save(`${fileSlug(project.name)}.pdf`)
}
