---
name: auis-create-ux-flow
description: >
  Builds a UX flow diagram page in the Auis styleguide
  (/auis/styleguide/ux-flows/[name]) from a flow description, a list of
  steps, or any written brief. Maps every screen, decision point, branch, and
  convergence into a ReactFlow diagram using the established Auis UX flow
  format. Registers the new page in navigation.ts. Use when the user asks to
  "build a UX flow", "map a flow", "create a flow diagram", or "put together a
  flowchart", or hands over a list of steps/screens asking for a styleguide UX
  flow page.
---

# Auis — UX Flow

Build a UX flow diagram page under `/app/auis/styleguide/ux-flows/[flow-slug]/page.tsx`
from a written description of the flow.

## Reference implementation

The canonical example lives at:
```
app/auis/styleguide/ux-flows/example/page.tsx
```
Read it **before starting**. It is the source of truth for node types, edge
styles, layout constants, and page structure. It deliberately uses a neutral
builder scenario, public routes, one decision, two branches, and a convergence.
All new flow pages must follow the same contract; add `crossflow` nodes only
when the requested journey genuinely jumps to another registered flow.

### Always the rich `<FlowDiagram>` board — never a simpler diagram

The diagram is **always** `<FlowDiagram>` — the shared rich board that carries
fullscreen ("Fullscreen"), Comment, Suggest edit, the suggestions badge, and
the side-drawer prototype preview (see the next section). This is the same board
the login flow uses. **Do not** hand-roll a bare `<ReactFlow>` or a stripped-down
canvas per page — every flow inherits the full toolset for free by rendering
`<FlowDiagram>`.

---

## What the diagram gives you for free

Every interactive feature of the flow diagram lives **inside `<FlowDiagram>`**,
not in the page. A page that renders `<FlowDiagram flow="…" nodes={…} edges={…} />`
automatically inherits all of these — you do **not** wire them per page:

- **Comment** — FigJam-style comment markers. Each comment goes to the
  review-bridge tagged `origin: "ux-flow"` and shows in Review Mode with a
  **"UX Flow"** chip.
- **Suggest edit** — opens edit mode; "Save" POSTs the edited graph to the
  serverless route `/api/flow-suggestions` (no server, no token). Suggestions
  are applied later via the `auis-flow-bridge-solve` skill.
- **Fullscreen** — fullscreen toggle (CSS overlay, ESC to exit).
- **Sub-flow expansion** — a `crossflow` diamond whose `href` points at another
  expandable ux-flow opens that flow inline.
- **Suggestions badge** — count of open suggestions, top-right.

**The `flow` prop is a hard contract, not a label.** It is the scoping key for
both comments (`flowRef.flow`) and suggestions (`/api/flow-suggestions?flow=…`).
It **must equal the page's slug** — the folder name under `ux-flows/`. Pass it
wrong and comments/suggestions silently land in the wrong bucket. So:
`ux-flows/example/` → `<FlowDiagram flow="example" …>`.

The only feature a page **does** author itself is the **updates changelog**
(`updates[]` + `<FlowUpdatesBadge>` + `<FlowUpdatesHistorySection>`) — see Step 6.

---

## Input expected from the user

```txt
Flow name:  [e.g. "Login", "Agent creation", "Password recovery"]
Slug:       [e.g. "login", "agent-creation", "password-recovery"]
Steps:      [numbered list of screens / states]
Decision points: [where the user chooses between paths]
Branches:   [what each path contains and how they converge]
Intro text: [1–2 sentences summarising what this flow is about]
Prototype links: [optional — href for each screen node]
```

If the user doesn't supply all fields, **infer from context** — never ask for
more than necessary. For prototype links not provided, use `#` as href.

---

## Step 1 — Analyse the flow

Before writing any code, map the entire flow:

1. List every **screen** (step node) and **decision point** in order.
2. Identify every **branch** (where the flow splits into 2–3 paths).
3. Identify every **convergence** (where branches rejoin to a single node).
4. Note the **terminal nodes** (last states: success, redirect, dead-end).
5. Note the **entry point** (the screen before the flow starts, e.g. Login page).

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

