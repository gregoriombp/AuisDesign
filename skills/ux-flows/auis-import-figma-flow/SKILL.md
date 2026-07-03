---
name: auis-import-figma-flow
description: >
  Imports a Figma flow as a screen-by-screen navigable PROJECT under
  `/auis/projects` — enumerates the frames via the Figma MCP,
  renders each screen as a screenshot (.webp in /public), generates the
  typed manifest in `app/auis/projects/_data/projects.ts`, and
  activates the "Projetos" card on the hub. The screens become cards with
  the "Atualizar pro design system" and "Construir no repo" buttons. Use
  when the user asks to "importar flow do Figma" (import a Figma flow),
  "criar projeto a partir do Figma" (create a project from Figma),
  "importar Memory Base / Agent Studio", "trazer as telas do Figma pro
  repo" (bring the Figma screens into the repo), or pastes a figma.com URL
  with the intent of importing it as a project. Do NOT use for
  `.awflow.json` → ReactFlow diagram (that is `auis-pg-create-flow`):
  here the source is a Figma URL and the output is
  SCREENSHOTS-as-a-project, not a node diagram.
---

# Auis — Importar flow do Figma como projeto

Traz um flow inteiro do Figma pro workbench `/auis/projects`: cada
tela = um frame renderizado como screenshot, navegável tela-a-tela, com
ações por tela. O design no Figma costuma estar num **design system
antigo** — o screenshot é só referência visual; o re-skin/build sempre
remapeia pros tokens e componentes Au* atuais (ver
[`auis-project-build-solve`](../auis-project-build-solve/SKILL.md)).

## Pré-requisitos

- Figma MCP autenticado — confirme com `whoami` (`mcp__figma__whoami`).
- O arquivo precisa estar no **Figma cloud** (o MCP não lê `.fig` local).
  Se o usuário só tem o `.fig`, peça pra abrir/subir no Figma e mandar a
  URL de share. O `.fig` é um ZIP com `canvas.fig` em formato kiwi
  (binário, instável) — não vale a pena parsear; a rota robusta é a URL.
- `cwebp` disponível (`which cwebp`) pra comprimir os screenshots. Sem
  ele, caia pra PNG (mais pesado) ou pare e avise.
- Existe `app/auis/projects/_data/projects.ts` com o tipo `Project`.
  Se não existir, algo está fora do lugar — pare e avise.

---

## Step 1 — Parsear a URL e definir o projeto

Da URL `figma.com/design/:fileKey/:nome?node-id=:a-:b`:
- `fileKey` = primeiro segmento.
- `nodeId` = `node-id` com `-` → `:` (ex: `929-29942` → `929:29942`).

⚠️ O node-id que o usuário copia costuma apontar pra um elemento solto
(um componente, não a página do flow). Confirme que é a **página/seção do
flow** no Step 2. `get_metadata(fileKey)` SEM nodeId lista páginas, mas
pode vir incompleto — sempre prefira o node-id do flow direto.

Pergunte (ou infira) `slug` + `title` do projeto (ex: `memory-base` /
"Memory Base"). O slug não pode colidir com `built` nem com slug
existente em `PROJECTS`.

---

## Step 2 — Enumerar as telas

`get_metadata(fileKey, nodeId)` no nó do flow. O subtree é grande →
costuma exceder o limite e ser salvo num arquivo. Parseie esse arquivo
(JSON `[{type,text}]` com XML dentro) com Python:

```python
import json, xml.etree.ElementTree as ET
data = json.loads(open(PATH, encoding="utf-8").read())
xml = "".join(p.get("text","") for p in data if p.get("text","").lstrip().startswith("<"))
root = ET.fromstring("<root>"+xml+"</root>")
```

- As **seções** (`<section>`) são os agrupadores do flow.
- As **telas** são os `<frame>` filhos com tamanho de tela (no Memory
  Base, 1920×1080 — ajuste o filtro pro tamanho do arquivo em mãos).
- O nome do frame costuma trazer ordem embutida: `... | Tela NN | Área | NN`.
  Derive `step` ("Tela NN"), `section` (nome da `<section>`), `name`
  (rótulo limpo, ex. "Homepage 01"), e `order` (ordem de fluxo:
  step → seção → número).

