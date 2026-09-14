import type React from 'react'
import { useRef, useState, useEffect } from 'react'
import { STANDARD_SCALES } from '../lib/isoSizes'

interface Props {
  x: number
  y: number
  onConfirm: (meters: number, denom: number) => void
  onCancel: () => void
}

export function CalibratePrompt({ x, y, onConfirm, onCancel }: Props) {
  const lengthRef = useRef<HTMLInputElement>(null)
  const unitRef = useRef<HTMLSelectElement>(null)
  const customRef = useRef<HTMLInputElement>(null)
  const [scale, setScale] = useState('100')

  useEffect(() => {
    lengthRef.current?.focus()
  }, [])

  function confirm() {
    const v = parseFloat((lengthRef.current?.value ?? '').replace(',', '.'))
    const denom = scale === 'custom' ? parseFloat((customRef.current?.value ?? '').replace(',', '.')) : parseFloat(scale)
    if (!isFinite(v) || v <= 0 || !isFinite(denom) || denom <= 0) {
      onCancel()
      return
    }
    const unit = unitRef.current?.value ?? 'm'
    const meters = unit === 'm' ? v : unit === 'cm' ? v / 100 : v / 1000
    onConfirm(meters, denom)
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
        <span className="fieldlabel">comprimento real do segmento</span>
        <input ref={lengthRef} type="number" placeholder="ex: 2" onKeyDown={onKeyDown} />
        <select ref={unitRef} defaultValue="m" onKeyDown={onKeyDown}>
          <option value="m">m</option>
          <option value="cm">cm</option>
          <option value="mm">mm</option>
        </select>
        <span className="fieldlabel">escala da prancha</span>
        <select value={scale} onChange={(e) => setScale(e.target.value)} onKeyDown={onKeyDown}>
          {STANDARD_SCALES.map((sc) => (
            <option key={sc} value={sc}>
              1:{sc}
            </option>
          ))}
          <option value="custom">personalizada</option>
        </select>
        {scale === 'custom' && (
          <span className="customscale">
            1:<input ref={customRef} type="number" placeholder="ex: 40" onKeyDown={onKeyDown} />
          </span>
        )}
        <button className="ok" onClick={confirm}>
          Redimensionar e travar
        </button>
        <button className="cancel" onClick={onCancel}>
          Esc
        </button>
      </div>
    </>
  )
}
