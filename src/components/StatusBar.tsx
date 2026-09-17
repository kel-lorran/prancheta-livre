import { useProjectStore, findMemberById } from '../state/projectStore'

interface Props {
  warning: string | null
  coords: string
}

export function StatusBar({ warning, coords }: Props) {
  const tool = useProjectStore((s) => s.tool)
  const dimMode = useProjectStore((s) => s.dimMode)
  const selection = useProjectStore((s) => s.selection)
  const multiSelection = useProjectStore((s) => s.multiSelection)
  const cota = useProjectStore((s) => s.cota)
  const cal = useProjectStore((s) => s.cal)
  const draft = useProjectStore((s) => s.draft)
  const crop = useProjectStore((s) => s.crop)
  const openGroupId = useProjectStore((s) => s.openGroupId)
  const sheets = useProjectStore((s) => s.sheets)

  const hint = warning ?? computeHint()

  function computeHint(): string {
    if (crop) return `Recorte: clique pra adicionar pontos (${crop.points.length} até agora, mínimo 3) — Enter ou clique fora confirma, Esc cancela.`
    if (multiSelection.length) return `${multiSelection.length} itens selecionados — Delete remove todos, Shift+clique ajusta a seleção.`
    if (tool === 'select') {
      if (selection.type === 'dim') return 'Cota selecionada — duplo clique no valor para sobrescrever o texto, Delete para remover.'
      if (selection.type === 'annotation') return 'Anotação selecionada — arraste para mover, duplo clique no texto para editar, Delete para remover.'
      if (selection.type === 'member') {
        const found = findMemberById(sheets, selection.id)
        const locked = found?.image.locked
        return 'Imagem selecionada — arraste para mover' + (locked ? '. Travada — destrave para reajustar.' : ', puxe os cantos para escalar.') + ' Botão direito: recortar.'
      }
      if (selection.type === 'group') {
        return openGroupId === selection.id
          ? 'Dentro do grupo — clique numa imagem pra selecioná-la, Esc sai.'
          : 'Grupo selecionado — arraste para mover, duplo clique (ou Enter) entra nele. Botão direito: mais opções.'
      }
      if (selection.type === 'sheet') return 'Prancha selecionada — arraste a aba para mover, Delete para remover.'
      return 'Selecione um elemento, ou arraste o fundo para uma janela de seleção. Botão do meio: navegar. Roda do mouse: zoom.'
    }
    if (tool === 'calibrate') {
      if (cal.step === 0) return 'Calibrar escala do grupo: clique o primeiro ponto de um comprimento conhecido da imagem (ex.: uma parede).'
      return 'Clique o segundo ponto — depois informe o comprimento real e a escala da prancha; o grupo será redimensionado para esse tamanho real.'
    }
    if (tool === 'fitScale') {
      if (cal.step === 0) return 'Ajustar à escala do grupo: clique o primeiro ponto de um comprimento conhecido dessa imagem.'
      return 'Clique o segundo ponto — depois informe o comprimento real; só essa imagem será redimensionada, mantendo a escala do grupo.'
    }
    if (tool === 'cota') {
      const modeLabel = dimMode === 'aligned' ? 'alinhada' : 'ortogonal'
      if (cota.step === 0) return `Cota (${modeLabel}): clique o primeiro ponto sobre um grupo já calibrado.`
      if (cota.step === 1) return 'Clique o segundo ponto.'
      return 'Mova o mouse e clique para definir o afastamento da linha de cota. Esc cancela.'
    }
    if (tool === 'marker') return 'Numeração: clique um ponto pra adicionar o próximo número circulado.'
    if (tool === 'leader') {
      if (!draft.tool) return 'Chamada: clique o ponto que quer apontar.'
      return 'Clique onde o texto deve ficar.'
    }
    if (tool === 'level') {
      if (!draft.tool) return 'Linha de nível: clique o início da linha (mesma altura do nível a marcar).'
      return 'Clique o fim da linha, no mesmo grupo.'
    }
    return ''
  }

  return (
    <div id="statusbar" className={warning ? 'warn' : ''}>
      <div className="hint">{hint}</div>
      <div className="coords">{coords}</div>
    </div>
  )
}
