---
name: auis-create-ux-flow
description: >
  Creates a new single-journey UX flow page in the Auis UX Flow hub
  (app/auis/ux-flow/<slug>/page.tsx, served at /auis/ux-flow/<slug>) from a
  written brief, a step list, or a meeting decision. Maps every screen,
  decision, branch, convergence and cross-flow jump into the shared FlowDiagram
  (ReactFlow) format, registers the flow in _data/flow-meta.ts so the sidebar
  and the gallery pick it up, optionally registers it for inline sub-flow
  expansion, and seeds its changelog. Use when the user asks to "build a UX
  flow", "map a flow", "create a flow diagram", "put together a flowchart",
  "add a flow to the hub", or hands over a list of steps/screens asking for a
  flow page. For several journeys overlaid in one graph use
  auis-create-ux-flow-golden-eye; for a change to an existing flow use
  auis-update-ux-flow.
---

# Auis — UX Flow

Build a UX flow diagram page under `app/auis/ux-flow/[flow-slug]/page.tsx`
from a written description of the flow. The page is served at
`/auis/ux-flow/[flow-slug]` and appears in the hub gallery (`/auis/ux-flow`)
and in the hub sidebar as soon as it is registered in `flow-meta.ts`.

## Reference implementation

The canonical example lives at:
```
app/auis/ux-flow/example/page.tsx
```
Read it **before starting**. It is the source of truth for node types, edge
styles, layout constants and page structure: screen nodes, one decision, two
branches and a convergence, with every `href` pointing at a route that ships
with Auis. All new flow pages follow the same pattern — no deviations without
a reason. Add `crossflow` nodes only when the journey genuinely jumps into
another registered flow.

The hub modules you will touch or import:

| File | Role |
|---|---|
| `app/auis/ux-flow/_components/flow-editor.tsx` | `FlowDiagram`, the node renderers, `edgeBase` / `branchEdge` / `crossEdge`, `ScreenData` / `DecisionData` |
| `app/auis/ux-flow/_components/flow-updates.tsx` | `FlowUpdatesBadge`, `FlowUpdatesHistorySection`, `FlowUpdate`, `FlowUpdateTag` |
| `app/auis/ux-flow/_components/flow-subflow.tsx` | `LOADERS` — the registry of flows that can expand inline inside another flow's canvas |
| `app/auis/ux-flow/_data/flow-meta.ts` | `FLOW_META`, `FLOW_GROUPS`, `getFlowMeta` — the single registry behind the sidebar, the gallery and the Review Bridge titles |
| `app/auis/styleguide/_primitives.tsx` | `PageHero` (with the `trailing` slot) and `Section` |

### Always the rich `<FlowDiagram>` board — never a simpler diagram

The diagram is **always** `<FlowDiagram>` — the shared rich board that carries
the Move / Comment / Suggest edit toolbar, fullscreen, the suggestions badge
and the side-panel screen preview (see the next section). **Do not** hand-roll
a bare `<ReactFlow>` or a stripped-down canvas per page — every flow inherits
the full toolset for free by rendering `<FlowDiagram>`. The only deliberate
exception is the compiled multi-scenario view built by
`auis-create-ux-flow-golden-eye` (`example-golden-eye/page.tsx`), which is
**not** a template for a single journey.

---

## What the diagram gives you for free

Every interactive feature lives **inside `<FlowDiagram>`**, not in the page.
A page that renders `<FlowDiagram flow="…" nodes={…} edges={…} />` inherits all
of these — you do **not** wire them per page:

- **Screen preview** — in view mode, clicking a `screen` card opens its `href`
  in a side panel (an `AuSheet`, extra-wide, carrying an iframe).
- **Comment** — FigJam-style comment markers on cards or on the empty canvas.
  Each comment is a Review Bridge comment tagged `origin: "ux-flow"` with
  `flowRef: { flow, nodeId, nodeLabel }`, so it shows in Review Mode and is
  resolved later by `auis-review-bridge-solve`.
- **Suggest edit** — enters edit mode: add screens, decisions and "other flow"
  diamonds, drag, connect, undo/redo, snap, arrange, duplicate, delete. "Save"
  asks for a description and POSTs the edited graph to the same-origin route
  `/api/flow-suggestions` (with the canonical graph as `baseNodes`/`baseEdges`,
  so the server records the base revision). Suggestions are materialized later
  by `auis-flow-bridge-solve` and moderated at `/auis/review-bridge` → "Flow
  suggestions".
