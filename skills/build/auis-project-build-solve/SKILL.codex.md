---
name: auis-project-build-solve
description: >
  Fulfills, in bulk, the per-screen action requests from the
  `/auis/projects` workbench — the "Atualizar pro design system"
  button (kind `restyle`) and the "Construir no repo" button (kind
  `build`) write requests to `/api/project-builds` (stored in
  `flow-bridge/data/project-builds.json`). This skill reads the requests
  (with a filter), MAKES A PLAN and waits for approval, then: for
  `build`, rebuilds the screen as a real page using Au* components and
  current tokens (backed by `auis-new-page`), using Figma's
  `get_design_context` as reference; for `restyle`, produces a preview in
  the current DS. It stamps each request `in_review`/`apply` with
  `actor {kind:"agent",id:"claude",name:"Claude"}` + `builtRoute`, and
  updates the manifest. Use when the user asks to "resolve os builds dos
  projetos" (resolve the project builds), "constrói as telas pedidas"
  (build the requested screens), "aplica os pedidos do Memory Base"
  (apply the Memory Base requests), or "pega os pedidos de build e
  resolve" (take the build requests and resolve them). Do NOT use it for
  importing (that is `auis-import-figma-flow`) nor for UX Flow
  suggestions (that is `auis-flow-bridge-solve`).
---

# Auis — Resolver pedidos de build/restyle dos projetos

Os cards de tela em `/auis/projects/<slug>` têm dois botões que
gravam pedidos via `POST /api/project-builds`. Esta skill consome essa
fila e cumpre os pedidos — sempre com **plano + aprovação antes de mexer
em código**, no mesmo espírito do
[`auis-review-bridge-solve`](../auis-review-bridge-solve/SKILL.md).

## Pré-requisitos

- Dev server da LAN no ar (`:3000`) pra falar com a API. **Não suba um
  segundo** (Next 16 bloqueia).
- Existe `app/api/project-builds/` (store + rotas) e o manifest
  `app/auis/projects/_data/projects.ts`.

---

## Step 1 — Ler a fila

`GET /api/project-builds` com o filtro que o usuário pediu:
`?projectSlug=&screenId=&kind=&status=`. Default: `status=open`.

```bash
curl -s "http://localhost:3000/api/project-builds?projectSlug=<slug>&status=open" | python3 -m json.tool
```

Cada pedido traz `kind` (`restyle`|`build`), `screenId`, `screenName`,
`figmaFileKey`, `figmaNodeId`, `thumbnail`, `note?`. Se a fila estiver
vazia, diga isso e pare.

---

## Step 2 — Plano (antes de qualquer código)

Pra cada pedido, monte uma linha no plano:
- tela (`screenName` + `figmaNodeId`), `kind`, e o que será feito.
- pra `build`: a rota de destino (ver Step 4) e os componentes Au* que
  pretende usar.

Mostre o plano e **espere aprovação explícita**. Se um pedido for
ambíguo, marque-o pra perguntar (pode responder com pergunta em vez de
agir).

---

## Step 3 — Referência da tela (Figma)

Pra cada tela a tratar, puxe a estrutura como REFERÊNCIA (não fonte da
verdade): `get_design_context(figmaFileKey, figmaNodeId)`. Veja também o
screenshot já importado em `public/projects/<slug>/<screenId>.webp`.
O design vem do **DS antigo** — você re-mapeia a intenção (layout,
hierarquia, copy) pros tokens e componentes Au* atuais. Siga
[`auis-new-page`](../auis-new-page/SKILL.md) pra montar a
página (lookup de componente: Au* → shadcn → custom; tokens são sagrados).

---

## Step 4 — Construir (`build`) ou re-skinar (`restyle`)

**`build`** — página real, roteável:
- Rota: `app/auis/projects/built/<slug>/<screenId-ou-nome>/page.tsx`.
  Use o segmento estático `built/` — ele **não** colide com a rota
  `projects/[slug]` (desde que nenhum projeto tenha slug `built`).
  ⚠️ NÃO crie uma pasta com o nome do slug do projeto sob `projects/`:
  isso sombreia o viewer `[slug]`.
- `builtRoute` = `/auis/projects/built/<slug>/<...>`.
- Componha com Au* (ex: a tela de boas-vindas do Memory Base usa
  `AuMemoryBaseLogo` + `AuButton`). Inclua uma barra de contexto no topo
  ("Reconstruído de <step · name>", link de volta ao projeto, link
  "Original no Figma"). Tela desktop-only.

**`restyle`** — preview de re-skin no DS atual (sem virar rota de produto
necessariamente). Trate como um `build` mais leve/parcial, ou um preview
lado-a-lado, conforme o pedido.

---

## Step 5 — Transicionar o pedido + atualizar o manifest

1. (Opcional) `PUT /api/project-builds/<id>` `{transition:"in_review",
   actor:{kind:"agent",id:"claude",name:"Claude"}}` ao começar.
2. Ao concluir: `PUT .../<id>` `{transition:"apply",
   actor:{kind:"agent",id:"claude",name:"Claude"}, builtRoute:"<rota>"}`.
   Isso carimba a resolução e arquiva o pedido.
3. **Atualize o manifest** (`_data/projects.ts`) na tela correspondente:
   `status: "built"` (ou `"restyled"`) + `builtRoute`. O manifest é o
   estado durável; a API é só a fila. É o manifest que faz o card mostrar
   a pill "No repo" + "Ver no repo".

Se o usuário rejeitar depois, ele resolve pelo inbox/`discard` — não
desfaça automaticamente.

---

## Step 6 — Validação

```bash
npm run typecheck
```

Confirme por HTTP: a `builtRoute` responde 200, e o card da tela no
viewer agora mostra a pill "No repo" linkando pra ela. **Não commite.**

---

## Output esperado

```md
Pedidos resolvidos: <N> (<builds> build · <restyles> restyle)

Por tela:
- <screenName> [<kind>] -> <builtRoute> (status: applied)

Arquivos:
- app/auis/projects/built/<slug>/<...>/page.tsx (novos)
- app/auis/projects/_data/projects.ts (status/builtRoute)

Store: <N> pedidos em applied (arquivados)
Validação: typecheck passed · rotas 200
```

---

## O que NÃO fazer

- **Não mexa em código antes do plano aprovado.**
- **Não crie pasta `projects/<slug>/`** pra telas construídas — sombreia
  o viewer `[slug]`. Use sempre `projects/built/<slug>/...`.
- **Não invente tokens** nem use valores arbitrários de cor/spacing — só
  Au* + tokens existentes (`AGENTS.md`).
- **Não copie o pixel do DS antigo** — re-mapeie pro DS atual; o
  screenshot é referência de intenção, não de estilo.
- **Não edite o manifest E o store na mão pra "forçar" estado** — o
  fluxo é: API arquiva o pedido (apply) + skill escreve o manifest.
- **Não commitar.**
