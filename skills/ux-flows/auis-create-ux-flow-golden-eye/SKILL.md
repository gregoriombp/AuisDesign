---
name: auis-create-ux-flow-golden-eye
description: >
  Builds a compiled, multi-scenario golden-eye UX flow page in the Auis
  styleguide. Merges several product journeys into one deduplicated ReactFlow
  graph with per-scenario focus lenses, shared-screen dots, route previews,
  fullscreen, draggable nodes, and an updates changelog. Use when the user asks
  for a global or compiled view, a golden eye, several journeys overlaid in one
  flow, per-scenario focus, or a bird's-eye view. For one journey, use
  auis-create-ux-flow instead.
---

# Auis — Golden-eye UX flow

Build a compiled flow under
`app/auis/styleguide/ux-flows/[slug]/page.tsx`. A golden-eye flow overlays
several journeys on one board, renders every shared screen once, and lets the
reader focus one scenario at a time.

## Read the public contract first

- Working page: `app/auis/styleguide/ux-flows/example-golden-eye/page.tsx`
- Shared board: `app/auis/styleguide/ux-flows/_components/golden-eye.tsx`

Use `GoldenEyeDiagram`; do not copy its ReactFlow renderers, lens logic,
fullscreen handling, or `AuSheet` preview into each page. This is the one raw
ReactFlow-based flow family, but the raw integration stays encapsulated in the
shared feature component. Normal single-journey flows use `FlowDiagram` through
`auis-create-ux-flow`.

## Input

```txt
Name:              [compiled view title]
Slug:              [kebab-case route slug]
Scenarios:         [2–6 journeys, each with a one-line intent]
Per scenario:      [ordered screens and decisions]
Shared screens:    [screens touched by more than one scenario]
Convergences:      [where scenarios rejoin]
Prototype links:   [optional route per screen]
Intro:             [what product region this view explains]
```

Infer small gaps from context. Use `#` when no prototype exists. Keep the board
to roughly six scenarios; beyond that, split it into two compiled views.

## 1. Build the merge table

List each journey end to end before writing code. Deduplicate screens by
semantic identity, not merely by matching labels.

```txt
Screen                 | create | adjust | shared?
-----------------------|--------|--------|--------
Workspace              | entry  | entry  | yes
Create form            | yes    | no     | no
Editor                 | yes    | yes    | yes — convergence
Review                 | yes    | yes    | yes
```

Record:

1. entry and terminal screen for each scenario;
2. every decision and its branch labels;
3. shared screens and convergence points;
4. the real route for each screen, when available.

## 2. Define the scenario registry

Use existing `-600` palette tokens. Avoid amber and red because the flow system
reserves those meanings for decisions and errors.

```tsx
import type { GoldenScenario } from "../_components/golden-eye"

const SCENARIOS: GoldenScenario[] = [
  { id: "create", label: "Create", color: "var(--au-blue-600)" },
  { id: "adjust", label: "Adjust", color: "var(--au-emerald-600)" },
]
```

Preferred order: blue, emerald, purple, pink, teal, lime, slate.

## 3. Author nodes

Use `Node<GoldenNodeData>[]`. The `scenarios` array is the lens-membership and
dedup contract: two or more ids render two or more dots on a shared card.

```tsx
import type { Node } from "@xyflow/react"
import type { GoldenNodeData } from "../_components/golden-eye"

const NODES: Node<GoldenNodeData>[] = [
  {
    id: "workspace",
    type: "screen",
    position: { x: 320, y: 0 },
    data: {
      step: "entry",
      title: "Workspace",
      note: "Shared entry for both scenarios.",
      href: "/workspace",
      scenarios: ["create", "adjust"],
    },
  },
  {
    id: "has-item",
    type: "decision",
    position: { x: 305, y: 180 },
    data: {
      step: "01",
      title: "Existing item?",
      question: "Does the item already exist?",
      scenarios: ["create", "adjust"],
    },
  },
]
```

Supported types:

- `screen`: `step`, `title`, optional `note`/`href`, and `scenarios`;
- `decision`: `step`, `title`, `question`, and `scenarios`.

Lay parallel scenario streams in separate x columns, then converge them into a
shared central trunk. Leave about 180–220 units around decisions for edge
labels.

## 4. Author edges

Use smooth-step edges and existing variables. Set `sourceHandle` on decision
branches (`left`, `right`, or `bottom`) and label every branch.

```tsx
const base = {
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
  style: { stroke: "var(--border-strong)", strokeWidth: 1.5 },
}

const EDGES: Edge[] = [
  { id: "entry-decision", source: "workspace", target: "has-item", ...base },
  {
    id: "decision-create",
    source: "has-item",
    sourceHandle: "left",
    target: "create-form",
    label: "No",
    ...base,
  },
]
```

The shared board dims an edge unless both endpoint nodes belong to the focused
scenario. Keep each node's membership accurate so the lens remains honest.

## 5. Compose the page

Follow `example-golden-eye/page.tsx`:

```tsx
<PageHero
  title="[Compiled view name]"
  trailing={<FlowUpdatesBadge updates={updates} />}
>
  [What this compiles and why the combined view matters.]
</PageHero>

<div className="w-full px-10 pb-10">
  <Section
    id="flow"
    title="Compiled flowchart"
    lead="Choose a scenario lens to dim the other paths. Multiple dots identify shared screens; click a screen to preview its route."
  >
    <GoldenEyeDiagram scenarios={SCENARIOS} nodes={NODES} edges={EDGES} />
  </Section>
</div>
```

Below the board, add two documentation sections in a normal desktop text
column:

- **Compiled scenarios** — one row per journey: intent, entry, terminal;
- **Shared screens and convergence** — the dedup ledger and why each shared
  card is one semantic screen.

Seed `updates` with one `new-page` entry dated today and render
`FlowUpdatesHistorySection` last. The global Review Mode can comment on the
page; do not add a second comment system to the golden-eye board.

## 6. Register the route

Append the page under the Auis UX flows section in
`app/auis/styleguide/navigation.ts`:

```ts
{
  group: "Auis",
  title: "UX flows",
  items: [
    { name: "[Compiled view]", href: "/auis/styleguide/ux-flows/[slug]" },
  ],
}
```

## 7. Validate

```bash
npm run typecheck
npm run ds:check
```

When the app is running, verify that each lens dims the other path, shared
cards show every owning scenario dot, dragging works, a screen opens its route
in the sanctioned `AuSheet`, fullscreen toggles, and the browser console stays
clean.

## Completion checklist

- [ ] Read the public example and shared golden-eye component.
- [ ] Mapped 2–6 scenarios and deduplicated shared screens.
- [ ] Every node has accurate `scenarios` membership.
- [ ] Every decision branch has a handle and label.
- [ ] Prototype hrefs resolve or use `#` deliberately.
- [ ] Page uses `GoldenEyeDiagram`, not page-local ReactFlow renderers.
- [ ] Added scenario and convergence documentation.
- [ ] Seeded and rendered the updates changelog.
- [ ] Registered the route under Auis → UX flows.
- [ ] Typecheck, design-system check, and browser verification pass.
