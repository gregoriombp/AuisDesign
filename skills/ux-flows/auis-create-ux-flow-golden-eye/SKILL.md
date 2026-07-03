---
name: auis-create-ux-flow-golden-eye
description: >
  Builds a COMPILED, multi-scenario "golden eye" UX flow page in the Auis
  styleguide (/auis/styleguide/ux-flows/[slug]) — several product journeys
  merged into ONE deduped ReactFlow graph with per-scenario focus lenses. Shared
  screens collapse to a single card carrying one colored dot per owning scenario
  (2+ dots = shared); a lens grays out everything outside the focused scenario
  and draws its band; clicking a card opens the real screen in a modal; Comentar
  mode posts notes to /api/flow-suggestions; plus fullscreen, draggable nodes,
  and the updates changelog. Modeled on the poc-visao-global page — self-contained
  raw ReactFlow, NOT the shared <FlowDiagram>. Use when the user wants a global or
  compiled view ("visão global / compilada"), a "golden eye", a flow that
  encompasses several scenarios ("engloba vários cenários"), an overlay of
  multiple journeys with lenses, or says things like "criar flow golden-eye",
  compile scenarios into one flow, merge several flows into a single graph, a
  ux flow with lenses / per-scenario focus, or a bird's-eye view of the flows.
  For a SINGLE linear journey, use auis-create-ux-flow instead.
---

# Auis — UX Flow · Golden Eye (visão compilada multi-cenário)

Build a **compiled** UX flow page under
`/app/auis/styleguide/ux-flows/[slug]/page.tsx` that fuses **several
product journeys (cenários)** into one diagram. Where a normal flow maps a
single path start-to-finish, a golden-eye view overlays many paths on the same
board, **dedups the screens they share**, and gives the reader a **lens** to
isolate any one scenario at a time. It is the bird's-eye / "olho dourado" map of
how a region of the product actually works across situations.

Concrete jobs this skill is for:

- "Compilar num flow só: **criar o primeiro agente** e, depois, **ajustar um
  agente que já existe**" — two scenarios that share the agent-editor screens;
  the *ajuste* scenario re-enters the graph partway through.
- "A pessoa **não tem memory base** criada, então precisa criar antes de seguir"
  — a decision (`Tem memory base?`) routes into a sub-journey (criar base) that
  then **converges** back into the main path. Those nuances are exactly what the
  lens makes legible.

---

## Reference implementation — READ FIRST

The canonical, working example lives at:

```
app/auis/styleguide/ux-flows/poc-visao-global/page.tsx
```

**Read it before writing anything.** It is the source of truth and the working
contract for every piece below: node renderers (`ScreenNode`, `DecisionNode`,
`SectionNode`), the 4-side handles, edge styles, the lens/dimming engine,
`focusBand`, the click-to-open modal with variant tabs, the Comentar composer
wired to `/api/flow-suggestions`, fullscreen, and draggable-node persistence.
**Copy from it and adapt** — do not re-derive these blocks from memory.

For node/edge *conventions* (step labels, branch labelling, decision questions)
the fullest single-path example is `login-auth/page.tsx` — skim it too.

---

## Golden eye vs. a normal flow — pick the right skill

| | `auis-create-ux-flow` | **this skill (`-golden-eye`)** |
|---|---|---|
| Scope | ONE journey, start → finish | SEVERAL journeys (cenários) merged |
| Board | shared `<FlowDiagram>` | **raw self-contained `<ReactFlow>`** |
| Shared screens | n/a | **deduped** — one card, one dot per scenario |
| Lens / focus | none | **per-scenario lens** (dim + band) |
| Card click | side **drawer** (`AuSheet` + iframe) | **modal** (iframe, variant tabs) |
| Comentar / fullscreen / changelog | yes (via board) | yes (authored on the page) |

If the user describes a single linear path, stop and use
`auis-create-ux-flow`. Use this skill only when the value is in **seeing
multiple scenarios at once and toggling between them**.

---

## Why raw ReactFlow here (and not `<FlowDiagram>`)

The base flow skill says "always `<FlowDiagram>`, never bare ReactFlow." The
golden-eye view is the **one deliberate exception** it names (`poc-visao-global`
"embeds raw ReactFlow for its focus-lens experiment"). The shared board has no
concept of scenario dots, lens dimming, the focus band, or per-card variant
modals — so a golden-eye page renders `<ReactFlow>` directly and authors those
features itself, exactly as the POC does. This is **not** license to hand-roll a
bare canvas for a normal flow; it is specific to compiled multi-scenario views.

---

## Core mental model