- **Copy a prompt for the chat** — from the save modal: a ready-made prompt
  carrying the graph JSON, either to update this page or to scaffold the
  product routes behind its screens.
- **Suggestions badge** — top-right count of pending suggestions; each one can
  be viewed on the canvas, and "Copy prompt" yields
  `evaluate suggestion <id> of flow <slug>` for the chat.
- **Fullscreen** — a CSS overlay (button in the controls, Esc to exit).
- **Sub-flow expansion** — a `crossflow` diamond whose `href` points at a flow
  registered in `flow-subflow.tsx` expands that flow inline, inside a framed
  group; unregistered targets open a "Go to another flow?" confirmation and
  navigate.

**The `flow` prop is a hard contract, not a label.** It is the scoping key for
both comments (`flowRef.flow`) and suggestions (`/api/flow-suggestions?flow=…`).
It **must equal the page's slug** — the folder name under `app/auis/ux-flow/`.
Pass it wrong and comments and suggestions silently land in the wrong bucket.
So: `app/auis/ux-flow/example/` → `<FlowDiagram flow="example" …>`.

The only feature a page **does** author itself is the **updates changelog**
(`updates[]` + `<FlowUpdatesBadge>` + `<FlowUpdatesHistorySection>`) — see
Step 6.

---

## Input expected from the user

```txt
Flow name:  [e.g. "Sign in", "Create a workspace", "Invite a member", "Checkout"]
Slug:       [e.g. "sign-in", "create-workspace", "invite-member", "checkout"]
Steps:      [numbered list of screens / states]
Decision points: [where the user chooses between paths]
Branches:   [what each path contains and how they converge]
Intro text: [1–2 sentences summarising what this flow is about]
Prototype links: [optional — href for each screen node]
Group:      [optional — which FlowGroup the flow belongs to in the hub]
```

If the user doesn't supply all fields, **infer from context** — never ask for
more than necessary. For prototype links not provided, use `#` as href.

---

## Step 1 — Analyse the flow

Before writing any code, map the entire flow:

1. List every **screen** (step node) and **decision point** in order.
2. Identify every **branch** (where the flow splits into 2–3 paths).
3. Identify every **convergence** (where branches rejoin a single node).
4. Note the **terminal nodes** (last states: success, redirect, dead end).
5. Note the **entry point** (the screen before the flow starts, e.g. the sign-in page).
6. Note every **jump into another flow** (a path that leaves this journey and
   continues in another flow page) — those become `crossflow` nodes.

Produce a mental tree like this before touching code:

```
[Entry] → [Step 01] → [Decision A]
                          ├─ path-1 → [Step 02a] → [Step 03] (converge)
                          └─ path-2 → [Step 02b] → [Step 03] (converge)
                      [Step 03] → [Decision B]
                          ├─ left  → [Terminal 1]
                          └─ right → [Terminal 2]
```

---

## Step 2 — Plan the layout geometry

### Column constants

The main column is centred at **x = 380px** (canvas coordinates; positions are
the top-left corner of the card):

| Node type | Width | x position | Centre |
|---|---|---|---|
| `screen` (`ScreenNode`) | 200 px | `COL = 280` | 380 |
| `decision` (`DecisionNode`) | 240 px | `COL_D = 260` | 380 |
| `crossflow` (`CrossFlowNode`) | 184 px | `COL_X = 288` | 380 |

### Branch column formulas

**2-branch layout** (left / right symmetric around 380):
```
LEFT_X  = 80    centre = 180
RIGHT_X = 480   centre = 580
average centre = 380  (balanced)
```

**3-branch layout** (e.g. three payment methods):
```
LEFT_X   = 40   centre = 140
CENTER_X = 280  centre = 380   (same as COL)
RIGHT_X  = 520  centre = 620
average centre = 380  (balanced)
```

If a branch section has **more than 3 paths**, use two separate rows of
branches or widen the layout — document the choice in a comment next to the
constants.

### Y spacing

Use **160 px** between sequential main-flow nodes.
Use **200 px** between a decision node and its branch nodes (extra room for
edge labels).
Use **180 px** between branch nodes and their convergence node.

(The shipped example uses 180 / 220 / 220 — anything in that range reads well;
what matters is consistent rows.)

Start Y at 0. Increment for each new row. Example:

