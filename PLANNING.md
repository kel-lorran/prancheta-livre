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
- `groups[]`: N grupos de imagem por prancha (ver `ImageGroup` abaixo) — não existe
  mais limite de uma imagem por prancha.
- `titleBlock`: campos editáveis do carimbo específicos da prancha (título, data,
  revisão).

**ImageGroup (grupo de imagens)** — a peça central do modelo, desde a feature
"Imagens Vinculadas"
- **Não existe imagem sem grupo.** Uma imagem solta é só um grupo de 1 membro,
  criado automaticamente e sem fricção no import — nunca há um caminho pra criar
  uma imagem "de fora" de qualquer grupo.
- `x,y,w,h`: frame do grupo, mm relativos à origem da prancha. `locked` +
  `realMetersPerMm`: calibração — **do grupo**, não de cada imagem.
- `images[]`: membros (`SheetImage`), ordem = z-index (índice 0 = fundo). Cada
  membro tem posição/tamanho **locais ao frame do grupo**, sua própria trava
  (`locked`, independente da trava do grupo) e seu próprio recorte
  (`crop: Point[] | null`, polígono em fração 0–1 do bounding box da própria
  imagem — `clipPathUnits="objectBoundingBox"`, sobrevive a mover/redimensionar).
- `dims[]` e `annotations[]`: pertencem ao **grupo**, não à imagem — cota mede a
  cena composta (planta + mobiliário), não um PNG isolado. Pontos guardados como
  **fração (0–1) do frame do grupo**, não mm absolutos da prancha — a mesma técnica
  do recorte, um nível acima. Isso é o que faz cota/anotação sobreviverem a mover,
  redimensionar e recalibrar o grupo sem precisar resetar nada (ver
  `src/lib/groupGeometry.ts` pros conversores fração↔mm).
- **Contexto de edição**: duplo-clique (ou clique + Enter) "entra" no grupo — igual
  ao Group do SketchUp. Fora do contexto, clique/arraste/redimensiona o grupo
  inteiro; dentro, cada membro é selecionável/arrastável individualmente, e
  Importar/Colar passam a mirar naquele grupo em vez de criar um novo. Esc (ou
  clicar fora dos limites do grupo) sai do contexto.
- **Agrupar / desagrupar** (Ctrl+G / Ctrl+Shift+G): funde 2+ grupos selecionados
  num só, ou quebra um grupo de volta em N grupos-de-1. Ao fundir, se as partes já
  tinham calibração própria, cada membro é redimensionado pra preservar seu
  tamanho real dentro da escala do grupo resultante.
- **Copiar / cortar / colar** (Ctrl+C/X/V, Ctrl+Shift+V cola no lugar): opera sobre
  o grupo selecionado inteiro, ou sobre um membro (que vira um grupo-de-1 ao
  copiar). Cola dentro do contexto de grupo aberto vira um novo membro dele.

**Project**
- `name`, `client`, `author` — campos do carimbo que valem pra todas as pranchas do
  projeto, editados uma vez só (botão "Projeto" na barra de ferramentas).

**Calibração** (o ponto central do app)
- O autor clica dois pontos sobre um comprimento conhecido da imagem, informa o
  comprimento real e escolhe a escala de plotagem (lista de escalas padrão de
  arquitetura: 1:20 até 1:1000, ou personalizada).
- O app **redimensiona o grupo inteiro** (mantendo proporção, ancorado no primeiro
  ponto clicado, escalando todos os membros junto) até que aquele segmento meça
  exatamente o correspondente real naquela escala — ex.: 2m reais em 1:100 viram
  2cm no papel.
- A partir daí `realMetersPerMm = 1/escala/1000` é um valor exato de escala padrão
  (não uma razão arbitrária calculada), e o grupo é travado (só move, não
  redimensiona) — mesma lógica de "travar tamanho" do Paginazilla.
