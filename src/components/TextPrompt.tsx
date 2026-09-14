import { useRef, useEffect } from 'react'

interface Props {
  x: number
  y: number
  initial: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function TextPrompt({ x, y, initial, onConfirm, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function confirm() {
    onConfirm(inputRef.current?.value ?? '')
  }

  return (
    <>
      <div className="floating-backdrop" onMouseDown={onCancel} />
      <div className="floating-box" style={{ left: x, top: y }}>
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
        <button className="ok" onClick={confirm}>
          OK
        </button>
        <button className="cancel" onClick={onCancel}>
          Esc
        </button>
      </div>
    </>
  )
}
