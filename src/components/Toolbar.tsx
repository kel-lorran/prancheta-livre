import { useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { SHEET_SIZE_KEYS } from '../lib/isoSizes'
import type { Orientation, SheetSizeKey } from '../types'
import {
  AlignedIcon,
  CalibrateIcon,
  CalloutIcon,
  CotaIcon,
  FitIcon,
  LeaderIcon,
  LevelIcon,
  MarkerIcon,
  OrthoIcon,
  RedoIcon,
  SelectIcon,
  UndoIcon,
} from './icons'

interface Props {
  onAddSheet: (size: SheetSizeKey, orientation: Orientation) => void
  onImportClick: () => void
  onFit: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  zoomPercent: number
  onEditProject: () => void
  onExportPdf: () => void
  onExportProject: () => void
  onImportProjectClick: () => void
}

export function Toolbar({
  onAddSheet,
  onImportClick,
  onFit,
  onZoomIn,
  onZoomOut,
  zoomPercent,
  onEditProject,
  onExportPdf,
  onExportProject,
  onImportProjectClick,
}: Props) {
  const tool = useProjectStore((s) => s.tool)
  const dimMode = useProjectStore((s) => s.dimMode)
  const dimUnit = useProjectStore((s) => s.dimUnit)
  const selection = useProjectStore((s) => s.selection)
  const sheets = useProjectStore((s) => s.sheets)
  const past = useProjectStore((s) => s.past)
  const future = useProjectStore((s) => s.future)
  const setTool = useProjectStore((s) => s.setTool)
  const setDimMode = useProjectStore((s) => s.setDimMode)
  const setDimUnit = useProjectStore((s) => s.setDimUnit)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)

  const [sizeKey, setSizeKey] = useState<SheetSizeKey>('A3')
  const [orientation, setOrientation] = useState<Orientation>('paisagem')

  return (
    <div className="toolbar">
      <div className="brand">
        prancheta<span>·</span>livre
      </div>

      <div className="grp">
        <button className="tool" title="Desfazer (Ctrl+Z)" disabled={!past.length} onClick={undo}>
          <UndoIcon />
        </button>
        <button className="tool" title="Refazer (Ctrl+Shift+Z)" disabled={!future.length} onClick={redo}>
          <RedoIcon />
        </button>
      </div>

      <div className="sep" />

      <div className="grp">
        <button className={'tool' + (tool === 'select' ? ' active' : '')} title="Selecionar (V)" onClick={() => setTool('select')}>
          <SelectIcon />
          Selecionar
        </button>
        <button className={'tool' + (tool === 'calibrate' ? ' active' : '')} title="Calibrar escala da imagem (C)" onClick={() => setTool('calibrate')}>
          <CalibrateIcon />
          Calibrar
        </button>
        <button className={'tool' + (tool === 'cota' ? ' active' : '')} title="Cota (D)" onClick={() => setTool('cota')}>
          <CotaIcon />
          Cota
        </button>
      </div>

      {tool === 'cota' && (
        <div className="grp">
          <button
            className={'tool' + (dimMode === 'ortho' ? ' active' : '')}
            title="Cota ortogonal — vira horizontal ou vertical automaticamente conforme os pontos clicados"
            onClick={() => setDimMode('ortho')}
          >
            <OrthoIcon />
            Ortogonal
          </button>
          <button
            className={'tool' + (dimMode === 'aligned' ? ' active' : '')}
            title="Cota alinhada — acompanha o ângulo do segmento clicado"
            onClick={() => setDimMode('aligned')}
          >
            <AlignedIcon />
            Alinhada
          </button>
        </div>
      )}

      <div className="grp">
        <button className={'tool' + (tool === 'leader' ? ' active' : '')} title="Chamada de texto (leader)" onClick={() => setTool('leader')}>
          <LeaderIcon />
          Chamada
        </button>
        <button className={'tool' + (tool === 'marker' ? ' active' : '')} title="Numeração circulada" onClick={() => setTool('marker')}>
          <MarkerIcon />
          Numeração
        </button>
        <button className={'tool' + (tool === 'level' ? ' active' : '')} title="Linha de referência de nível" onClick={() => setTool('level')}>
          <LevelIcon />
          Nível
        </button>
        <button className={'tool' + (tool === 'callout' ? ' active' : '')} title="Chamada de detalhe (referência a outra vista)" onClick={() => setTool('callout')}>
          <CalloutIcon />
          Detalhe
        </button>
      </div>

      <div className="sep" />

      <select className="sheetsize" value={sizeKey} onChange={(e) => setSizeKey(e.target.value as SheetSizeKey)}>
        {SHEET_SIZE_KEYS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <select className="sheetsize" value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)}>
        <option value="paisagem">paisagem</option>
        <option value="retrato">retrato</option>
      </select>
      <button className="primary" onClick={() => onAddSheet(sizeKey, orientation)}>
        + Prancha
      </button>
      <button className="ghost" disabled={selection.type !== 'sheet'} onClick={onImportClick}>
        Importar imagem
      </button>

      <div className="sep" />

      <div className="grp">
        <button className={'tool' + (dimUnit === 'm' ? ' active' : '')} title="Unidade metros" onClick={() => setDimUnit('m')}>
          m
        </button>
        <button className={'tool' + (dimUnit === 'mm' ? ' active' : '')} title="Unidade milímetros" onClick={() => setDimUnit('mm')}>
          mm
        </button>
      </div>

      <div className="sep" />

      <button className="ghost" onClick={onEditProject}>
        Projeto
      </button>
      <button className="ghost" disabled={!sheets.length} onClick={onExportPdf}>
        Exportar PDF
      </button>
      <button className="ghost" disabled={!sheets.length} onClick={onExportProject}>
        Exportar projeto
      </button>
      <button className="ghost" onClick={onImportProjectClick}>
        Importar projeto
      </button>

      <div className="spacer" />

      <button className="ghost" title="Ajustar à tela" onClick={onFit}>
        <FitIcon />
      </button>
      <div className="grp">
        <button className="tool" onClick={onZoomOut}>
          –
        </button>
        <div className="zoomreadout">{zoomPercent}%</div>
        <button className="tool" onClick={onZoomIn}>
          +
        </button>
      </div>
    </div>
  )
}