**Conte e CONFIRME com o usuário antes do download em massa** (ex: "São
73 telas em 16 seções, ~1.5 MB em .webp — sigo com tudo, ou um
subconjunto de seções?"). Permita subset.

---

## Step 3 — Renderizar e baixar cada tela

Crie `public/projects/<slug>/`. Pra cada frame:

1. `get_screenshot(fileKey, frameNodeId, maxDimension=1280)` → devolve uma
   `image_url` efêmera + `width`/`height`.
2. Baixe e converta pra webp. Faça em **lotes** (~12-14 `get_screenshot`
   concorrentes por mensagem, depois um `Bash` que baixa o lote — as URLs
   são curtas-duração, baixe logo):

```bash
B="https://www.figma.com/api/mcp/asset"
dl(){ curl -fsS -o /tmp/_dl.png "$B/$2" && cwebp -quiet -q 82 /tmp/_dl.png -o "$1.webp" && echo "ok $1" || echo "FAIL $1"; }
dl <id> <asset-uuid>   # id = nodeId com ":" -> "-"
```

O `id` (= `figmaNodeId` com `:`→`-`) é o nome do arquivo E a chave da
tela no manifest. Nunca persista a `image_url` do Figma (efêmera).

---

## Step 4 — Gerar o manifest

Escreva a entrada `Project` (com `screens[]`, todos `status:"imported"`)
em `app/auis/projects/_data/projects.ts`. Gere por script pra ficar
determinístico — uma tabela `(nodeId, name, step, section)` em ordem de
fluxo, e o script calcula `id`, `order`, `thumbnail`
(`/projects/<slug>/<id>.webp`), `w/h`. Faça um replace do
`export const PROJECTS: Project[] = []` (ou append à array se já houver
projetos). Campos do projeto: `figmaFileKey`, `figmaNodeId`, `figmaUrl`,
`importedAt`, `updatedAt`.

Depois **verifique** que todo `thumbnail` do manifest tem `.webp`
correspondente e que não há órfãos.

---

## Step 5 — Ativar o card do hub

Em `app/auis/page.tsx`, o item "Projetos" deve estar
`status: "ready"` (idempotente — se já estiver, pule). É o que troca
"Indisponível" por "Abrir".

---

## Step 6 — Validação

```bash
npm run typecheck
```

O dev server local normalmente já roda em `127.0.0.1:3000` — **não suba um
segundo** (Next 16 bloqueia). Verifique por HTTP (ou peça pro usuário
abrir no browser dele):

- `/auis` → card Projetos ativo (link `/auis/projects`).
- `/auis/projects` → card do projeto com "<N> telas".
- `/auis/projects/<slug>` → telas agrupadas por seção (confira a
  contagem de blocos de seção) + screenshots carregando.
- `GET /projects/<slug>/<id>.webp` → 200 `image/webp`.

**Não commite** — deixe o `git diff` pro usuário.

---

## Output esperado

```md
Projeto importado: <title>
Rota: /auis/projects/<slug>
Telas: <N> em <S> seções · <tamanho> em .webp
Fonte: figma.com/design/<fileKey> (node <figmaNodeId>)

Arquivos:
- app/auis/projects/_data/projects.ts (entrada do projeto)
- public/projects/<slug>/*.webp (<N> screenshots)
- app/auis/page.tsx (card "Projetos" -> ready, se 1º projeto)

Validação: typecheck passed · rotas 200
```

---

## O que NÃO fazer

- **Não hotlinkar** a `image_url` do Figma — é efêmera; sempre baixe.
- **Não parsear o `.fig` local** — formato kiwi instável; use a URL.
- **Não construir/re-skinar telas aqui** — import só renderiza +
  manifesta. Build é `auis-project-build-solve`.
- **Não renomear ids** — `id`/`figmaNodeId` são chaves estáveis (arquivo,
  store, builtRoute). Mantenha o `nodeId` do Figma.
- **Não criar tokens novos** (regra do `AGENTS.md`).
- **Não usar slug `built`** (colide com a rota das telas construídas).
- **Não commitar.**