- **Ajustar à escala do grupo**: quando um membro novo chega sem escala própria
  (ex. um PNG de mobiliário vindo de outro lugar), a mesma interação (dois cliques
  + comprimento real) redimensiona **só aquele membro** pra bater com a escala que
  o grupo já tem, sem tocar no resto.
- Cotas usam sempre a calibração do grupo: a distância entre dois pontos (fração ×
  frame do grupo, em mm) × `realMetersPerMm` = comprimento real.

**Dimension (cota)**
- `mode`: `h` (horizontal), `v` (vertical) ou `aligned` (segue o ângulo do segmento).
- No app, a ferramenta de cota expõe só duas opções pro usuário — **Ortogonal**
  (decide `h`/`v` sozinha comparando Δx e Δy dos dois pontos clicados) e **Alinhada**
  — nunca pede pra escolher H ou V manualmente.
- Geometria e posição do texto seguem NBR 6492: linha de chamada parando a 2mm do
  ponto, texto 1,5mm acima/à esquerda da linha (nunca quebrando a linha, sempre do
  lado absoluto certo — não relativo a onde o desenho está), altura de texto 3mm,
  tick de 45°.

**Annotation (chamada / numeração / nível)**
- `leader`: ponto apontado (`anchor`) + posição do texto (`label`) + `text`. Dois
  cliques (âncora, depois o texto) e um prompt pra digitar o conteúdo.
- `marker`: só uma posição (`pos`); um clique cria o próximo número da sequência —
  o número exibido é derivado da posição no array (numeração roda pela prancha
  inteira, cruzando grupos), nunca guardado, então excluir um marcador renumera os
  seguintes automaticamente.
