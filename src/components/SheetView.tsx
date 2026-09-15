import type React from 'react'
import { dimGeometry } from '../lib/dimGeometry'
import type { CalState, CotaState, DimGeometryMode, DraftState, ProjectInfo, Selection, Sheet, ToolName } from '../types'
import { DimensionView } from './DimensionView'
import { AnnotationView } from './AnnotationView'
import { TitleBlock } from './TitleBlock'

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

export interface SheetHandlers {
  onImagePointerDown: (e: React.PointerEvent, sheet: Sheet) => void
  onHandlePointerDown: (e: React.PointerEvent, sheet: Sheet, corner: Corner) => void
  onDimPointerDown: (e: React.PointerEvent, sheet: Sheet, dimId: string) => void
  onDimDoubleClick: (e: React.MouseEvent, sheet: Sheet, dimId: string) => void
  onAnnotationPrimaryDown: (e: React.PointerEvent, sheet: Sheet, annId: string) => void
  onAnnotationSecondaryDown: (e: React.PointerEvent, sheet: Sheet, annId: string) => void
  onAnnotationDoubleClick: (e: React.MouseEvent, sheet: Sheet, annId: string) => void
  onTitleBlockEdit: (e: React.MouseEvent, sheet: Sheet, field: 'sheetTitle' | 'date' | 'revision', current: string) => void
}

interface Props {
  sheet: Sheet
  tool: ToolName
  selection: Selection
  cota: CotaState
  cal: CalState
  draft: DraftState
  project: ProjectInfo
  sheetNumber: number
  sheetTotal: number
  handlers: SheetHandlers
}

