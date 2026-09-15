# Prancheta Livre — Plano do Projeto

## Visão geral

Editor de pranchas vetoriais para desenho técnico de arquitetura: importa uma imagem
raster (exportada do SketchUp Web free, ou qualquer PNG/JPG), permite posicioná-la
como "viewport" dentro de uma prancha de tamanho ISO, calibrar essa imagem pra uma
escala real de plotagem, cotar (ortogonal ou alinhada) seguindo as convenções da
NBR 6492, anotar (chamada, numeração, nível, detalhe) e exportar em PDF vetorial.
Substitui a etapa manual que hoje é feita no Inkscape.

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
- `annotations[]`: chamadas (`leader`), numeração circulada (`marker`), linha de
  nível (`level`) e chamada de detalhe (`callout`) — ver seção própria abaixo.
- `titleBlock`: campos editáveis do carimbo específicos da prancha (título, data,
  revisão).

**Project**
- `name`, `client`, `author` — campos do carimbo que valem pra todas as pranchas do
  projeto, editados uma vez só (botão "Projeto" na barra de ferramentas).

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

**Annotation (chamada / numeração / nível / detalhe)**
- `leader`: ponto apontado (`anchor`) + posição do texto (`label`) + `text`. Dois
  cliques (âncora, depois o texto) e um prompt pra digitar o conteúdo.
- `marker`: só uma posição (`pos`); um clique cria o próximo número da sequência —
  o número exibido é derivado da posição no array (`índice + 1`), nunca guardado,
  então excluir um marcador renumera os seguintes automaticamente.