The main column is centred at **x = 380px** (screen-relative):

| Node type | Width | x position | Centre |
|---|---|---|---|
| `ScreenNode` (200 px) | 200 px | `COL = 280` | 380 |
| `DecisionNode` (240 px) | 240 px | `COL_D = 260` | 380 |

### Branch column formulas

**2-branch layout** (left / right symmetric around 380):
```
LEFT_X  = 80    centre = 180
RIGHT_X = 480   centre = 580
avg centre = 380 ✓
```

**3-branch layout** (pix / card / boleto style):
```
LEFT_X   = 40   centre = 140
CENTER_X = 280  centre = 380   (same as COL)
RIGHT_X  = 520  centre = 620
avg centre = 380 ✓
```

If a branch section has **more than 3 paths**, use two separate rows of
branches or widen the layout — document the choice.

### Y spacing

Use **160 px** between sequential main-flow nodes.  
Use **200 px** between a decision node and its branch nodes (extra room for
edge labels).  
Use **180 px** between branch nodes and their convergence node.

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
containerHeight = Y[lastRow] + 200   // 200px padding below last nodes
```

Round up to the nearest 100 for cleanliness. Minimum 800 px.

---

## Step 3 — Node types

The three node types — `screen`, `decision`, and `crossflow` — are already
implemented in `../_components/flow-editor.tsx` and registered inside
`FlowDiagram`. **Do not redefine them in your page.** A flow page only authors
the `NODES` and `EDGES` arrays and hands them to `<FlowDiagram>`. Do not invent
new node types.

### `screen` — a screen/state

Data shape: `{ step: string; title: string; href: string; note?: string }`

- `step`: label shown as eyebrow — use `"entry"`, `"01"`, `"02a"`, `"→ flow"`, etc.
- `title`: short screen name (≤ 4 words)
- `href`: route to the prototype screen, or `#` if no prototype yet.
- `note`: one short sentence about the screen's purpose (optional but recommended)

**Preview behavior (drawer):** in view mode, clicking anywhere on a
screen card opens the screen's `href` inside a side drawer — an `AuSheet`
(wide variant) carrying an iframe. `FlowDiagram` wires this through
ReactFlow's `onNodeClick` (not via a `<Link>` wrapping the card, which
ReactFlow's pointer handling tends to swallow); flow pages don't need
to do anything beyond filling `href` correctly.

- Internal route (`/projects/checkout`, `/settings/profile`, …) → loaded in the iframe.
- `#` or empty string → drawer shows a "No prototype yet" placeholder.
- External URL (`https://…`) → drawer offers an "Open in a new tab" button instead of the iframe.
- `cmd/ctrl-click` on an internal route opens it in a new tab — plain click opens the drawer.

So: **prefer real internal routes over `#`** whenever a prototype exists.
The drawer makes them previewable in-place from the diagram.

### `decision` — decision point

Data shape: `{ step: string; title: string; question: string }`

- `step`: decision identifier (`"02"`, `"fim"`, etc.)
- `title`: the decision name (e.g. `"Authentication method"`)
- `question`: the question the user faces at this point (≤ 15 words)

**Handle rules for decision nodes:**
- `id="left"` → used when the left branch exits from the left side
- `id="bottom"` → used for the center/straight-down branch
- `id="right"` → used when the right branch exits from the right side
- Always specify `sourceHandle` on edges leaving a decision node

### `crossflow` — jump to another flow

Use this **only** when the path leaves THIS flow and enters ANOTHER styleguide
flow (e.g. checkout → order-confirmation). Renders as a purple diamond (rotated
square), visually distinct from screen cards and decision boxes. Clicking it
opens a confirmation modal ("Go to another flow?") and only navigates on
confirm.

Data shape (same as `screen`): `{ step: string; title: string; href: string; note?: string }`

