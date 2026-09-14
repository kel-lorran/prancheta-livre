import type React from 'react'
import { DIM_TEXT_GAP, DIM_TEXT_HEIGHT, dimGeometry, formatDimText } from '../lib/dimGeometry'
import type { Dimension } from '../types'

interface Props {
  sheetId: string
  dim: Dimension
  realMetersPerMm: number | null
  selected: boolean
  onPointerDownLine: (e: React.PointerEvent) => void
  onDoubleClick: (e: React.MouseEvent) => void
}

export function DimensionView({ sheetId, dim, realMetersPerMm, selected, onPointerDownLine, onDoubleClick }: Props) {
  const geo = dimGeometry(dim)
  const col = selected ? 'var(--accent)' : 'var(--ink)'
  const text = formatDimText(dim, realMetersPerMm)
  const textOut = DIM_TEXT_GAP + DIM_TEXT_HEIGHT / 2
  const tx = geo.mid.x + geo.outx * textOut
  const ty = geo.mid.y + geo.outy * textOut

  return (
    <g data-sheet={sheetId} data-dim={dim.id} style={{ cursor: 'pointer' }} onPointerDown={onPointerDownLine} onDoubleClick={onDoubleClick}>
      <line x1={geo.extA[0]} y1={geo.extA[1]} x2={geo.extA[2]} y2={geo.extA[3]} stroke={col} strokeWidth={0.35} vectorEffect="non-scaling-stroke" />
      <line x1={geo.extB[0]} y1={geo.extB[1]} x2={geo.extB[2]} y2={geo.extB[3]} stroke={col} strokeWidth={0.35} vectorEffect="non-scaling-stroke" />
      <line x1={geo.lineA.x} y1={geo.lineA.y} x2={geo.lineB.x} y2={geo.lineB.y} stroke={col} strokeWidth={0.35} vectorEffect="non-scaling-stroke" />
      <line x1={geo.tickA[0]} y1={geo.tickA[1]} x2={geo.tickA[2]} y2={geo.tickA[3]} stroke={col} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
      <line x1={geo.tickB[0]} y1={geo.tickB[1]} x2={geo.tickB[2]} y2={geo.tickB[3]} stroke={col} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
      <text
        x={tx}
        y={ty}
        fill={col}
        fontSize={DIM_TEXT_HEIGHT}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'IBM Plex Sans Condensed', sans-serif"
        fontWeight={600}
        transform={`rotate(${geo.angle} ${tx} ${ty})`}
      >
        {text}
      </text>
      <line x1={geo.lineA.x} y1={geo.lineA.y} x2={geo.lineB.x} y2={geo.lineB.y} stroke="transparent" strokeWidth={3} vectorEffect="non-scaling-stroke" />
    </g>
  )
}
