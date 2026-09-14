/** Gera, em canvas, uma planta baixa de exemplo — representa o tipo de PNG exportado do SketchUp. */
export function generateSamplePlanDataURL(): string {
  const c = document.createElement('canvas')
  c.width = 1600
  c.height = 1100
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.strokeStyle = '#111318'
  ctx.lineJoin = 'miter'
  ctx.lineCap = 'square'

  ctx.lineWidth = 10
  ctx.strokeRect(100, 150, 1400, 700)

  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(800, 150)
  ctx.lineTo(800, 520)
  ctx.moveTo(800, 650)
  ctx.lineTo(800, 850)
  ctx.stroke()

  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(800, 520)
  ctx.lineTo(800, 650)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(800, 520, 130, 0, Math.PI / 2)
  ctx.stroke()

  ctx.lineWidth = 3
  ;[
    [300, 150],
    [430, 150],
    [1150, 150],
    [1280, 150],
  ].forEach(([x, y]) => {
    ctx.beginPath()
    ctx.moveTo(x, y - 14)
    ctx.lineTo(x, y + 14)
    ctx.stroke()
  })

  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(1150, 850)
  ctx.lineTo(1150, 900)
  ctx.moveTo(1050, 900)
  ctx.lineTo(1250, 900)
  ctx.moveTo(1150, 900)
  ctx.lineTo(1130, 940)
  ctx.moveTo(1150, 900)
  ctx.lineTo(1170, 940)
  ctx.stroke()
  ctx.font = '600 26px sans-serif'
  ctx.fillStyle = '#111318'
  ctx.textAlign = 'center'
  ctx.fillText('N', 1150, 845)

  ctx.font = '500 30px sans-serif'
  ctx.fillStyle = '#333a46'
  ctx.textAlign = 'center'
  ctx.fillText('SALA', 430, 510)
  ctx.fillText('QUARTO', 1150, 510)
  ctx.font = '400 20px sans-serif'
  ctx.fillStyle = '#8a93a3'
  ctx.fillText('planta_baixa_terreo.png — exportado do SketchUp', 800, 1040)

  return c.toDataURL('image/png')
}

export function loadImageSize(src: string): Promise<{ natW: number; natH: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ natW: img.naturalWidth, natH: img.naturalHeight })
    img.onerror = reject
    img.src = src
  })
}
