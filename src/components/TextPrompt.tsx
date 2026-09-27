import { useRef, useEffect } from 'react'

interface Props {
  x: number
  y: number
  initial: string
  multiline?: boolean
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function TextPrompt({ x, y, initial, multiline, onConfirm, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = multiline ? areaRef.current : inputRef.current
    el?.focus()
    el?.select()
  }, [multiline])

  function autosize() {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
  useEffect(() => {
    if (multiline) autosize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function confirm() {
    onConfirm((multiline ? areaRef.current?.value : inputRef.current?.value) ?? '')
  }

  return (
    <>
      <div className="floating-backdrop" onMouseDown={onCancel} />
      <div className="floating-box" style={{ left: x, top: y }}>
        {multiline ? (
          <textarea
            ref={areaRef}
            defaultValue={initial}
            rows={1}
            onInput={autosize}
            onKeyDown={(e) => {
              e.stopPropagation()
              // Enter sozinho quebra linha (comportamento normal do textarea) — só confirma com Ctrl/Cmd+Enter.
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                confirm()
              }
              if (e.key === 'Escape') onCancel()
            }}
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            defaultValue={initial}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') confirm()
              if (e.key === 'Escape') onCancel()
            }}
          />
        )}
        <button className="ok" onClick={confirm}>
          {multiline ? 'Confirmar' : 'OK'}
        </button>
        <button className="cancel" onClick={onCancel}>
          Esc
        </button>
        {multiline && <span className="kbdhint">Ctrl+Enter confirma</span>}
      </div>
    </>
  )
}
