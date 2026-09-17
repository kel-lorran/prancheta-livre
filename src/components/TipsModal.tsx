interface Props {
  onClose: () => void
}

const SECTIONS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Fluxo básico',
    rows: [
      ['Importar imagem', 'Cria um grupo novo (ou entra no grupo aberto)'],
      ['Calibrar (C)', 'Dois cliques + comprimento real — define a escala do grupo'],
      ['Cota (D)', 'Ortogonal ou alinhada — três cliques (dois pontos + afastamento)'],
    ],
  },
  {
    title: 'Grupos de imagem',
    rows: [
      ['Duplo clique / Enter', 'Entra no grupo — clique numa imagem pra selecioná-la'],
      ['Esc', 'Sai do grupo (ou cancela a ferramenta atual)'],
      ['Botão direito', 'Recortar, ajustar à escala, trazer pra frente/trás, excluir…'],
      ['Ctrl+G / Ctrl+Shift+G', 'Agrupar / desagrupar seleção'],
      ['Ctrl+C / Ctrl+X / Ctrl+V', 'Copiar / cortar / colar imagem ou grupo'],
      ['Ctrl+Shift+V', 'Colar no lugar (mesmas coordenadas do original)'],
    ],
  },
  {
    title: 'Seleção',
    rows: [
      ['Arraste vazio →', 'Janela (contém) — seleciona o que estiver totalmente dentro'],
      ['Arraste vazio ←', 'Cruzamento (toca) — seleciona o que a janela tocar'],
      ['Alt + clique', 'Cicla pela pilha de grupos sobrepostos'],
      ['Botão do meio', 'Navegar (pan) pela mesa'],
    ],
  },
]

export function TipsModal({ onClose }: Props) {
  return (
    <>
      <div className="floating-backdrop" onMouseDown={onClose} />
      <div className="tips-modal">
        <div className="tips-head">
          <span>Dicas rápidas</span>
          <button className="mini" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="tips-body">
          {SECTIONS.map((section) => (
            <div key={section.title} className="tips-section">
              <h4>{section.title}</h4>
              <table>
                <tbody>
                  {section.rows.map(([key, desc]) => (
                    <tr key={key}>
                      <td className="tips-key">{key}</td>
                      <td>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <div className="tips-foot">
          <button className="ok" onClick={onClose}>
            Entendi
          </button>
        </div>
      </div>
    </>
  )
}
