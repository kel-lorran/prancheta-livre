import type React from 'react'
import { useRef, useEffect } from 'react'
import type { ProjectInfo } from '../types'

interface Props {
  x: number
  y: number
  initial: ProjectInfo
  onConfirm: (info: ProjectInfo) => void
  onCancel: () => void
}

export function ProjectInfoPrompt({ x, y, initial, onConfirm, onCancel }: Props) {
  const nameRef = useRef<HTMLInputElement>(null)
  const clientRef = useRef<HTMLInputElement>(null)
  const authorRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  function confirm() {
    onConfirm({
      name: nameRef.current?.value.trim() ?? '',
      client: clientRef.current?.value.trim() ?? '',
      author: authorRef.current?.value.trim() ?? '',
    })
  }
  function onKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation()
    if (e.key === 'Enter') confirm()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <>
      <div className="floating-backdrop" onMouseDown={onCancel} />
      <div className="floating-box" style={{ left: x, top: y }}>
        <span className="fieldlabel">nome do projeto</span>
        <input ref={nameRef} type="text" defaultValue={initial.name} onKeyDown={onKeyDown} />
        <span className="fieldlabel">cliente</span>
        <input ref={clientRef} type="text" defaultValue={initial.client} onKeyDown={onKeyDown} />
        <span className="fieldlabel">autor</span>
        <input ref={authorRef} type="text" defaultValue={initial.author} onKeyDown={onKeyDown} />
        <button className="ok" onClick={confirm}>
          Salvar
        </button>
        <button className="cancel" onClick={onCancel}>
          Esc
        </button>
      </div>
    </>
  )
}
