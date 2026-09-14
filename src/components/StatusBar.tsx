import { useProjectStore } from '../state/projectStore'

interface Props {
  warning: string | null
  coords: string
}

export function StatusBar({ warning, coords }: Props) {
  const tool = useProjectStore((s) => s.tool)
  const dimMode = useProjectStore((s) => s.dimMode)
  const selection = useProjectStore((s) => s.selection)
  const cota = useProjectStore((s) => s.cota)
  const cal = useProjectStore((s) => s.cal)
  const sheets = useProjectStore((s) => s.sheets)

  const hint = warning ?? computeHint()

  function computeHint(): string {
    if (tool === 'select') {
      if (selection.type === 'dim') return 'Cota selecionada — duplo clique no valor para sobrescrever o texto, Delete para remover.'
      if (selection.type === 'image') {
        const sheet = sheets.find((s) => s.id === selection.id)
        const locked = sheet?.image?.locked
        return 'Imagem selecionada — arraste para mover' + (locked ? '. Escala travada — destrave para reajustar.' : ', puxe os cantos para escalar.')
      }
      if (selection.type === 'sheet') return 'Prancha selecionada — arraste a aba para mover, Delete para remover.'
      return 'Selecione um elemento, ou arraste o fundo para navegar. Roda do mouse: zoom.'
    }
    if (tool === 'calibrate') {
      if (cal.step === 0) return 'Calibrar escala: clique o primeiro ponto de um comprimento conhecido da imagem (ex.: uma parede).'
      return 'Clique o segundo ponto — depois informe o comprimento real e a escala da prancha; a imagem será redimensionada para esse tamanho real.'
    }
    const modeLabel = dimMode === 'aligned' ? 'alinhada' : 'ortogonal'
    if (cota.step === 0) return `Cota (${modeLabel}): clique o primeiro ponto sobre uma imagem já calibrada.`
    if (cota.step === 1) return 'Clique o segundo ponto.'
    return 'Mova o mouse e clique para definir o afastamento da linha de cota. Esc cancela.'
  }

  return (
    <div id="statusbar" className={warning ? 'warn' : ''}>
      <div className="hint">{hint}</div>
      <div className="coords">{coords}</div>
    </div>
  )
}
