import type React from 'react'
import { dimGeometry } from '../lib/dimGeometry'
import { dimsInGroupMm, annotationsInGroupMm } from '../state/projectStore'
import type { CalState, CotaState, CropState, DimGeometryMode, DraftState, ImageGroup, Point, ProjectInfo, Selection, Sheet, SheetImage, ToolName } from '../types'
import type { SelectionItem } from '../state/projectStore'
import { DimensionView } from './DimensionView'
import { AnnotationView } from './AnnotationView'
import { TitleBlock } from './TitleBlock'

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

export interface SheetHandlers {
  onGroupPointerDown: (e: React.PointerEvent, sheet: Sheet, group: ImageGroup) => void
  onGroupHandlePointerDown: (e: React.PointerEvent, sheet: Sheet, group: ImageGroup, corner: Corner) => void
  onGroupDoubleClick: (e: React.MouseEvent, sheet: Sheet, group: ImageGroup) => void
  onGroupContextMenu: (e: React.MouseEvent, sheet: Sheet, group: ImageGroup) => void
  onMemberPointerDown: (e: React.PointerEvent, sheet: Sheet, group: ImageGroup, image: SheetImage) => void
  onMemberHandlePointerDown: (e: React.PointerEvent, sheet: Sheet, group: ImageGroup, image: SheetImage, corner: Corner) => void
  onMemberContextMenu: (e: React.MouseEvent, sheet: Sheet, group: ImageGroup, image: SheetImage) => void
  onDimPointerDown: (e: React.PointerEvent, sheet: Sheet, group: ImageGroup, dimId: string) => void
  onDimDoubleClick: (e: React.MouseEvent, sheet: Sheet, group: ImageGroup, dimId: string) => void
  onAnnotationPrimaryDown: (e: React.PointerEvent, sheet: Sheet, group: ImageGroup, annId: string) => void
  onAnnotationSecondaryDown: (e: React.PointerEvent, sheet: Sheet, group: ImageGroup, annId: string) => void
  onAnnotationDoubleClick: (e: React.MouseEvent, sheet: Sheet, group: ImageGroup, annId: string) => void
  onTitleBlockEdit: (e: React.MouseEvent, sheet: Sheet, field: 'sheetTitle' | 'date' | 'revision', current: string) => void
  onCropVertexPointerDown: (e: React.PointerEvent, index: number) => void
  onCropVertexDoubleClick: (e: React.MouseEvent, index: number) => void
  onCropEdgeClick: (e: React.MouseEvent, index: number, midpoint: Point) => void
}

interface Props {
  sheet: Sheet
  tool: ToolName
  selection: Selection
  multiSelection: SelectionItem[]
  openGroupId: string | null
  cota: CotaState
  cal: CalState
  draft: DraftState
  crop: CropState | null
  project: ProjectInfo
  sheetNumber: number
  sheetTotal: number
  handlers: SheetHandlers
}

function isSel(multi: SelectionItem[], type: SelectionItem['type'], id: string): boolean {
  return multi.some((i) => i.type === type && i.id === id)
}

export function SheetView({ sheet, tool, selection, multiSelection, openGroupId, cota, cal, draft, crop, project, sheetNumber, sheetTotal, handlers }: Props) {
  const clipId = `clip-${sheet.id}`
  const isSheetSelected = selection.type === 'sheet' && selection.id === sheet.id
  // Numeração dos marcadores é sequencial na prancha inteira, cruzando grupos — prefix-sum calculado
  // antes de renderizar (não dá pra acumular durante o render dos filhos, React não garante ordem síncrona).
  const markerCounts = sheet.groups.map((g) => g.annotations.filter((a) => a.kind === 'marker').length)
  const markerStarts = markerCounts.map((_, i) => markerCounts.slice(0, i).reduce((a, b) => a + b, 0))

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
        {sheet.groups.map((group, gi) => (
          <GroupView
            key={group.id}
            sheet={sheet}
            group={group}
            tool={tool}
            selection={selection}
            multiSelection={multiSelection}
            isOpen={openGroupId === group.id}
            markerIndexStart={markerStarts[gi]}
            cota={cota}
            cal={cal}
            draft={draft}
            crop={crop}
            handlers={handlers}
          />
        ))}
      </g>

      <TitleBlock
        sheet={sheet}
        project={project}
        sheetNumber={sheetNumber}
        sheetTotal={sheetTotal}
        onEditField={(e, field, current) => handlers.onTitleBlockEdit(e, sheet, field, current)}
      />
    </g>
  )
}

interface GroupViewProps {
  sheet: Sheet
  group: ImageGroup
  tool: ToolName
  selection: Selection
  multiSelection: SelectionItem[]
  isOpen: boolean
  markerIndexStart: number
  cota: CotaState
  cal: CalState
  draft: DraftState
  crop: CropState | null
  handlers: SheetHandlers
}