- `level`: `y` + `x1`/`x2` (extensão horizontal) + `text` — linha tracejada
  atravessando a prancha, pra marcar nível/cota de referência (ex. "0,00 PISO
  TÉRREO"). Dois cliques + prompt.
- `callout` (chamada de detalhe): tipo mantido pra ler projetos antigos, mas a
  **ferramenta está desativada** — era só uma referência visual estática (retângulo
  + legenda), sem vista ampliada de verdade, e não convenceu. Ponto em aberto:
  volta redesenhada em cima de grupo (o alvo natural agora que existe composição),
  se/quando fizer sentido implementar o zoom real.
- Todas as ferramentas de anotação de múltiplos cliques (`leader`/`level`)
  compartilham um único estado genérico no store (`draft`), evitando duplicar a
  máquina de estados que a cota/calibração já têm.

**Recorte (crop)**
- Por **imagem-membro**, não por grupo — cada PNG carrega sua própria sujeira
  (marca d'água, linhas de eixo do SketchUp) pra mascarar, independente das outras
  camadas do grupo.
- Um modo só: **polígono livre de N pontos** — retângulo é só um caso particular (4
  cliques em ângulo reto), não precisa de um segundo modelo de dado nem modo de UI.
- Entrada via **botão direito na imagem → Recortar** (ou Editar recorte/Remover
  recorte se já existe um) — não é uma ferramenta persistente na barra. Clique
  adiciona vértice, Enter/clicar fora/trocar de ferramenta confirma, Esc cancela.
  Editando um recorte existente: arrastar vértice move, clicar no meio de uma
  aresta insere ponto, duplo-clique remove.
- Nunca afeta cota/anotação — não mexe em x/y/w/h/realMetersPerMm de nada, é só uma
  máscara visual por cima.

**Seleção múltipla / janela de seleção**
- Arrastar em área vazia da prancha (fora de qualquer grupo/cota/anotação) desenha
  uma janela — semântica do AutoCAD: **esquerda→direita = Window** (seleciona só o
  que estiver totalmente contido), **direita→esquerda = Crossing** (seleciona tudo
  que a janela tocar). Shift+clique soma/tira item individual. Delete apaga tudo
  de uma vez.
- Pan (arrastar o fundo) passa a ser exclusivo do botão do meio do mouse.
- **Alt+clique** cicla pela pilha de grupos sobrepostos no mesmo ponto.
- Essa é a rede de segurança deliberada que substitui os resets automáticos que o
  app tinha antes — ver "Decisões já fechadas" abaixo.

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
2. Importar imagem (PNG/JPG) → cria um grupo novo (ou entra num grupo existente
   pra compor), ajustável (mover/redimensionar) antes de calibrar.
3. Calibrar: dois pontos + comprimento real + escala → grupo redimensionado e
   travado nessa escala. Membro novo sem escala própria → "Ajustar à escala do
   grupo".
4. Cotar: Ortogonal ou Alinhada, três cliques (ponto 1, ponto 2, afastamento da
   linha) — igual ao fluxo de cota do próprio SketchUp.
5. Anotar: chamada, numeração ou nível, conforme a necessidade.
6. Recortar (botão direito na imagem) pra tirar sujeira de export do SketchUp.
7. Preencher o carimbo (projeto uma vez, título/data/revisão por prancha).
8. Repetir pra várias pranchas no mesmo projeto.
9. Exportar PDF pra impressão/entrega, ou exportar `.zip` pra backup/versionamento.

## Decisões já fechadas

- Import: só raster (PNG/JPG) no MVP — sem SVG/vetor.
- Cotas: ortogonal (auto h/v) + alinhada. Sem cota angular/raio ainda.
- Calibração redimensiona o grupo pra uma escala padrão exata, não calcula uma
  razão arbitrária a partir do tamanho atual.
- N grupos por prancha, cada um com N imagens-membro e sua própria escala — não
  existe mais limite de uma imagem por prancha.
- Nenhuma ação (mover, redimensionar, recalibrar, recortar, substituir um membro)
  reseta cota ou anotação — só excluir o grupo inteiro faz isso, em cascata. Isso
  foi possível porque cota/anotação/recorte viraram frações do frame do grupo (ou
  da imagem, no caso do recorte) em vez de mm absolutos da prancha. No lugar do
  reset automático como rede de segurança, existe seleção múltipla deliberada
  (janela AutoCAD-style + Shift+clique) pra limpar vários elementos de uma vez.
- Texto de cota segue posição absoluta da NBR 6492 (acima/à esquerda da linha),
  não relativa ao lado do desenho.
- Sem modo Autor/Usuário — ferramenta de uso pessoal.
- Persistência local em IndexedDB (Blob) + export/import de projeto em `.zip`,
  nunca base64 como formato de armazenamento.
- Carimbo é um template único fixo (sem editor de template ainda), com
  escala/numeração automáticas e os demais campos editáveis por clique direto.
- Undo/redo por snapshot do array de prancha inteiro, commitado uma vez por ação
  ou uma vez por arraste — não por comando com inversa nem por frame de arraste.
- Chamada de detalhe (callout) desativada — era só referência visual estática, sem
  vista ampliada de verdade, e não convenceu (tipo mantido só pra ler dados
  antigos).

## Testes

- `e2e/` com Playwright (`@playwright/test`), cobrindo os fluxos centrais: CRUD de
  prancha, import + calibração, cota ortogonal/alinhada (criar, sobrescrever texto,
  apagar), leader/numeração/nível, grupos (entrar/importar membro, recorte
  criar/editar/remover, agrupar/desagrupar, copiar/colar), seleção múltipla
  (janela + bulk delete), modal de dicas, undo/redo (inclusive limites da pilha) e
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
- Chamada de detalhe com zoom real num grupo (hoje desativada) — o grupo já é um
  alvo que faz sentido pra isso, falta decidir se vale implementar a vista
  ampliada de verdade.
- Recorte do grupo inteiro (aparar a composição final já montada), além do
  recorte por imagem-membro que já existe.
- Editor de template de carimbo (hoje é um template único fixo) e templates
  customizáveis.
- Biblioteca de símbolos reaproveitável entre projetos.
