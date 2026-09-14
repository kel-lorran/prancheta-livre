# Prancheta Livre — Plano do Projeto

## Visão geral

Editor de pranchas vetoriais para desenho técnico de arquitetura: importa uma imagem
raster (exportada do SketchUp Web free, ou qualquer PNG/JPG), permite posicioná-la
como "viewport" dentro de uma prancha de tamanho ISO, calibrar essa imagem pra uma
escala real de plotagem, e cotar (ortogonal ou alinhada) seguindo as convenções da
NBR 6492. Substitui a etapa manual que hoje é feita no Inkscape.

Ferramenta de uso pessoal — sem separação de modos (Autor/Usuário Final) como no
Paginazilla. Um projeto, uma pessoa, várias pranchas.

Sem backend em produção. Deploy estático via GitHub Pages.

## Conceitos e modelo de dados

**Sheet (prancha)**
- Tamanho ISO (A4→A0) + orientação (retrato/paisagem), origem `(x,y)` no "mundo" —
  uma mesa infinita em mm, como frames do Figma.
- `image`: no máximo uma por prancha no MVP. Guarda a posição/tamanho de exibição
  (`x,y,w,h` em mm de papel), se está travada (`locked`) e a escala real
  (`realMetersPerMm` — metros reais por mm de papel).
- `dims[]`: cotas, sempre em coordenadas locais da prancha (mm de papel).

**Calibração** (o ponto central do app)
- O autor clica dois pontos sobre um comprimento conhecido da imagem, informa o
  comprimento real e escolhe a escala de plotagem (lista de escalas padrão de
  arquitetura: 1:20 até 1:1000, ou personalizada).
- O app **redimensiona a imagem inteira** (mantendo proporção, ancorada no primeiro
  ponto clicado) até que aquele segmento meça exatamente o correspondente real
  naquela escala — ex.: 2m reais em 1:100 viram 2cm no papel.
- A partir daí `realMetersPerMm = 1/escala/1000` é um valor exato de escala padrão
  (não uma razão arbitrária calculada), e a imagem é travada (só move, não
  redimensiona) — mesma lógica de "travar tamanho" do Paginazilla.
- Cotas nessa prancha usam sempre essa calibração: a distância entre dois pontos em
  mm de papel × `realMetersPerMm` = comprimento real. Ou seja, cota é sempre relativa
  ao tamanho real da prancha impressa, nunca a um cálculo solto.

**Dimension (cota)**
- `mode`: `h` (horizontal), `v` (vertical) ou `aligned` (segue o ângulo do segmento).
- No app, a ferramenta de cota expõe só duas opções pro usuário — **Ortogonal**
  (decide `h`/`v` sozinha comparando Δx e Δy dos dois pontos clicados) e **Alinhada**
  — nunca pede pra escolher H ou V manualmente.
- Geometria e posição do texto seguem NBR 6492: linha de chamada parando a 2mm do
  ponto, texto 1,5mm acima/à esquerda da linha (nunca quebrando a linha, sempre do
  lado absoluto certo — não relativo a onde o desenho está), altura de texto 3mm,
  tick de 45°.

## Stack técnico

- React + TypeScript + Vite, mesmo padrão do Paginazilla.
- **SVG nativo** pra cada prancha (sem Konva) — cada prancha é um grupo `<g>` com
  coordenadas em mm; como a escala de calibração já é a escala real de plotagem, o
  SVG da prancha corresponde 1:1 ao que sai impresso.
- Interações (mover, redimensionar, ajustar cota) via pointer events próprios, sem
  lib de canvas — implementado à mão em `Canvas.tsx`.
- Zustand (`state/projectStore.ts`) pro estado do projeto inteiro.
- Sem backend, deploy estático (GitHub Pages via Actions).

## Persistência (decidido, ainda não implementado)

Decisão de arquitetura fechada antes de implementar, pra não repetir o erro óbvio de
usar `localStorage` pra isso (que o Paginazilla também não usa, apesar da primeira
impressão — ele já usa IndexedDB pro rascunho do usuário final):

- **Continuar a sessão (auto-save local)**: IndexedDB, guardando a imagem como
  `Blob` — não base64. `localStorage` tem cota de ~5-10MB por origem e só guarda
  string; uma imagem de planta facilmente passa de 1-3MB, e base64 infla ~33% em
  cima disso. IndexedDB não tem esse teto e Blob não tem o overhead de codificação.
- **Exportar/importar um arquivo de projeto** (backup, mover de computador, versionar):
  `.zip` (`manifest.json` com os dados vetoriais + pasta `images/` com os PNGs de
  verdade), via `jszip` — mesmo padrão de bundle que o Paginazilla já usa pra
  publicar cenário, e pelo mesmo motivo: zip não paga o custo de base64 e permite
  inspecionar a imagem original fora do app.
- Base64 só aparece de forma transitória no `href` do `<image>` do SVG enquanto
  edita — nunca como formato de armazenamento.

Isso é Fase 2 — ainda não implementado nesta versão.

## Fluxo

1. Criar prancha → tamanho ISO + orientação.
2. Importar imagem (PNG/JPG) → vira viewport, ajustável (mover/redimensionar) antes
   de calibrar.
3. Calibrar: dois pontos + comprimento real + escala → imagem redimensionada e
   travada nessa escala.
4. Cotar: Ortogonal ou Alinhada, três cliques (ponto 1, ponto 2, afastamento da
   linha) — igual ao fluxo de cota do próprio SketchUp.
5. Repetir pra várias pranchas no mesmo projeto.

## Decisões já fechadas

- Import: só raster (PNG/JPG) no MVP — sem SVG/vetor.
- Cotas: ortogonal (auto h/v) + alinhada. Sem cota angular/raio ainda.
- Calibração redimensiona a imagem pra uma escala padrão exata, não calcula uma
  razão arbitrária a partir do tamanho atual.
- Um viewport por prancha no MVP.
- Texto de cota segue posição absoluta da NBR 6492 (acima/à esquerda da linha),
  não relativa ao lado do desenho.
- Sem modo Autor/Usuário — ferramenta de uso pessoal.

## Em aberto / Fase 2

- Persistência local (IndexedDB) + export/import de projeto (`.zip`) — ver seção
  acima, já desenhado, falta implementar.
- Export final em PDF vetorial (`jsPDF` + `svg2pdf.js`), uma página por prancha, no
  tamanho ISO exato.
- Cota angular, cota de raio.
- Camadas (mostrar/ocultar grupos de anotação).
- Múltiplos viewports por prancha, cada um com sua própria escala.
- Leader/chamada de texto solto, numeração circulada, linha de referência de nível,
  callout de detalhe/zoom — recursos vistos no fluxo real de trabalho que ainda não
  entraram no MVP.
- Carimbo/timbre de prancha (dados do projeto, escala, data, revisão).
- Biblioteca de símbolos reaproveitável entre projetos.
