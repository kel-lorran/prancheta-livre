import type React from 'react'
import { useState } from 'react'
import type { Sheet, ViewState } from '../types'
import { LockIcon, UnlockIcon } from './icons'

interface Props {
  sheet: Sheet
  view: ViewState
  selected: boolean
  onPointerDown: (e: React.PointerEvent, sheet: Sheet) => void
  onRename: (sheet: Sheet, name: string) => void
  onDelete: (sheet: Sheet) => void
  onToggleLock: (sheet: Sheet) => void
}

export function SheetTab({ sheet, view, selected, onPointerDown, onRename, onDelete, onToggleLock }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(sheet.name)

  const left = view.panX + sheet.x * view.zoom
  const top = view.panY + sheet.y * view.zoom
  const scaleBadge = sheet.image?.realMetersPerMm ? Math.round(sheet.image.realMetersPerMm * 1000) : null

  function commitRename() {
    setEditing(false)
    if (draft.trim()) onRename(sheet, draft.trim())
    else setDraft(sheet.name)
  }

  return (
    <div
      className={'sheet-tab' + (selected ? ' selected' : '')}
      style={{ left, top }}
      onPointerDown={(e) => {
        if (editing) return
        onPointerDown(e, sheet)
      }}
    >
      {editing ? (
        <input
          className="rename-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') {
              setDraft(sheet.name)
              setEditing(false)
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="name"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            setDraft(sheet.name)
            setEditing(true)
          }}
        >
          {sheet.name}
        </span>
      )}
      <span className="size">
        {sheet.size} {sheet.orientation}
      </span>
      {scaleBadge != null && (
        <span
          className="badge"
          title={sheet.image?.locked ? 'Escala travada — clique para destravar' : 'Clique para travar a escala'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onToggleLock(sheet)}
        >
          {sheet.image?.locked ? <LockIcon /> : <UnlockIcon />}
          1:{scaleBadge}
        </span>
      )}
      <button
        className="mini"
        title="Excluir prancha"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(sheet)}
      >
        ×
      </button>
    </div>
  )
}