1. **Cenário (`Scenario`)** — a distinct journey/path you overlay on the board.
   Each gets a label and a color. (The POC happens to call its scenarios
   "personas" because they were 4 access journeys; the general term here is
   **scenario**.)
2. **Dedup** — a screen used by more than one scenario is drawn **once**, as a
   single card, carrying **one colored dot per owning scenario**. 2+ dots = a
   shared screen. Never duplicate a card just because two scenarios touch it.
3. **Lens / Focus** — chips (`Todo` + one per scenario) above the canvas. Picking
   a scenario **grays out** (opacity + desaturate) every node and edge that
   isn't part of it and draws a tinted **band** around the ones that are.
4. **Convergence** — the point where scenarios rejoin a **shared trunk** (e.g.
   every scenario ends at "Agente publicado"). These are the most valuable cards
   to dedup.
5. **Cross-scenario continuation** — one scenario's terminal is another's entry,
   or a decision routes into a **sub-journey** that converges back (the "não tem
   memory base → cria → volta" shape).

---

## Input expected from the user

```txt
Compiled view name: [e.g. "Agente — visão compilada", "Memory Base — golden eye"]
Slug:               [e.g. "agente-visao-global", "memory-base-golden-eye"]
Scenarios:          [2–6 journeys to overlay, each with a one-line intent]
Per scenario:       [ordered screens/states + decision points]
Shared screens:     [which screens >1 scenario touches — the dedup list]
Convergences:       [where scenarios rejoin]
Cross-scenario:     [scenario A's end = scenario B's start / decision → sub-journey]
Prototype links:    [optional href per screen — prefer real internal routes]
Intro text:         [1–2 sentences: what region of the product this compiles]
```

Infer anything missing from context — never ask for more than necessary. For
prototype links not provided, use `#` (the modal then shows a placeholder).

---

## Step 1 — Pick & map the scenarios (the merge analysis)

This is the whole game. Before any code:

1. **List each scenario end-to-end** as its own linear path.
2. **Find shared screens across scenarios** → these dedup into single cards.
   Record which scenarios own each (the dot list).
3. **List decision points**, including the "state gates" that make scenarios
   branch: `Tem memory base?`, `Primeira vez?`, `Já tem 2FA?`.
4. **List convergences** (where paths rejoin the shared trunk).
5. **List cross-scenario links** (terminal-of-A = entry-of-B; decision →
   sub-journey → converge back).
6. **Terminal states** per scenario.

Produce a merge table before touching code, e.g. for *criar agente* + *ajustar
agente*:

```
Card                    | criar 1º agente | ajustar agente | shared?
------------------------|-----------------|----------------|--------
Studio (lista)          |   entry         |   entry        |  ●● 2 dots
Decisão: tem agente?    |   →não          |   →sim         |  ●● 2 dots
Criar agente (form)     |   ✓             |   —            |  ● 1 dot
Editor do agente        |   ✓             |   ✓ (re-entra) |  ●● 2 dots  ← convergência
Publicar / salvar       |   ✓             |   ✓            |  ●● 2 dots
```

The cards with 2 dots are the spine of the value — they're what a single linear
flow could never show.

---

## Step 2 — Scenario palette (lens colors)

Each scenario gets a `-600` color token. Build the registry like the POC's
`PERSONA`:

```ts
type Scenario = "criar-agente" | "ajustar-agente" | /* … */ "all-ignored"
type Focus = Scenario | "all"

const SCENARIO: Record<Scenario, { label: string; color: string }> = {
  "criar-agente":  { label: "Criar 1º agente", color: "var(--au-blue-600)" },
  "ajustar-agente":{ label: "Ajustar agente",  color: "var(--au-emerald-600)" },
  // …
}
const ALL = Object.keys(SCENARIO) as Scenario[]
const FOCI: { id: Focus; label: string }[] = [
  { id: "all", label: "Todo" },
  ...ALL.map((s) => ({ id: s, label: SCENARIO[s].label })),
]
```

**Palette order (use in this order):**
`au-blue-600` → `au-emerald-600` → `au-purple-600` → `au-pink-600` →
`au-teal-600` → `au-lime-600` → `au-slate-600`.

**Avoid `au-amber-*` and `au-red-*` as scenario colors** — amber is the decision
language (dashed boxes + branch edges) and red reads as error. Using them for a
lens muddies both. Cap a single board at ~6 scenarios; beyond that the dots and
lenses stop being legible — split into two compiled views instead.

---

## Step 3 — Layout geometry (streams + shared trunk)

Lay scenarios out as **parallel vertical streams** that drop into a **shared
trunk** at the convergence. The POC does exactly this (LOGIN stream left,
ONBOARDING stream right, shared 2FA→conclusão trunk centered below) — mirror it.

```ts
// One x-band per stream. Example for two streams + a centered trunk:
const A_L = 60,  A_M = 320,  A_R = 600     // stream A columns
const B_L = 1060, B_M = 1320, B_R = 1600   // stream B columns
const T_X = 720, T_L = 520, T_R = 880      // shared trunk columns

// Tiny constructors keep NODES readable (copy from the POC):
const S = (id: string, x: number, y: number, d: ScreenData): Node =>
  ({ id, type: "screen", position: { x, y }, zIndex: 10, data: d })
const D = (id: string, x: number, y: number, d: DecisionData): Node =>
  ({ id, type: "decision", position: { x, y }, zIndex: 10, data: d })
```

**Y spacing:** ~175px between sequential rows in a stream; bump to ~200px around
decisions to leave room for branch labels. Shared cards sit at the y where the
streams meet. Start at `y: 0`.

**Handles — 4 sides, target + source.** Every node exposes top/bottom/left/right
handles in both directions so edges can attach from any side (essential once
streams weave). IDs follow the POC: side + role → `"t-t"`/`"t-s"`, `"b-t"`/`"b-s"`,
`"l-t"`/`"l-s"`, `"r-t"`/`"r-s"`. Copy the `NodeHandles` component verbatim.

**Canvas height:** the POC fixes the non-fullscreen canvas at `height: 880` and
relies on `fitView` to frame the whole graph — do the same. (No per-node height
math needed; `fitView` handles it.)

---

## Step 4 — Node types (copy from the reference)

Three renderers, registered once as `nodeTypes`. **Copy all three from
`poc-visao-global/page.tsx`** — do not redefine the shapes from scratch:

- **`screen`** (`ScreenNode`) — the card. Renders `PersonaDots` (→ rename
  concept to scenario dots, same code), an optional `CommentPin` when the card
  has comments, and `step`/`title`/`note`. Data shape:
  ```ts
  type ScreenData = {
    step?: string; title: string; note?: string; href?: string
    variants?: { label: string; href: string }[]  // multi-state terminal in one card
    scenarios: Scenario[]                          // ← dedup / lens membership
    _comments?: number
  }
  ```
- **`decision`** (`DecisionNode`) — amber dashed box: `title` + `question` +
  scenario dots. `type DecisionData = { step?: string; title: string; question?: string; scenarios: Scenario[]; _comments?: number }`.
- **`section`** (`SectionNode`) — the tinted **focus band** drawn behind the
  focused scenario's nodes. `type SectionData = { title: string; scenario: Scenario }`.

```ts
const nodeTypes = { screen: ScreenNode, decision: DecisionNode, section: SectionNode }
```

`variants` is the trick for "link expirado / usado / cancelado"-style triples:
one card, three states, the modal lists one tab per state. Use it whenever a
single conceptual screen has several terminal variants.

---

## Step 5 — Edges

Three edge bases, declared inline like the POC (`base`, `branch`, `cross`):

- **`base`** — grey `smoothstep`, the main flow (entry→step, step→step,
  convergence→trunk).
- **`branch`** — amber, every edge **leaving a decision**; always labelled with
  the choice (`"Sim"`, `"Não"`, `"Pix"`, `"E-mail comum"`).
- **`cross`** — pink dashed, a **cross-scenario jump** (one scenario continuing
  into another's territory).

Every edge sets `sourceHandle` + `targetHandle` (the `"x-s"`/`"x-t"` ids) so the
line attaches to the right side. Label entry edges with the action that starts
the scenario; leave plain `base` edges unlabelled unless they carry context.

---

## Step 6 — The three "golden eye" interactions (copy verbatim, then adapt)

These are what make it a golden eye. Lift them from the POC; change only what's
noted.

**6a — Lens engine.** Two `useMemo`s + one helper, driven by `focus` state:

- **Nodes:** map `BASE_NODES`; when `focus !== "all"` and a node's `scenarios`
  don't include `focus`, add `className: "opacity-15 saturate-0 transition-all duration-300"`
  (else `opacity-100`). Merge live `_comments` counts and dragged `positions`.
  When focused, prepend `focusBand(focus)`.
- **Edges:** when focused, dim any edge not fully inside the scenario
  (`{ ...e, label: undefined, style: { ...e.style, opacity: 0.1 } }`).
- **`focusBand(scenario)`** returns a `section` node sized to the bounding box of
  that scenario's members (the tinted backdrop). Copy it as-is; it reads
  `n.data.scenarios`.

Keep dragging working: `onNodesChange` writes positions into a `positions`
record so the controlled graph doesn't snap cards back (copy the POC's handler).

**6b — Click-to-open modal.** `onNodeClick` (when not in comment mode): for a
`screen` with `href`/`variants`, open a modal with an `iframe` to the route.
Multi-variant cards render a tab per state + an "Abrir em nova aba ↗". The modal
is ≥768px wide so the **desktop-only** product renders correctly. Copy the modal
block verbatim.

**6c — Comentar mode → `/api/flow-suggestions`.** A bottom-center `Mover /
Comentar` toolbar. In Comentar mode a card click opens a composer; "Enviar"
POSTs to the **same-origin** route and the note lands in the queue the
`auis-flow-bridge-solve` skill reads. Copy the composer + the load
`useEffect` + `sendComment`, and change **exactly two things**:

1. **`flow` must equal this page's folder slug** — in the GET
   (`/api/flow-suggestions?flow=<slug>`) and in the POST body. This is the
   scoping key; get it wrong and comments land in the wrong bucket.
2. The description **node tag** the page uses to map a comment back to a card.
   Standardize on `ge` (golden-eye): POST `description: \`[ge:${id}] (${title}) ${text}\``
   and parse with `/^\[ge:([^\]]+)\]\s*(?:\([^)]*\))?\s*([\s\S]*)$/`. Keep the
   tag identical in both places. (The tag is page-internal — only this page
   reads it; the solve skill resolves the suggestion generically.)

Also copy the **fullscreen** toggle (CSS overlay + ESC + re-`fitView`) and the
in-fullscreen focus `Panel` (the lens chips also live above the canvas outside
fullscreen).

---

## Step 7 — Changelog (wired from birth)

A compiled view changes whenever its source scenarios change, so it carries the
updates changelog like a normal flow. Import the helpers and seed `updates[]`
with one entry dated **today**, tag `"new-page"`:

```tsx
import {
  FlowUpdatesBadge,
  FlowUpdatesHistorySection,
  type FlowUpdate,
} from "../_components/flow-updates"

const updates: FlowUpdate[] = [
  {
    date: "[today YYYY-MM-DD]",
    summary: "Visão compilada criada: [N] cenários fundidos num grafo só.",
    tags: ["new-page"],
  },
]
```

After this, `auis-update-ux-flow` prepends entries on every structural
change (a new scenario added, a shared card split, a converge point moved).

---

## Step 8 — Page structure

```tsx
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ReactFlow, Background, Controls, Panel, Handle, Position, MarkerType,
  type Edge, type Node, type NodeChange, type NodeProps, type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { PageHero, Section } from "../../_primitives"
import { FlowUpdatesBadge, FlowUpdatesHistorySection, type FlowUpdate } from "../_components/flow-updates"

// …SCENARIO, FOCI, node renderers, BASE_NODES, EDGES, focusBand, updates[]…

export default function [Name]GoldenEyePage() {
  // …focus, openScreen, isFullscreen, commentMode, comments, positions state…
  return (
    <>
      <PageHero
        title="[Compiled view name]"
        trailing={
          <>
            <span className="inline-flex items-center rounded-full border border-(--au-amber-300) bg-(--au-amber-100) px-2 py-0.5 text-[11px] font-medium text-(--au-amber-800)">
              visão compilada
            </span>
            <FlowUpdatesBadge updates={updates} />
          </>
        }
      >
        [1–2 sentences: which region of the product this compiles and which
        scenarios it overlays.]
      </PageHero>

      {/* Canvas FULL-WIDTH (outside the text column) — lens chips + legend + ReactFlow */}
      <div className="w-full px-10 pb-10">
        <Section
          id="flow"
          title="Fluxograma compilado"
          lead="2+ bolinhas num card = tela compartilhada entre cenários. A lente acinzenta o que está fora do cenário em foco e desenha a faixa dele. No modo Mover: arraste os cards e clique pra abrir a tela real. No modo Comentar: clique num card pra deixar uma nota. Botão de tela cheia no canto."
        >
          {/* focus chips, legend, then the ReactFlow block with Panels — copy from POC */}
        </Section>
      </div>

      {/* Doc — back inside a normal text column */}
      <div className="mx-auto max-w-[1100px] px-10 pb-14 flex flex-col gap-16">

        {/* Cenários compilados — one entry per scenario */}
        <Section id="cenarios" title="Cenários compilados" lead="Cada jornada sobreposta neste mapa: o que é, onde entra, onde converge.">
          {/* list: scenario dot + label + entry → terminal + which shared cards it touches */}
        </Section>

        {/* Telas compartilhadas e convergências — the dedup decisions */}
        <Section id="compartilhadas" title="Telas compartilhadas e convergências" lead="Por que estas telas viraram um card só — e onde os cenários se reencontram.">
          {/* ordered list, one line per deduped/convergence card + the decision */}
        </Section>

        {/* Changelog — always last */}
        <FlowUpdatesHistorySection updates={updates} />
      </div>

      {/* Modal de tela + Composer de comentário — copy from POC */}
    </>
  )
}
```

The two doc sections replace the POC's bespoke "Conflitos resolvidos" block:

- **Cenários compilados** — orientation: one row per scenario (its dot/color,
  one-line intent, entry → terminal, and the shared cards it passes through).
- **Telas compartilhadas e convergências** — the dedup ledger: each shared card
  and *why* it's one card (e.g. "Editor do agente — criar e ajustar usam a mesma
  tela; ajustar re-entra aqui direto"), plus each convergence point.

---

## Step 9 — Register in navigation.ts

Add the page under `group: "UX Flows"` in a `title: "Visões compiladas"`
subgroup. Create that subgroup if it doesn't exist yet; otherwise append to it.

```ts
{
  group: "UX Flows",
  title: "Visões compiladas",
  items: [
    { name: "[Compiled view name]", href: "/auis/styleguide/ux-flows/[slug]" },
  ],
},
```

Keep it under the existing `group: "UX Flows"` — never invent a new group. (The
POC currently sits under `title: "Experimentos"`; new golden-eye views go under
"Visões compiladas".)

---

## Step 10 — Strings inside node data

**Never use ASCII double-quotes inside a string value** — it breaks the parser.
Use single quotes, a template literal, or rephrase:

```ts
note: 'Clique em "Criar agente" pra começar.',   // ✅ single-quoted outer
note: `Clique em "Criar agente" pra começar.`,   // ✅ template literal
note: "Clique em Criar agente pra começar.",     // ✅ rephrased
note: "Clique em "Criar agente" pra começar.",   // ❌ breaks
```

---

## Step 11 — Validate

```bash
npm run typecheck    # must pass — no TS errors
```

If the dev server is up, open the page and confirm: the graph fits on load, the
lens chips dim/undim and draw the band, a card click opens the modal iframe,
Comentar posts a note, dragging persists, and fullscreen toggles.

---

## Quick checklist before submitting

- [ ] Read `poc-visao-global/page.tsx` first — node renderers, lens engine,
      modal, composer, fullscreen all **copied** from it, not re-derived
- [ ] Raw `<ReactFlow>` (the named exception) — NOT `<FlowDiagram>`
- [ ] Scenarios mapped: merge table done, shared screens deduped to one card
      with one dot per owning scenario, convergences + cross-scenario links found
- [ ] `SCENARIO` palette uses `-600` tokens in the recommended order; **no amber
      / red** as scenario colors; ≤ ~6 scenarios
- [ ] Streams + shared trunk laid out; 4-side handles (`x-t`/`x-s`); `fitView`
      frames the graph; canvas `height: 880` outside fullscreen
- [ ] Lens engine: out-of-focus nodes `opacity-15 saturate-0`, edges dimmed +
      labels dropped, `focusBand` drawn; dragging persists via `positions`
- [ ] Click-to-open modal (iframe ≥768, variant tabs, open-in-new-tab); `href`
      is a real internal route where a prototype exists, else `#`
- [ ] Comentar: `flow` **equals the folder slug** in GET and POST; node tag `ge`
      identical in the POST description and the parse regex
- [ ] Changelog wired: imports from `../_components/flow-updates`, `updates[]`
      seeded with a "new-page" entry dated today, `FlowUpdatesBadge` in `trailing`,
      `FlowUpdatesHistorySection` last
- [ ] Canvas section is full-width; doc sections ("Cenários compilados",
      "Telas compartilhadas e convergências") are inside the text column
- [ ] No ASCII double-quotes inside JS string values
- [ ] `navigation.ts` updated under `group: "UX Flows"` → `title: "Visões compiladas"`
- [ ] `npm run typecheck` passes

---

## Output to return

```md
Built golden-eye (compiled) UX flow: [Compiled view name]

Route: /auis/styleguide/ux-flows/[slug]

Compiled structure:
- [N] scenarios: [list with their colors]
- [N] screen cards ([N] shared / deduped — 2+ dots)
- [N] decision nodes
- Convergences: [list]
- Cross-scenario links: [list]

Changed:
- app/auis/styleguide/ux-flows/[slug]/page.tsx — created
- app/auis/styleguide/navigation.ts — added entry under UX Flows › Visões compiladas

Validation:
- typecheck — passed / failed
```
