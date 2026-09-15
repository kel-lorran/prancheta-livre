import type React from 'react'
import type { Annotation } from '../types'

const INK = 'var(--ink)'
const FONT = "'IBM Plex Sans Condensed', sans-serif"

interface Props {
  ann: Annotation
  index: number
  selected: boolean
  onPointerDownPrimary: (e: React.PointerEvent) => void
  onPointerDownSecondary?: (e: React.PointerEvent) => void
  onDoubleClick?: (e: React.MouseEvent) => void
}

export function AnnotationView({ ann, index, selected, onPointerDownPrimary, onPointerDownSecondary, onDoubleClick }: Props) {
  const col = selected ? 'var(--accent)' : INK

  if (ann.kind === 'marker') {
    return (
      <g data-ann={ann.id} data-kind={ann.kind} style={{ cursor: 'pointer' }} onPointerDown={onPointerDownPrimary}>
        <circle cx={ann.pos.x} cy={ann.pos.y} r={3.2} fill="var(--paper)" stroke={col} strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
        <text x={ann.pos.x} y={ann.pos.y} fill={col} fontSize={3} fontWeight={600} fontFamily={FONT} textAnchor="middle" dominantBaseline="central">
          {index + 1}
        </text>
      </g>
    )
  }

  if (ann.kind === 'leader') {
    return (
      <g data-ann={ann.id} data-kind={ann.kind} onDoubleClick={onDoubleClick}>
        <line x1={ann.anchor.x} y1={ann.anchor.y} x2={ann.label.x} y2={ann.label.y} stroke={col} strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
        <circle cx={ann.anchor.x} cy={ann.anchor.y} r={0.9} fill={col} style={{ cursor: 'pointer' }} onPointerDown={onPointerDownPrimary} />
        <text
          x={ann.label.x + 1.2}
          y={ann.label.y}
          fill={col}
          fontSize={2.8}
          fontFamily={FONT}
          fontWeight={500}
          dominantBaseline="central"
          style={{ cursor: 'pointer' }}
          onPointerDown={onPointerDownSecondary}
        >
          {ann.text}
        </text>
      </g>
    )
  }

  if (ann.kind === 'level') {
    return (
      <g data-ann={ann.id} data-kind={ann.kind} onDoubleClick={onDoubleClick}>
        <line
          x1={ann.x1}
          y1={ann.y}
          x2={ann.x2}
          y2={ann.y}
          stroke={col}
          strokeWidth={0.3}
          strokeDasharray="4,1.2,1,1.2"
          vectorEffect="non-scaling-stroke"
          style={{ cursor: 'pointer' }}
          onPointerDown={onPointerDownPrimary}
        />
        <circle cx={ann.x1} cy={ann.y} r={0.9} fill={col} />
        <text x={ann.x1 - 2} y={ann.y} fill={col} fontSize={2.8} fontFamily={FONT} fontWeight={600} textAnchor="end" dominantBaseline="central">
          {ann.text}
        </text>
      </g>
    )
  }

  // callout
  const { rect, targetPos } = ann
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x, y: rect.y + rect.h },
    { x: rect.x + rect.w, y: rect.y + rect.h },
  ]
  const nearest = [...corners].sort((a, b) => Math.hypot(a.x - targetPos.x, a.y - targetPos.y) - Math.hypot(b.x - targetPos.x, b.y - targetPos.y)).slice(0, 2)

  return (
    <g data-ann={ann.id} data-kind={ann.kind} onDoubleClick={onDoubleClick}>
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        fill="none"
        stroke={col}
        strokeWidth={0.3}
        strokeDasharray="1.8,1.4"
        vectorEffect="non-scaling-stroke"
        style={{ cursor: 'pointer' }}
        onPointerDown={onPointerDownPrimary}
      />
      {nearest.map((c, i) => (
        <line key={i} x1={c.x} y1={c.y} x2={targetPos.x} y2={targetPos.y} stroke={col} strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
      ))}
      <circle cx={targetPos.x} cy={targetPos.y} r={1} fill={col} style={{ cursor: 'pointer' }} onPointerDown={onPointerDownSecondary} />
      <text x={targetPos.x + 1.4} y={targetPos.y} fill={col} fontSize={2.8} fontFamily={FONT} fontWeight={600} dominantBaseline="central">
        {ann.text}
      </text>
    </g>
  )
}