export function SheetView({ sheet, tool, selection, cota, cal, draft, project, sheetNumber, sheetTotal, handlers }: Props) {
  const clipId = `clip-${sheet.id}`
  const isSheetSelected = selection.type === 'sheet' && selection.id === sheet.id
  const isImageSelected = selection.type === 'image' && selection.id === sheet.id
  const im = sheet.image
  let markerIndex = -1

  return (
    <g transform={`translate(${sheet.x} ${sheet.y})`} data-testid="sheet-group" data-sheet-id={sheet.id}>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={sheet.w} height={sheet.h} />
        </clipPath>
      </defs>

      <rect
        x={0}
        y={0}
        width={sheet.w}
        height={sheet.h}
        fill="var(--paper)"
        stroke={isSheetSelected ? 'var(--accent)' : '#8b93a3'}
        strokeWidth={isSheetSelected ? 0.9 : 0.5}
        vectorEffect="non-scaling-stroke"
        style={{ filter: 'drop-shadow(0 1px 6px rgba(0,0,0,.18))', cursor: tool === 'select' ? undefined : 'crosshair' }}
        data-testid="sheet-paper"
      />

      <g clipPath={`url(#${clipId})`}>
        {im && (
          <>
            <image
              href={im.href}
              x={im.x}
              y={im.y}
              width={im.w}
              height={im.h}
              preserveAspectRatio="none"
              style={{ cursor: tool === 'select' ? 'move' : 'crosshair' }}
              onPointerDown={(e) => handlers.onImagePointerDown(e, sheet)}
            />
            {isImageSelected && (
              <>
                <rect
                  x={im.x}
                  y={im.y}
                  width={im.w}
                  height={im.h}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={0.6}
                  strokeDasharray="2,1.4"
                  vectorEffect="non-scaling-stroke"
                />
                {!im.locked &&
                  (
                    [
                      [im.x, im.y, 'nw'],
                      [im.x + im.w, im.y, 'ne'],
                      [im.x, im.y + im.h, 'sw'],
                      [im.x + im.w, im.y + im.h, 'se'],
                    ] as [number, number, Corner][]
                  ).map(([hx, hy, corner]) => {
                    const hs = 3.2
                    return (
                      <rect
                        key={corner}
                        x={hx - hs / 2}
                        y={hy - hs / 2}
                        width={hs}
                        height={hs}
                        fill="var(--bg-elevated)"
                        stroke="var(--accent)"
                        strokeWidth={0.6}
                        vectorEffect="non-scaling-stroke"
                        style={{ cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize' }}
                        data-corner={corner}
                        onPointerDown={(e) => handlers.onHandlePointerDown(e, sheet, corner)}
                      />
                    )
                  })}
              </>
            )}
          </>
        )}

        {sheet.dims.map((d) => (
          <DimensionView
            key={d.id}
            sheetId={sheet.id}
            dim={d}
            realMetersPerMm={im?.realMetersPerMm ?? null}
            selected={selection.type === 'dim' && selection.id === d.id}
            onPointerDownLine={(e) => handlers.onDimPointerDown(e, sheet, d.id)}
            onDoubleClick={(e) => handlers.onDimDoubleClick(e, sheet, d.id)}
          />
        ))}

        {sheet.annotations.map((a) => {
          if (a.kind === 'marker') markerIndex++
          return (
            <AnnotationView
              key={a.id}
              ann={a}
              index={a.kind === 'marker' ? markerIndex : 0}
              selected={selection.type === 'annotation' && selection.id === a.id}
              onPointerDownPrimary={(e) => handlers.onAnnotationPrimaryDown(e, sheet, a.id)}
              onPointerDownSecondary={(e) => handlers.onAnnotationSecondaryDown(e, sheet, a.id)}
              onDoubleClick={(e) => handlers.onAnnotationDoubleClick(e, sheet, a.id)}
            />
          )
        })}
      </g>

      <TitleBlock
        sheet={sheet}
        project={project}
        sheetNumber={sheetNumber}
        sheetTotal={sheetTotal}
        onEditField={(e, field, current) => handlers.onTitleBlockEdit(e, sheet, field, current)}
      />

      {tool === 'cota' && cota.sheetId === sheet.id && <CotaPreview cota={cota} />}
      {tool === 'calibrate' && cal.sheetId === sheet.id && <CalPreview cal={cal} />}
      {draft.sheetId === sheet.id && <DraftPreview draft={draft} />}
    </g>
  )
}

function CotaPreview({ cota }: { cota: CotaState }) {
  if (!cota.p1) return null
  return (
    <g opacity={0.85}>
      <circle cx={cota.p1.x} cy={cota.p1.y} r={1.4} fill="var(--accent)" />
      {cota.step === 2 && cota.p2 && cota.resolvedMode && (
        <PreviewLine mode={cota.resolvedMode} p1={cota.p1} p2={cota.p2} offset={cota.previewOffset ?? 0.001} p2Visible />
      )}
    </g>
  )
}

function PreviewLine({ mode, p1, p2, offset, p2Visible }: { mode: DimGeometryMode; p1: { x: number; y: number }; p2: { x: number; y: number }; offset: number; p2Visible?: boolean }) {
  const geo = dimGeometry({ mode, p1, p2, offset })
  return (
    <>
      {p2Visible && <circle cx={p2.x} cy={p2.y} r={1.4} fill="var(--accent)" />}
      <line x1={geo.extA[0]} y1={geo.extA[1]} x2={geo.extA[2]} y2={geo.extA[3]} stroke="var(--accent)" strokeWidth={0.3} strokeDasharray="1.2,1" vectorEffect="non-scaling-stroke" />
      <line x1={geo.extB[0]} y1={geo.extB[1]} x2={geo.extB[2]} y2={geo.extB[3]} stroke="var(--accent)" strokeWidth={0.3} strokeDasharray="1.2,1" vectorEffect="non-scaling-stroke" />
      <line x1={geo.lineA.x} y1={geo.lineA.y} x2={geo.lineB.x} y2={geo.lineB.y} stroke="var(--accent)" strokeWidth={0.35} strokeDasharray="1.2,1" vectorEffect="non-scaling-stroke" />
    </>
  )
}

function CalPreview({ cal }: { cal: CalState }) {
  if (!cal.p1) return null
  return (
    <g opacity={0.9}>
      <circle cx={cal.p1.x} cy={cal.p1.y} r={1.4} fill="var(--accent)" />
      {cal.preview && (
        <line
          x1={cal.p1.x}
          y1={cal.p1.y}
          x2={cal.preview.x}
          y2={cal.preview.y}
          stroke="var(--accent)"
          strokeWidth={0.4}
          strokeDasharray="1.4,1"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  )
}

function DraftPreview({ draft }: { draft: DraftState }) {
  const [p1, p2] = draft.points
  const preview = draft.preview
  if (!p1) return null
  const col = 'var(--accent)'
  if (draft.tool === 'leader') {
    return (
      <g opacity={0.85}>
        <circle cx={p1.x} cy={p1.y} r={1} fill={col} />
        {preview && <line x1={p1.x} y1={p1.y} x2={preview.x} y2={preview.y} stroke={col} strokeWidth={0.35} strokeDasharray="1.2,1" vectorEffect="non-scaling-stroke" />}
      </g>
    )
  }
  if (draft.tool === 'level') {
    return (
      <g opacity={0.85}>
        <circle cx={p1.x} cy={p1.y} r={1} fill={col} />
        {preview && (
          <line x1={p1.x} y1={p1.y} x2={preview.x} y2={p1.y} stroke={col} strokeWidth={0.35} strokeDasharray="4,1.2,1,1.2" vectorEffect="non-scaling-stroke" />
        )}
      </g>
    )
  }
  // callout
  if (!p2) {
    if (!preview) return null
    const x = Math.min(p1.x, preview.x)
    const y = Math.min(p1.y, preview.y)
    const w = Math.abs(preview.x - p1.x)
    const h = Math.abs(preview.y - p1.y)
    return <rect x={x} y={y} width={w} height={h} fill="none" stroke={col} strokeWidth={0.35} strokeDasharray="1.8,1.4" vectorEffect="non-scaling-stroke" opacity={0.85} />
  }
  const rx = Math.min(p1.x, p2.x)
  const ry = Math.min(p1.y, p2.y)
  const rw = Math.abs(p2.x - p1.x)
  const rh = Math.abs(p2.y - p1.y)
  return (
    <g opacity={0.85}>
      <rect x={rx} y={ry} width={rw} height={rh} fill="none" stroke={col} strokeWidth={0.35} strokeDasharray="1.8,1.4" vectorEffect="non-scaling-stroke" />
      {preview && <line x1={rx + rw / 2} y1={ry + rh / 2} x2={preview.x} y2={preview.y} stroke={col} strokeWidth={0.35} strokeDasharray="1.2,1" vectorEffect="non-scaling-stroke" />}
    </g>
  )
}