- `level`: `y` + `x1`/`x2` (extensão horizontal) + `text` — linha tracejada
  atravessando a prancha, pra marcar nível/cota de referência (ex. "0,00 PISO
  TÉRREO"). Dois cliques + prompt.
- `callout`: `rect` (área marcada) + `targetPos` (onde a chamada aponta) + `text`.
  Três cliques (dois cantos da área, depois o ponto de destino) + prompt. É uma
  **referência** a um detalhe — desenha o retângulo tracejado e as linhas
  convergentes com uma legenda (ex. "DETALHE A"), mas não gera uma segunda vista
  ampliada automaticamente; isso depende de múltiplos viewports por prancha
  (Fase 5, ainda não implementada — ver "Em aberto").
- Todas as ferramentas de anotação de múltiplos cliques (`leader`/`level`/`callout`)
  compartilham um único estado genérico no store (`draft`), evitando duplicar a
  máquina de estados que a cota/calibração já têm.

**Carimbo (título block)**
- Uma faixa fixa de 16mm na base de cada prancha, sempre presente (não é opcional
  nem tem múltiplos templates ainda — isso é Fase 6). Mostra nome do projeto e
  título da prancha à esquerda; à direita, 4 células: ESCALA e PRANCHA (nº/total)
  são **derivadas automaticamente** (da calibração da imagem e da posição da
  prancha na lista, respectivamente — nunca digitadas), DATA e REV. são editáveis.
- Edição é direta no desenho: clicar no título da prancha, na data ou na revisão
  abre um prompt de texto ali mesmo — sem painel de propriedades separado.

**Histórico (undo/redo)**
- Pilha de snapshots (`past`/`future`) do array `sheets` inteiro no store — mais
  simples e mais robusto que um padrão de comando com inversas por ação, ao custo
  de granularidade um pouco mais grosseira (aceitável nessa escala de dados).
- `commitHistory()` é chamado uma vez só por ação discreta (criar prancha, apagar
  cota, calibrar, etc.) e uma vez só no **início** de cada arraste (mover prancha,
  redimensionar imagem, ajustar afastamento de cota, mover anotação) — nunca a cada
  `pointermove`, senão um arraste de 200 quadros viraria 200 passos de undo.

## Stack técnico

- React + TypeScript + Vite, mesmo padrão do Paginazilla.
- **SVG nativo** pra cada prancha (sem Konva) — cada prancha é um grupo `<g>` com
  coordenadas em mm; como a escala de calibração já é a escala real de plotagem, o
  SVG da prancha corresponde 1:1 ao que sai impresso.
- Interações (mover, redimensionar, ajustar cota) via pointer events próprios, sem
  lib de canvas — implementado à mão em `Canvas.tsx`.
- Zustand (`state/projectStore.ts`) pro estado do projeto inteiro.
- `idb` pro auto-save local; `jszip` pro export/import de projeto; `jsPDF` +
  `svg2pdf.js` pro export em PDF — os três carregados sob demanda (`import()`
  dinâmico) pra não pesar o carregamento inicial do app.
- Sem backend, deploy estático (GitHub Pages via Actions).

## Persistência (implementado)

- **Continuar a sessão (auto-save local)**: IndexedDB (`src/lib/persistence.ts`),
  guardando a imagem como `Blob` — não base64. `localStorage` tem cota de ~5-10MB
  por origem e só guarda string; uma imagem de planta facilmente passa de 1-3MB, e
  base64 infla ~33% em cima disso. O app salva com debounce (~800ms) a cada mudança
  em `sheets`/`project`, e ao abrir tenta carregar o projeto salvo antes de recorrer
  ao exemplo semeado.
- **Exportar/importar um arquivo de projeto** (`src/lib/projectFile.ts`): `.zip`
  (`manifest.json` com os dados vetoriais + pasta `images/` com os PNGs de
  verdade) — mesmo padrão de bundle que o Paginazilla já usa pra publicar cenário.
- Base64 só aparece de forma transitória no `href` do `<image>` do SVG enquanto
  edita — nunca como formato de armazenamento.

## Exportação em PDF (implementado)

- `src/lib/pdfExport.tsx`: pra cada prancha, monta um `<svg>` isolado (fora da
  tela, via `createRoot`+`flushSync` do React) reaproveitando o mesmo componente
  `SheetView` da edição — sem handles/seleção (`tool: 'select'`, seleção nula,
  handlers vazios) — garantindo que o PDF é fiel ao que se vê editando. Cada
  prancha vira uma página do PDF no tamanho ISO exato (`jsPDF({ format: [w, h] })`,
  unidade mm), convertida via `svg2pdf.js`. Como o viewBox do SVG de exportação é
  1:1 com o tamanho da prancha em mm, a espessura de linha (`stroke-width`) sai
  correta em mm no PDF sem cálculo extra.

## Fluxo

1. Criar prancha → tamanho ISO + orientação.
2. Importar imagem (PNG/JPG) → vira viewport, ajustável (mover/redimensionar) antes
   de calibrar.
3. Calibrar: dois pontos + comprimento real + escala → imagem redimensionada e
   travada nessa escala.
4. Cotar: Ortogonal ou Alinhada, três cliques (ponto 1, ponto 2, afastamento da
   linha) — igual ao fluxo de cota do próprio SketchUp.
5. Anotar: chamada, numeração, nível ou detalhe, conforme a necessidade.
6. Preencher o carimbo (projeto uma vez, título/data/revisão por prancha).
7. Repetir pra várias pranchas no mesmo projeto.
8. Exportar PDF pra impressão/entrega, ou exportar `.zip` pra backup/versionamento.

## Decisões já fechadas

- Import: só raster (PNG/JPG) no MVP — sem SVG/vetor.
- Cotas: ortogonal (auto h/v) + alinhada. Sem cota angular/raio ainda.
- Calibração redimensiona a imagem pra uma escala padrão exata, não calcula uma
  razão arbitrária a partir do tamanho atual.
- Um viewport por prancha no MVP — chamada de detalhe é só referência visual
  (retângulo + legenda), não gera segunda vista ampliada ainda.
- Texto de cota segue posição absoluta da NBR 6492 (acima/à esquerda da linha),
  não relativa ao lado do desenho.
- Sem modo Autor/Usuário — ferramenta de uso pessoal.
- Persistência local em IndexedDB (Blob) + export/import de projeto em `.zip`,
  nunca base64 como formato de armazenamento.
- Carimbo é um template único fixo (sem editor de template ainda), com
  escala/numeração automáticas e os demais campos editáveis por clique direto.
- Undo/redo por snapshot do array de prancha inteiro, commitado uma vez por ação
  ou uma vez por arraste — não por comando com inversa nem por frame de arraste.

## Testes

- `e2e/` com Playwright (`@playwright/test`), cobrindo os fluxos centrais: CRUD de
  prancha, import + calibração, cota ortogonal/alinhada (criar, sobrescrever texto,
  apagar), as 4 ferramentas de anotação, undo/redo (inclusive limites da pilha) e
  persistência (resume após reload, export de `.zip`/PDF, edição de dados do
  projeto). Rodar com `npm run test:e2e`.
- `playwright.config.ts` sobe o próprio `npm run dev` como servidor de teste
  (`webServer`) e reaproveita um Chromium pré-instalado quando presente no ambiente
  (variável `PLAYWRIGHT_CHROMIUM_PATH` ou `/opt/pw-browsers/chromium`), caindo pro
  comportamento padrão do Playwright (`playwright install`) em qualquer outra
  máquina/CI onde esse caminho não exista.

## Em aberto / Fase 2 em diante

- Cota angular, cota de raio.
- Camadas (mostrar/ocultar grupos de anotação).
- Múltiplos viewports por prancha, cada um com sua própria escala — pré-requisito
  pra callout de detalhe virar uma vista ampliada de verdade em vez de só uma
  referência visual.
- Editor de template de carimbo (hoje é um template único fixo) e templates
  customizáveis.
- Biblioteca de símbolos reaproveitável entre projetos.