function GroupView({ sheet, group, tool, selection, multiSelection, isOpen, markerIndexStart, cota, cal, draft, crop, handlers }: GroupViewProps) {
  const isGroupSelected = (selection.type === 'group' && selection.id === group.id) || isSel(multiSelection, 'group', group.id)
  const dimsMm = dimsInGroupMm(group)
  const annsMm = annotationsInGroupMm(group)
  let localMarkerIndex = markerIndexStart - 1

  return (
    <g transform={`translate(${group.x} ${group.y})`} data-group-id={group.id} data-testid="group">
      {group.images.map((im) => (
        <MemberView
          key={im.id}
          sheet={sheet}
          group={group}
          image={im}
          tool={tool}
          selectable={isOpen}
          selected={(selection.type === 'member' && selection.id === im.id) || isSel(multiSelection, 'member', im.id)}
          crop={crop && crop.imageId === im.id ? crop : null}
          handlers={handlers}
        />
      ))}

      {!isOpen && isGroupSelected && (
        <>
          <rect x={0} y={0} width={group.w} height={group.h} fill="none" stroke="var(--accent)" strokeWidth={0.6} strokeDasharray="2,1.4" vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />
          {!group.locked &&
            (
              [
                [0, 0, 'nw'],
                [group.w, 0, 'ne'],
                [0, group.h, 'sw'],
                [group.w, group.h, 'se'],
              ] as [number, number, Corner][]
            ).map(([hx, hy, corner]) => (
              <ResizeHandle key={corner} hx={hx} hy={hy} corner={corner} onPointerDown={(e) => handlers.onGroupHandlePointerDown(e, sheet, group, corner)} />
            ))}
        </>
      )}

      <rect
        x={-1}
        y={-1}
        width={group.w + 2}
        height={group.h + 2}
        fill="transparent"
        style={{
          cursor: isOpen ? undefined : tool === 'select' ? 'move' : undefined,
          // Enquanto um recorte estiver em edição neste grupo, o hit-rect não pode engolir os
          // cliques que deveriam virar pontos do polígono.
          pointerEvents: isOpen || tool !== 'select' || (crop && crop.groupId === group.id) ? 'none' : 'all',
        }}
        onPointerDown={(e) => handlers.onGroupPointerDown(e, sheet, group)}
        onDoubleClick={(e) => handlers.onGroupDoubleClick(e, sheet, group)}
        onContextMenu={(e) => handlers.onGroupContextMenu(e, sheet, group)}
        data-group-hit={group.id}
      />

      {dimsMm.map((d) => (
        <DimensionView
          key={d.id}
          sheetId={sheet.id}
          dim={d}
          realMetersPerMm={group.realMetersPerMm}
          selected={(selection.type === 'dim' && selection.id === d.id) || isSel(multiSelection, 'dim', d.id)}
          onPointerDownLine={(e) => handlers.onDimPointerDown(e, sheet, group, d.id)}
          onDoubleClick={(e) => handlers.onDimDoubleClick(e, sheet, group, d.id)}
        />
      ))}

      {annsMm.map((a) => {
        if (a.kind === 'marker') localMarkerIndex++
        return (
          <AnnotationView
            key={a.id}
            ann={a}
            index={a.kind === 'marker' ? localMarkerIndex : 0}
            selected={(selection.type === 'annotation' && selection.id === a.id) || isSel(multiSelection, 'annotation', a.id)}
            onPointerDownPrimary={(e) => handlers.onAnnotationPrimaryDown(e, sheet, group, a.id)}
            onPointerDownSecondary={(e) => handlers.onAnnotationSecondaryDown(e, sheet, group, a.id)}
            onDoubleClick={(e) => handlers.onAnnotationDoubleClick(e, sheet, group, a.id)}
          />
        )
      })}

      {tool === 'cota' && cota.groupId === group.id && <CotaPreview cota={cota} />}
      {tool === 'calibrate' && cal.groupId === group.id && cal.mode === 'group' && <CalPreview cal={cal} />}
      {tool === 'fitScale' && cal.groupId === group.id && cal.mode === 'member' && <CalPreview cal={cal} />}
      {draft.groupId === group.id && <DraftPreview draft={draft} />}
    </g>
  )
}

interface MemberViewProps {
  sheet: Sheet
  group: ImageGroup
  image: SheetImage
  tool: ToolName
  selectable: boolean
  selected: boolean
  crop: CropState | null
  handlers: SheetHandlers
}

