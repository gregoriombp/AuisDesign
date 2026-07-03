---
name: auis-pg-create-flow
description: >
  Creates a NEW UX flow in the styleguide
  (`/auis/styleguide/ux-flows/[slug]`) from an `.awflow.json` file
  exported from the PG (designer) repo. Reads the file (local path or
  pasted content), parses it via `parseAuFlowFile`, maps it to the
  `<FlowDiagram>` shape via `mapAuFlowToLocal`, asks for the screens'
  `href` values (PG doesn't carry that info), scaffolds the full page,
  and registers it in `navigation.ts`. Use when the user asks to
  "importar flow do PG" (import a flow from PG), "criar flow a partir do
  .awflow" (create a flow from the .awflow), "novo flow do design" (new
  flow from design), "scaffold do .awflow.json", or attaches/points to
  an `.awflow.json` file to create a brand-new flow. Do NOT use when the
  slug already exists in `ux-flows/` — for that case, use
  `auis-pg-merge-flow`.
---

# Auis PG — Create flow from `.awflow.json`

Cria um novo flow no styleguide a partir do export do designer (PG). O
arquivo `.awflow.json` carrega o diagrama (nodes + edges) e specs das
telas (propósito, cenários, critérios). Esta skill **não** mescla — se o
flow já existe, redirecione pra [`auis-pg-merge-flow`](../auis-pg-merge-flow/SKILL.md).

## Pré-requisitos

- Existe `app/auis/styleguide/ux-flows/_lib/awflow-import.ts` no
  repo (módulo do importer). Se não existir, pare e avise o usuário —
  algo está fora do lugar.
- Existe pelo menos um flow de referência em `ux-flows/login-auth/` ou
  `ux-flows/primeiro-acesso/` pra copiar o padrão de página.

---

## Step 1 — Localizar e validar o arquivo

O usuário fornece o `.awflow.json` de uma destas formas:

1. **Path local** — "use /Users/.../login.awflow.json"
2. **Conteúdo colado** — JSON no próprio chat
3. **Anexado no Claude** — arquivo visível na conversa