- `title`: the **destination flow's name** — short, shows inside the diamond and in the modal (e.g. `"Checkout"`, `"Confirmation"`).
- `href`: the OTHER flow's page route — `/auis/styleguide/ux-flows/[other-slug]`. Not a prototype route.
- `note`: optional one-liner of context.
- Handles are top (target) + bottom (source), like `screen` — no `sourceHandle` needed on its edges.

Don't use `crossflow` for a normal terminal screen that just enters the product
(e.g. `/inicio`) — that stays `screen`. Only for jumps between two ux-flow pages.

---

## Step 4 — Edge styles

Three edge bases — `edgeBase` (grey, main flow), `branchEdge` (amber, exit from
a decision), and `crossEdge` (purple dashed, to/from a `crossflow` node) — are
exported from `../_components/flow-editor.tsx`. Import the ones you use instead
of redeclaring:

```ts
import { branchEdge, edgeBase, FlowDiagram } from "../_components/flow-editor"
```

Define `labelProps` inline in the page (it's small and the props vary per
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
- `branchEdge` — decision → any branch node (always amber, always labelled with the branch choice)
- `crossEdge` — an edge that touches a `crossflow` node (purple dashed, marks the jump to another flow)

**Edge labelling:**
- Decision → branch: label with the branch choice (e.g. `"Pix"`, `"Google"`, `"Yes"`, `"No"`)
- Entry → first step: label with the action that starts the flow (e.g. `"First access"`)
- Other edges: no label unless they carry important context

---

## Step 5 — Strings inside node data

**Never use ASCII double-quotes inside a string value** — the JS parser will
break. Use one of these approaches:

```ts
// ✅ Use single-quoted outer string for notes with quotes inside
note: 'Click "First access" to start.',

// ✅ Use a template literal
note: `Click "First access" to start.`,

// ✅ Rephrase to avoid inner quotes
note: "Click First access to start the flow.",

// ❌ NEVER — breaks the parser
note: "Click "First access" to start.",
```

---

## Step 6 — Page structure

The page has **four sections** in this order. The `Tldr` component is **not
used** in UX flow pages — replace it with a brief introductory paragraph.

### Imports + changelog scaffold

Every flow page is born with the updates changelog wired in (the badge in the
hero + the history section at the bottom). Import the helpers and declare an
`updates[]` array — seed it with **one** entry dated today marking the flow's
creation. After this, the `auis-update-ux-flow` skill prepends new
entries on every structural change.

```tsx
"use client"

import Link from "next/link"
import type { Edge, Node } from "@xyflow/react"

import { PageHero, Section } from "../../_primitives"
import { branchEdge, edgeBase, FlowDiagram } from "../_components/flow-editor"
import {
  FlowUpdatesBadge,
  FlowUpdatesHistorySection,
  type FlowUpdate,
} from "../_components/flow-updates"

// ...NODES / EDGES / screens arrays...

const updates: FlowUpdate[] = [
  {
    date: "[today YYYY-MM-DD]",
    summary: "Flow mapped in the styleguide.",
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
          where decision points are, what the terminal states are. This is
          the "orientation" paragraph a reader needs before diving into the
          diagram.]
        </p>

        {/* SECTION 2 — the diagram */}
        <Section
          id="flow"
          title="Flowchart"
          lead="Click any screen to open its prototype in a side panel. Amber dashed boxes are decisions — points where the user makes a choice. Amber arrows mark the branching paths."
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
          lead="Purpose, decisions, and a direct link to each one's prototype."
        >
          <div className="overflow-hidden rounded-lg border border-subtle bg-raised">
            <ul className="m-0 p-0 list-none flex flex-col divide-y divide-[var(--border-subtle)]">
              {screens.map((s) => (
                <li key={s.step + s.title} className="p-5 flex flex-col gap-2">
                  <div className="flex items-baseline gap-3">
                    <span className="au-eyebrow text-fg-tertiary">{s.step}</span>
                    <h3 className="m-0 text-base font-medium text-fg-primary">{s.title}</h3>
                  </div>
                  <p className="m-0 text-sm leading-relaxed text-fg-secondary">{s.purpose}</p>
                  <div className="mt-1 flex items-center gap-6">
                    <span className="caption">
                      <span className="font-medium text-fg-secondary">Decisions: </span>
                      {s.decisions}
                    </span>
                    <Link href={s.href} className="text-sm font-medium text-fg-primary no-underline hover:underline">
                      Open prototype →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* SECTION 4 — design decisions (2–4 cards) */}
        <Section
          id="design-notes"
          title="Design decisions"
          lead="Why the flow is structured this way."
        >
          <div className="grid grid-cols-2 gap-4">
            {/* One card per key design decision. Use the info from the flow
                description to fill these. Each card: eyebrow + paragraph. */}
            <div className="rounded-lg border border-subtle bg-raised p-5">
              <div className="au-eyebrow mb-2">[Decision title]</div>
              <p className="m-0 text-sm leading-relaxed text-fg-secondary">
                [Why the flow is structured this way.]
              </p>
            </div>
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
(skip sub-branches that are just variants of the same screen):

```ts
const screens = [
  {
    step: "01",
    title: "Screen name",
    href: "/route/to/prototype",
    purpose: "What this screen does and why it exists here.",
    decisions: "What happens after → where it leads.",
  },
  // ...
]
```

---

## Step 7 — Register in navigation.ts

Add the new flow to the `"UX Flows"` section in
`app/auis/styleguide/navigation.ts`:

```ts
{
  title: "UX Flows",
  items: [
    { name: "Example flow", href: "/auis/styleguide/ux-flows/example" },
    { name: "[New flow title]", href: "/auis/styleguide/ux-flows/[flow-slug]" },
  ],
},
```

Never create a new section — always append to the existing `"UX Flows"` array.

---

## Step 8 — Validate

```bash
npm run typecheck    # must pass — no TS errors
```

If the dev server is running, open the page and confirm the diagram renders,
nodes are clickable, and the dots background is visible.

---

## Quick checklist before submitting

- [ ] Read `example/page.tsx` as the public reference — diagram is the rich `<FlowDiagram>`, never a bare ReactFlow
- [ ] Page imports `branchEdge`, `edgeBase`, `FlowDiagram` from `../_components/flow-editor` — never redefines node or edge primitives
- [ ] `<FlowDiagram flow="…">` **equals the folder slug** (scoping key for comments + suggestions)
- [ ] Changelog wired: imports from `../_components/flow-updates`, `updates[]` seeded with a "new-page" entry dated today, `trailing={<FlowUpdatesBadge updates={updates} />}` on `PageHero`, `<FlowUpdatesHistorySection updates={updates} />` last
- [ ] Mapped all screens + decision points + branches + convergences
- [ ] Layout geometry calculated (COL, COL_D, branch X positions, Y table)
- [ ] Container height passed via `<FlowDiagram height={…} />` = Y[last row] + 200, rounded to nearest 100
- [ ] Every `screen` node's `href` is either a real internal route (so the drawer can preview it) or `#` when no prototype exists
- [ ] `sourceHandle` specified on all edges leaving a decision node
- [ ] No ASCII double-quotes inside JS string values
- [ ] `Tldr` component NOT used — replaced with intro `<p>` paragraph
- [ ] Section `lead` mentions "click" + "side panel" so readers know the card opens a preview drawer
- [ ] `screens` array covers all main steps (not sub-branch variants)
- [ ] `navigation.ts` updated under `"UX Flows"` section
- [ ] `npm run typecheck` passes

---

## Output to return

```md
Built UX flow: [Flow name]

Route: /auis/styleguide/ux-flows/[flow-slug]

Flow structure:
- [N] screen nodes
- [N] decision nodes  
- [N] branches
- Terminal states: [list]

Changed:
- app/auis/styleguide/ux-flows/[flow-slug]/page.tsx — created
- app/auis/styleguide/navigation.ts — added entry under UX Flows

Validation:
- typecheck — passed / failed
```