function MemberView({ sheet, group, image, tool, selectable, selected, crop, handlers }: MemberViewProps) {
  const clipId = `imgclip-${image.id}`
  const isCropping = !!crop
  return (
    <g>
      {image.crop && !isCropping && (
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <polygon points={image.crop.map((p) => `${p.x},${p.y}`).join(' ')} />
          </clipPath>
        </defs>
      )}

      {isCropping && (
        <image href={image.href} x={image.x} y={image.y} width={image.w} height={image.h} preserveAspectRatio="none" opacity={0.3} style={{ pointerEvents: 'none' }} />
      )}

      <image
        href={image.href}
        x={image.x}
        y={image.y}
        width={image.w}
        height={image.h}
        preserveAspectRatio="none"
        clipPath={image.crop && !isCropping ? `url(#${clipId})` : undefined}
        style={{ cursor: selectable ? (tool === 'select' ? 'move' : 'crosshair') : undefined, pointerEvents: selectable ? 'all' : 'none' }}
        onPointerDown={(e) => selectable && handlers.onMemberPointerDown(e, sheet, group, image)}
        onContextMenu={(e) => selectable && handlers.onMemberContextMenu(e, sheet, group, image)}
      />

      {selected && !isCropping && (
        <>
          <rect x={image.x} y={image.y} width={image.w} height={image.h} fill="none" stroke="var(--accent)" strokeWidth={0.5} strokeDasharray="1.6,1.2" vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />
          {!image.locked &&
            (
              [
                [image.x, image.y, 'nw'],
                [image.x + image.w, image.y, 'ne'],
                [image.x, image.y + image.h, 'sw'],
                [image.x + image.w, image.y + image.h, 'se'],
              ] as [number, number, Corner][]
            ).map(([hx, hy, corner]) => (
              <ResizeHandle key={corner} hx={hx} hy={hy} corner={corner} onPointerDown={(e) => handlers.onMemberHandlePointerDown(e, sheet, group, image, corner)} />
            ))}
        </>
      )}

      {isCropping && crop && <CropOverlay image={image} crop={crop} handlers={handlers} />}
    </g>
  )
}

function ResizeHandle({ hx, hy, corner, onPointerDown }: { hx: number; hy: number; corner: Corner; onPointerDown: (e: React.PointerEvent) => void }) {
  const hs = 3.2
  return (
    <rect
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
      onPointerDown={onPointerDown}
    />
  )
}

function CropOverlay({ image, crop, handlers }: { image: SheetImage; crop: CropState; handlers: SheetHandlers }) {
  const toAbs = (p: Point) => ({ x: image.x + p.x * image.w, y: image.y + p.y * image.h })
  const pts = crop.points.map(toAbs)
  const previewAbs = crop.preview ? toAbs(crop.preview) : null
  const polyStr = pts.map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <g style={{ pointerEvents: 'none' }}>
      {pts.length >= 2 && <polygon points={polyStr} fill="var(--accent)" fillOpacity={0.12} stroke="var(--accent)" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />}
      {pts.length === 1 && previewAbs && (
        <line x1={pts[0].x} y1={pts[0].y} x2={previewAbs.x} y2={previewAbs.y} stroke="var(--accent)" strokeWidth={0.35} strokeDasharray="1.2,1" vectorEffect="non-scaling-stroke" />
      )}
      {pts.length >= 2 && previewAbs && (
        <line x1={pts[pts.length - 1].x} y1={pts[pts.length - 1].y} x2={previewAbs.x} y2={previewAbs.y} stroke="var(--accent)" strokeWidth={0.35} strokeDasharray="1.2,1" vectorEffect="non-scaling-stroke" />
      )}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={1.4}
          fill="var(--accent)"
          stroke="var(--paper)"
          strokeWidth={0.3}
          style={{ cursor: 'grab', pointerEvents: 'all' }}
          onPointerDown={(e) => handlers.onCropVertexPointerDown(e, i)}
          onDoubleClick={(e) => handlers.onCropVertexDoubleClick(e, i)}
        />
      ))}
      {pts.length >= 2 &&
        pts.map((p, i) => {
          const q = pts[(i + 1) % pts.length]
          const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
          return <circle key={`mid-${i}`} cx={mid.x} cy={mid.y} r={1} fill="var(--paper)" stroke="var(--accent)" strokeWidth={0.35} style={{ cursor: 'copy', pointerEvents: 'all' }} onClick={(e) => handlers.onCropEdgeClick(e, i, mid)} />
        })}
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
  const [p1] = draft.points
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
  // level
  return (
    <g opacity={0.85}>
      <circle cx={p1.x} cy={p1.y} r={1} fill={col} />
      {preview && (
        <line x1={p1.x} y1={p1.y} x2={preview.x} y2={p1.y} stroke={col} strokeWidth={0.35} strokeDasharray="4,1.2,1,1.2" vectorEffect="non-scaling-stroke" />
      )}
    </g>
  )
}
