import type React from 'react'
import type { ProjectInfo, Sheet } from '../types'

const FONT = "'IBM Plex Sans Condensed', sans-serif"
const CELL_W = 20
const CELLS = 4
const HEIGHT = 16

interface Props {
  sheet: Sheet
  project: ProjectInfo
  sheetNumber: number
  sheetTotal: number
  onEditField: (e: React.MouseEvent, field: 'sheetTitle' | 'date' | 'revision', current: string) => void
}

export function TitleBlock({ sheet, project, sheetNumber, sheetTotal, onEditField }: Props) {
  const y = sheet.h - HEIGHT
  const rightW = CELL_W * CELLS
  const leftX = 0
  const leftW = sheet.w - rightW
  const scales = [...new Set(sheet.groups.map((g) => g.realMetersPerMm).filter((v): v is number => v != null))]
  const scaleLabel = scales.length === 0 ? '—' : scales.length === 1 ? `1:${Math.round(scales[0] * 1000)}` : 'múltiplas'

  const cells: { label: string; value: string; onClick?: (e: React.MouseEvent) => void }[] = [
    { label: 'ESCALA', value: scaleLabel },
    { label: 'PRANCHA', value: `${String(sheetNumber).padStart(2, '0')}/${String(sheetTotal).padStart(2, '0')}` },
    { label: 'DATA', value: sheet.titleBlock.date || '—', onClick: (e) => onEditField(e, 'date', sheet.titleBlock.date) },
    { label: 'REV.', value: sheet.titleBlock.revision || '—', onClick: (e) => onEditField(e, 'revision', sheet.titleBlock.revision) },
  ]

  return (
    <g>
      <line x1={0} y1={y} x2={sheet.w} y2={y} stroke="var(--ink)" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />

      <text x={leftX + 3} y={y + 6.5} fill="var(--ink)" fontSize={3.6} fontWeight={600} fontFamily={FONT}>
        {project.name || 'Projeto sem nome'}
      </text>
      <text
        x={leftX + 3}
        y={y + 12.5}
        fill="var(--ink)"
        fontSize={2.8}
        fontFamily={FONT}
        style={{ cursor: 'pointer' }}
        onClick={(e) => onEditField(e, 'sheetTitle', sheet.titleBlock.sheetTitle)}
      >
        {sheet.titleBlock.sheetTitle || sheet.name}
      </text>

      {cells.map((cell, i) => {
        const cx = leftW + i * CELL_W
        return (
          <g key={cell.label}>
            <line x1={cx} y1={y} x2={cx} y2={sheet.h} stroke="var(--ink)" strokeWidth={0.25} vectorEffect="non-scaling-stroke" />
            <line x1={cx} y1={y + 6.5} x2={cx + CELL_W} y2={y + 6.5} stroke="var(--ink)" strokeWidth={0.2} vectorEffect="non-scaling-stroke" />
            <text x={cx + CELL_W / 2} y={y + 4.6} fill="var(--muted)" fontSize={1.9} fontFamily={FONT} fontWeight={600} textAnchor="middle" letterSpacing="0.03em">
              {cell.label}
            </text>
            <text
              x={cx + CELL_W / 2}
              y={y + 11.8}
              fill="var(--ink)"
              fontSize={2.6}
              fontFamily={FONT}
              fontWeight={500}
              textAnchor="middle"
              style={cell.onClick ? { cursor: 'pointer' } : undefined}
              onClick={cell.onClick}
            >
              {cell.value}
            </text>
          </g>
        )
      })}
    </g>
  )
}