Carregue o conteúdo. Em seguida, valide rodando o `parseAuFlowFile`
através de uma chamada temporária (você pode usar uma `tsx`-like inline,
ou simplesmente ler o JSON e checar:

- `schemaVersion === 1`
- `flow.id` é string não-vazia
- `graph.nodes` array, `graph.edges` array
- `screens` array

Se qualquer um falhar, **pare** e mostre o erro pro usuário. Não tente
"corrigir" o arquivo — peça um export limpo do PG.

---

## Step 2 — Resolver o slug

- O default é `file.flow.id` (ex: `"login"`, `"pa-responsavel"`).
- O styleguide do meu repo usa slugs próprios — ex: o flow do PG `login`
  pode virar `login-auth` aqui. Liste os flows existentes em
  `app/auis/styleguide/ux-flows/` e pergunte ao usuário se ele
  quer o slug do PG ou outro.
- Se o slug escolhido **já existe**, pare e diga: "esse flow já existe.
  Use `auis-pg-merge-flow`."

---

## Step 3 — Mapear pro shape local

Carregue o importer dinamicamente (via `tsx`/`node --import tsx/esm`,
ou através do dev server com um endpoint temporário se mais fácil) e
rode `mapAuFlowToLocal(file)`. Você obtém:

- `nodes` — `Node<ScreenData|DecisionData>[]` prontos pro `<FlowDiagram>`
- `edges` — `Edge[]` com `markerEnd`, `style`, `sourceHandle` corretos
- `meta` — `{ id, title, description, section }`
- `screens` — specs ricas (purpose, scenarios, criteria) pra cada tela
- `narrative` — `{ persona, context, value }` (pode ser null)
- `proposedUpdate` — sugestão de primeira entrada em `updates[]`
- `screensMissingHref` — lista de IDs de telas screen sem href

Se preferir não rodar runtime, faça o map **na mão** seguindo o que o
`awflow-import.ts` faz (a função é pura e o código é a referência).
Mas runtime é mais seguro contra drift.

---

## Step 4 — Resolver `href` de cada tela

O PG não tem o conceito de href (rota real do produto). Esse é o único
campo do `ScreenData` que precisa de input humano.

Pra cada id em `screensMissingHref`:

1. Mostre `screen.name` + `screen.purpose` (pelas specs do JSON).
2. Sugira 1-3 rotas plausíveis com base no nome/propósito (ex: tela
   "login" → `/login`, `/`, `/entrar`).
3. Pergunte ao usuário; aceite o valor literal, "#" (placeholder), ou
   "skip" (deixa "#").

**Não pergunte um por um se forem mais que 6 telas** — apresente todas
de uma vez (lista numerada) e peça pro usuário responder em batch.
Reduza fricção.

---

## Step 5 — Resumo + análise UX leve

Antes de criar arquivos, mostre um plano:

```
Novo flow: <meta.title>
Slug: ux-flows/<slug>
Section: <meta.section>

Diagrama:
- <X> screens, <Y> decisions
- <Z> edges (<W> branches)

Telas com href real: <count>/<total>
Telas com href "#" (placeholder): <count>

Narrativa: <persona resumida, se houver>

Updates iniciais: 1 entrada ("Estrutura importada de [repo] em [data]")
```

**Análise UX rápida** — só sinalize, não bloqueie:

- Decisions sem branch de erro (saída só "sim", sem "não") — comum, mas
  vale flagar
- Nodes terminal sem caminho de volta (dead-end) — normal pra success,
  problemático pra erro
- Branches que convergem rápido demais (pode estar perdendo
  granularidade)
- Muitas decisions seguidas sem screen entre elas (decision chain
  longa) — pode confundir o leitor

**Não corrija**. Apenas mencione no resumo: "FYI: encontrei N pontos
que podem valer revisar — quer ver detalhe ou seguir?"

Peça **aprovação explícita** antes de criar arquivos.

---

## Step 6 — Scaffold da página

Crie `app/auis/styleguide/ux-flows/<slug>/page.tsx` seguindo o
padrão das páginas existentes (use `login-auth/page.tsx` ou
`primeiro-acesso/page.tsx` como referência).

Estrutura mínima:

```tsx
"use client"

import { PageHero } from "../../_primitives"
import { Section } from "../../_primitives"
import {
  FlowDiagram,
  edgeBase,
  branchEdge,
} from "../_components/flow-editor"
import {
  FlowUpdatesBadge,
  FlowUpdatesHistorySection,
  type FlowUpdate,
} from "../_components/flow-updates"
import type { Node, Edge } from "@xyflow/react"
import type { ScreenData, DecisionData } from "../_components/flow-editor"

const NODES: Node<ScreenData | DecisionData>[] = [
  // ... do mapped.nodes, COM os hrefs preenchidos
]

const EDGES: Edge[] = [
  // ... do mapped.edges
]

const updates: FlowUpdate[] = [
  // proposedUpdate do mapper
]

export default function Page() {
  return (
    <main>
      <PageHero
        title="<meta.title>"
        trailing={<FlowUpdatesBadge updates={updates} />}
      >
        <p>{/* meta.description em markdown */}</p>
      </PageHero>

      <Section id="diagrama" title="Diagrama" lead="...">
        <FlowDiagram flow="<slug>" nodes={NODES} edges={EDGES} />
      </Section>

      {/* opcional: Section "Narrativa" se narrative != null */}
      {/* opcional: Section "Critérios" listando screens[].criteria */}

      <FlowUpdatesHistorySection updates={updates} />
    </main>
  )
}
```

Notas:

- Use **edgeBase** ou **branchEdge** misturados ao output do mapper —
  o mapper já preencheu `markerEnd` e `style`, então no .tsx final é
  só listar.
- `FlowDiagram` precisa do prop `flow="<slug>"` (chave pro bridge de
  sugestões — ver `flow-editor.tsx`).
- Adicione `Section`s pra narrativa e critérios **somente se a
  narrativa estiver presente**. Sem narrativa, o conteúdo da página é
  só o diagrama + updates.
- **Não invente conteúdo**: se o screen não tem `purpose`, não escreva
  prosa do nada — deixe a seção vazia ou omita.

---

## Step 7 — Registrar em `navigation.ts`

Edite `app/auis/styleguide/navigation.ts`. Adicione na seção "UX
Flows" (ou seção apropriada se for `section: "adm"`):

```ts
{
  name: "<meta.title>",
  href: "/auis/styleguide/ux-flows/<slug>",
}
```

Mantém ordem alfabética dentro da seção quando possível.

---

## Step 8 — Validação

```bash
npm run typecheck
```

Se passar:

- Abra `http://localhost:3000/auis/styleguide/ux-flows/<slug>` no
  browser (se o dev server estiver na LAN, ajuste o host).
- Confirme: PageHero com badge "Atualizado em", diagrama renderiza,
  cards de tela têm o href correto.
- Confirme que o link na sidebar do styleguide aparece.

Se o usuário quiser ver o diff visual antes, **não rode `git add`** —
deixa ele revisar com `git diff` e commitar quando estiver pronto.

---

## Output esperado

```md
Flow criado: <meta.title>

Rota: /auis/styleguide/ux-flows/<slug>
Section: <studio|adm>

Diagrama:
- <X> screens, <Y> decisions
- <Z> edges (<W> branches)
- <count>/<total> telas com href real

Updates: 1 entrada inicial (importação de <repo>)

Arquivos:
- app/auis/styleguide/ux-flows/<slug>/page.tsx (novo)
- app/auis/styleguide/navigation.ts (entrada adicionada)

Validação:
- typecheck: passed
```

---

## O que NÃO fazer

- **Não invente hrefs.** Se o usuário não souber a rota, deixa "#".
- **Não combine com merge.** Se o slug existe, pare e redirecione.
- **Não tente "melhorar" o diagrama** automaticamente — você cria
  exatamente o que o `.awflow.json` descreve. Melhorias de UX são
  conversa separada.
- **Não traduza identifiers**. `screen.id` é estável e usado pelo
  bridge de sugestões — manter idêntico ao do PG.
- **Não crie um arquivo `screens.ts` ou `narrative.ts` separado**. Tudo
  inline no `page.tsx`, padrão do styleguide.
- **Não adicione novos tokens**. Reuse os existentes (`var(--au-*)`,
  `var(--border-*)`, etc.). Se faltar token pra um caso, peça ajuste
  no design system primeiro.