```ts
const Y = {
  entry:           0,
  step01:        160,
  decisionA:     320,
  branchRow:     520,   // +200 (branch below decision)
  converge:      700,   // +180
  step02:        860,
  decisionB:    1020,
  terminals:    1220,   // +200
}
```

### Container height

```
containerHeight = Y[lastRow] + 200   // 200px padding below the last nodes
```

Round up to the nearest 100. Minimum 800 px (the `FlowDiagram` default). Pass
it through the `height` prop.

---

## Step 3 — Node types

The three node types — `screen`, `decision` and `crossflow` — are already
implemented in `../_components/flow-editor.tsx` and registered inside
`FlowDiagram`'s `nodeTypes`. **Do not redefine them in your page.** A flow page
only authors the `NODES` and `EDGES` arrays and hands them to `<FlowDiagram>`.
Do not invent new node types.

### `screen` — a screen or state

Data shape (`ScreenData`): `{ step: string; title: string; href: string; note?: string }`

- `step`: label shown as the eyebrow — use `"entry"`, `"01"`, `"02a"`, `"end"`, etc.
- `title`: short screen name (≤ 4 words).
- `href`: route to the real screen, or `#` if none exists yet.
- `note`: one short sentence about the screen's purpose (optional but recommended).

**What makes a good `note`:** it says what the user does or decides on that
screen, not what the screen contains ("Choose the workspace that needs a
change" rather than "List of workspaces"). One sentence, no trailing period
needed, no technical jargon, no emoji.

**Preview behavior (side panel):** in view mode, clicking anywhere on a
screen card opens its `href` inside the side panel. `FlowDiagram` wires this
through ReactFlow's `onNodeClick` (not through a `<Link>` around the card,
which ReactFlow's pointer handling tends to swallow); flow pages do nothing
beyond filling `href` correctly.

- Internal route (`/auis/projects`, `/auis/styleguide/components/au-button`, …) → loaded in the iframe.
- `#` or empty string → the panel shows a "No prototype yet" placeholder.
- External URL (`https://…`) → the panel offers an "Open in a new tab" button instead of the iframe.
- `cmd/ctrl-click` on an internal route opens it in a new tab — a plain click opens the panel.

**Every `href` must resolve.** An internal `href` must be a route that exists
in this repo (`app/<route>/page.tsx`) — check it before writing it down. The
example only uses routes shipped by Auis (`/auis/projects`, `/auis/styleguide`,
`/auis/ux-flow`, `/auis/review-bridge`) so every preview works in a fresh
clone. Prefer real internal routes over `#` whenever the screen exists; use
`#` (never a guessed path) when it does not.

### `decision` — decision point

Data shape (`DecisionData`): `{ step: string; title: string; question: string }`

- `step`: decision identifier (`"01"`, `"end"`, etc.).
- `title`: the decision name (e.g. `"Authentication method"`).
- `question`: the question the user faces at this point (≤ 15 words).

**Handle rules for decision nodes** (the renderer exposes three source handles):
- `id="left"` → the branch that exits from the left side
- `id="bottom"` → the centre / straight-down branch
- `id="right"` → the branch that exits from the right side
- Always specify `sourceHandle` on edges leaving a decision node.

(`screen` nodes also expose invisible `left` / `right` source handles for the
rare edge that must leave a card sideways; the default source is the bottom.)

### `crossflow` — jump to another flow

Use this **only** when the path leaves THIS flow and enters ANOTHER flow page
of the hub (e.g. sign-in → create-workspace). It renders as a purple diamond,
visually distinct from screen cards and decision boxes. In view mode a click
expands the target flow inline when that flow is registered in
`flow-subflow.tsx` (Step 8); otherwise it opens a "Go to another flow?"
confirmation and navigates on confirm.

Data shape (same as `screen`): `{ step: string; title: string; href: string; note?: string }`

- `step`: use `"→ flow"`.
- `title`: the **destination flow's name** — short, shows inside the diamond and in the modal (e.g. `"Create a workspace"`).
- `href`: the OTHER flow's page route — `/auis/ux-flow/[other-slug]`. Not a screen route.
- `note`: optional one-liner of context.
- Handles are top (target) + bottom (source), like `screen` — no `sourceHandle` needed on its edges.

Don't use `crossflow` for a normal terminal screen that simply enters the
product (e.g. the workspace home) — that stays `screen`. Only for jumps between
two flow pages.

---

## Step 4 — Edge styles

Three edge bases — `edgeBase` (grey, main flow), `branchEdge` (amber, exit from
a decision) and `crossEdge` (purple dashed, to/from a `crossflow` node) — are
exported from `../_components/flow-editor.tsx`. Import the ones you use instead
of redeclaring:

```ts
import { branchEdge, crossEdge, edgeBase, FlowDiagram } from "../_components/flow-editor"
```

Define `labelProps` inline in the page (it is small and the props vary per
page):

```ts
const labelProps = {
  labelStyle: { fill: "var(--fg-secondary)", fontSize: 11, fontWeight: 500 },
  labelBgStyle: { fill: "var(--bg-canvas)" },
  labelBgPadding: [6, 4] as [number, number],
}
```

**When to use each:**
- `edgeBase` — entry → step, step → step, step → decision, convergence → next step
- `branchEdge` — decision → any branch node (always amber, always labelled with the choice)
- `crossEdge` — any edge that touches a `crossflow` node (purple dashed, marks the jump to another flow)

**Edge labelling:**
- Decision → branch: label with the choice (e.g. `"Card"`, `"Google"`, `"Yes"`, `"No"`).
- Entry → first step: label with the action that starts the flow (e.g. `"Sign in"`).
- Other edges: no label unless they carry important context.

Spread `...labelProps` on every labelled edge so labels share one look.

---

## Step 5 — Strings inside node data

**Never use ASCII double quotes inside a string value** — the parser breaks.
Use one of these approaches:

```ts
// Single-quoted outer string for notes with quotes inside
note: 'Click "Continue" to start.',

// A template literal
note: `Click "Continue" to start.`,

// Rephrase to avoid inner quotes
note: "Click Continue to start the flow.",

// NEVER — breaks the parser
note: "Click "Continue" to start.",
```

### House rules the page must respect

- **Tokens only.** Colors, spacing, radius and type come from existing tokens
  (`var(--au-*)`, `var(--fg-*)`, `var(--bg-*)`, `text-2xs`, `rounded-lg`, …).
  No hex, no `px` arbitrary values, no new tokens.
- **`Au*` components from `components/ui/`** for anything beyond plain text
  (`AuCard` for the screen and decision cards, as in the example). Never a
  hand-rolled card, button or overlay.
- **Icons through `components/ui/Icon.tsx`** (Material Symbols). No raw
  `<svg>`, no glyph characters standing in for icons.
- **No emoji** in titles, notes, labels, summaries or comments.
- **English UI text** everywhere: node data, section leads, changelog entries.

---

## Step 6 — Page structure

The page has **four sections** in this order, followed by the changelog. The
`Tldr` primitive is **not used** in flow pages — replace it with a brief
introductory paragraph.

### Imports + changelog scaffold

Every flow page is born with the updates changelog wired in (the badge in the
hero + the history section at the bottom). Import the helpers and declare an
`updates[]` array — seed it with **one** entry dated today (`YYYY-MM-DD`),
tagged `"new-page"`. After this, the `auis-update-ux-flow` skill prepends new
entries on every structural change.

`NODES` and `EDGES` are **exported**: the sub-flow expansion loader
(`flow-subflow.tsx`) and the suggestion diff both read them from the page.

```tsx
"use client"

import Link from "next/link"
import type { Edge, Node } from "@xyflow/react"

import { AuCard } from "@/components/ui/AuCard"
import { PageHero, Section } from "../../styleguide/_primitives"
import { branchEdge, edgeBase, FlowDiagram } from "../_components/flow-editor"
import {
  FlowUpdatesBadge,
  FlowUpdatesHistorySection,
  type FlowUpdate,
} from "../_components/flow-updates"

const labelProps = { /* Step 4 */ }

export const NODES: Node[] = [
  // Keep the entry screen FIRST: when this flow expands inline inside another
  // flow, the bridge edge lands on the first node of the array.
  // ...screen / decision / crossflow nodes with COL / COL_D / Y positions...
]

export const EDGES: Edge[] = [
  // ...edgeBase / branchEdge / crossEdge, sourceHandle on every decision exit...
]

const screens = [ /* see below */ ] as const

const updates: FlowUpdate[] = [
  {
    date: "[today YYYY-MM-DD]",
    summary: "Flow mapped in the UX Flow hub.",
    tags: ["new-page"],
  },
]
```

### Page body

```tsx
export default function [FlowName]FlowPage() {
  return (
    <>
      <PageHero
        title="[Flow name]"
        trailing={<FlowUpdatesBadge updates={updates} />}
      >
        [1–2 sentence description of the flow. What it covers, who goes
        through it, when to use this map.]
      </PageHero>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-10 pb-14">

        {/* SECTION 1 — intro text (replaces Tldr) */}
        <p className="max-w-2xl text-sm leading-relaxed text-fg-secondary">
          [2–4 sentences. Overview of the flow structure: how many steps,
          where the decision points are, what the terminal states are. This is
          the orientation paragraph a reader needs before the diagram.]
        </p>

        {/* SECTION 2 — the diagram */}
        <Section
          id="flow"
          title="Flowchart"
          lead="Click any screen to open it in a side panel. Amber dashed boxes are decisions — points where the user makes a choice. Amber arrows mark the branching paths."
        >
          <FlowDiagram
            flow="[flow-slug]"
            nodes={NODES}
            edges={EDGES}
            height={[CALCULATED_HEIGHT]}
          />
        </Section>

        {/* SECTION 3 — each screen documented */}
        <Section
          id="screens"
          title="Every screen"
          lead="Purpose, what happens next, and a direct link to each screen."
        >
          <div className="grid grid-cols-2 gap-4">
            {screens.map((screen) => (
              <AuCard key={screen.step + screen.title} className="flex flex-col gap-3 p-5">
                <div className="flex items-baseline gap-3">
                  <span className="au-eyebrow text-fg-tertiary">{screen.step}</span>
                  <h3 className="text-base font-medium text-fg-primary">{screen.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-fg-secondary">{screen.purpose}</p>
                <p className="caption text-fg-tertiary">
                  <span className="font-medium text-fg-secondary">Next: </span>
                  {screen.decisions}
                </p>
                <Link
                  href={screen.href}
                  className="mt-auto text-sm font-medium text-fg-primary underline-offset-4 hover:underline"
                >
                  Open route
                </Link>
              </AuCard>
            ))}
          </div>
        </Section>

        {/* SECTION 4 — design decisions (2–4 cards) */}
        <Section
          id="design-notes"
          title="Design decisions"
          lead="Why the flow is structured this way."
        >
          <div className="grid grid-cols-2 gap-4">
            {/* One card per key design decision. Use the flow description to
                fill these. Each card: title + paragraph. */}
            <AuCard className="p-5">
              <h3 className="text-base font-medium text-fg-primary">[Decision title]</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                [Why the flow is structured this way.]
              </p>
            </AuCard>
          </div>
        </Section>

        {/* Changelog history — always last. Renders the entries from updates[]. */}
        <FlowUpdatesHistorySection updates={updates} />

      </div>
    </>
  )
}
```

The `screens` array drives Section 3. It mirrors the main screens in the flow
(skip sub-branches that are only variants of the same screen):

```ts
const screens = [
  {
    step: "01",
    title: "Screen name",
    href: "/route/to/screen",
    purpose: "What this screen does and why it exists here.",
    decisions: "What happens after → where it leads.",
  },
  // ...
] as const
```

---

## Step 7 — Register in flow-meta.ts

`app/auis/ux-flow/_data/flow-meta.ts` is the single registry used by the hub
sidebar (`navigation.ts`), the hub gallery (`page.tsx`) and the Review Bridge
suggestions panel (`getFlowMeta`). Append one entry to `FLOW_META`:

```ts
{
  slug: "[flow-slug]",
  title: "[Flow title]",
  description: "[One line: what the journey covers, from entry to terminal states]",
  group: "[FlowGroup]",
},
```

Rules:

- `group` is a `FlowGroup`. Reuse an existing group when one fits; when the
  flow opens a new area, add the group name to `FLOW_GROUPS` — the array order
  is the order of the sidebar sections and of the gallery. Never put a product
  flow under `"Examples"`: that group holds the product-neutral references
  shipped with Auis, which the hub tells users to remove once their own flows
  exist.
- Item order within a group is array order — keep journeys in the order a
  reader would walk them.
- Do **not** edit the styleguide navigation (`app/auis/styleguide/navigation.ts`,
  "UX flows" group): it only lists the hub and the two examples. Product flows
  live in the hub registry only.

---

## Step 8 — Register for inline expansion (when needed)

`app/auis/ux-flow/_components/flow-subflow.tsx` keeps `LOADERS`, a
`slug → () => import("../<slug>/page")` map. A `crossflow` diamond whose
`href` resolves to a registered slug expands that flow inline inside the
current canvas; an unregistered slug only navigates.

Register the new flow when another flow (existing or planned) points at it
with a `crossflow` diamond:

```ts
const LOADERS: Record<string, () => Promise<FlowData>> = {
  example: () => import("../example/page").then((m) => ({ nodes: m.NODES, edges: m.EDGES })),
  "[flow-slug]": () => import("../[flow-slug]/page").then((m) => ({ nodes: m.NODES, edges: m.EDGES })),
}
```

Requirements: the page must `export const NODES` / `EDGES`, and the entry
screen must be the first node of `NODES` (the expansion draws its bridge edge
to the first node). Also register the flows that THIS page's diamonds point at
if they should expand inline rather than navigate.

---

## Step 9 — Validate

```bash
npm run typecheck    # must pass — no TS errors
npm run lint         # must pass — or `npx eslint app/auis/ux-flow/[flow-slug]/page.tsx` for a focused run
```

If the dev server is running (`npm run dev`, `http://127.0.0.1:3000`), open
`/auis/ux-flow/[flow-slug]` and confirm: the diagram renders with the dots
background, clicking a screen opens its route in the side panel, decision
exits are amber and labelled, the flow shows up in the hub gallery and in the
sidebar under its group, and the "Updated on" badge shows today's date.

---

## Quick checklist before submitting

- [ ] Read `example/page.tsx` as the reference — the diagram is the rich `<FlowDiagram>`, never a bare ReactFlow
- [ ] Page imports `edgeBase` / `branchEdge` (/ `crossEdge`) and `FlowDiagram` from `../_components/flow-editor` — never redefines node or edge primitives
- [ ] `<FlowDiagram flow="…">` **equals the folder slug** (scoping key for comments + suggestions)
- [ ] `NODES` and `EDGES` are exported; the entry screen is the first node
- [ ] Changelog wired: imports from `../_components/flow-updates`, `updates[]` seeded with a `"new-page"` entry dated today, `trailing={<FlowUpdatesBadge updates={updates} />}` on `PageHero`, `<FlowUpdatesHistorySection updates={updates} />` last
- [ ] Mapped all screens + decision points + branches + convergences (+ cross-flow jumps)
- [ ] Layout geometry calculated (COL, COL_D, branch X positions, Y table)
- [ ] Container height passed via `<FlowDiagram height={…} />` = Y[last row] + 200, rounded up to the nearest 100, minimum 800
- [ ] Every `screen` `href` is a route that exists in the repo, or `#` when no screen exists — no guessed paths
- [ ] `crossflow` `href` is `/auis/ux-flow/[other-slug]` and the target is registered in `flow-subflow.tsx` when it should expand inline
- [ ] `sourceHandle` specified on all edges leaving a decision node; every decision exit labelled
- [ ] No ASCII double quotes inside string values; no emoji; English text; tokens only; `AuCard` + `Icon` instead of hand-rolled markup
- [ ] `Tldr` NOT used — replaced with the intro `<p>` paragraph
- [ ] Section `lead` mentions "click" + "side panel" so readers know the card opens a preview
- [ ] `screens` array covers all main steps (not sub-branch variants)
- [ ] `flow-meta.ts` updated (entry in `FLOW_META`; group added to `FLOW_GROUPS` if new; not under "Examples")
- [ ] Styleguide `navigation.ts` untouched
- [ ] `npm run typecheck` and `npm run lint` pass

---

## Output to return

```md
Built UX flow: [Flow name]

Route: /auis/ux-flow/[flow-slug]

Flow structure:
- [N] screen nodes
- [N] decision nodes
- [N] branches
- [N] cross-flow jumps (→ [other flows])
- Terminal states: [list]

Changed:
- app/auis/ux-flow/[flow-slug]/page.tsx — created
- app/auis/ux-flow/_data/flow-meta.ts — registered under "[group]" (group added to FLOW_GROUPS: yes / no)
- app/auis/ux-flow/_components/flow-subflow.tsx — registered for inline expansion (only if done)

Validation:
- typecheck — passed / failed
- lint — passed / failed
- hrefs verified: [N] resolve, [N] left as "#"
```
