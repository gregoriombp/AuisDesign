---
name: auis-create-ux-flow-golden-eye
description: >
  Creates a compiled, multi-scenario "golden eye" UX flow page in the Auis UX
  Flow hub (app/auis/ux-flow/<slug>/page.tsx, served at /auis/ux-flow/<slug>):
  several journeys overlaid on one self-contained ReactFlow board, shared
  screens deduplicated into a single card with one dot per scenario, a focus
  lens and band per scenario, click-to-open screen previews with state deep
  links (?state= and ?ge= recipes), Move and Comment modes wired to the Review
  Bridge, fullscreen and a changelog. Use when the user asks for a "golden
  eye", a "compiled view", a "global view", a "bird's-eye view", "overlay these
  journeys in one flow", "the same screens across scenarios", or "focus per
  scenario". For one linear journey use auis-create-ux-flow instead.
---

# Auis — UX Flow · Golden Eye (compiled multi-scenario view)

Build a **compiled** UX flow page under `app/auis/ux-flow/[slug]/page.tsx`
that fuses **several product journeys (scenarios)** into one diagram. Where a
normal flow maps a single path start-to-finish, a golden-eye view overlays many
paths on the same board, **dedups the screens they share**, and gives the
reader a **lens** to isolate any one scenario at a time. It is the bird's-eye
map of how a region of the product actually works across situations.

Concrete jobs this skill is for:

- "Compile into one flow: **create a workspace** and, later, **adjust a
  workspace that already exists**" — two scenarios that share the editor
  screens; the *adjust* scenario re-enters the graph partway through.
- "The user **has no template yet**, so they must create one before
  continuing" — a decision (`Has a template?`) routes into a sub-journey
  (create a template) that then **converges** back into the main path. Those
  nuances are exactly what the lens makes legible.

---

## Reference implementation — READ FIRST

The canonical, working example lives at:

```
app/auis/ux-flow/example-golden-eye/page.tsx
```

**Read it before writing anything, then copy the file as your template.** It
is self-contained (ReactFlow directly, no shared board component) and its top
comment documents the building blocks: the scenario registry, the node
renderers (`ScreenNode`, `DecisionNode`, `SectionNode`) with `ScenarioDots`,
`CommentPin` and the 4-side `NodeHandles`, the edge presets, the `S()` / `D()`
constructors, `BASE_NODES` / `EDGES` / `NODE_SCENARIOS`, the lens engine with
`focusBand`, the Move / Comment toolbar, fullscreen, drag persistence, and the
`?state=` / `?ge=` deep links on a card's `variants`. **Copy from it and
adapt** — do not re-derive these blocks from memory.

The pieces a golden-eye page shares with the hub (import, never copy):

| Module | What you use |
|---|---|
| `app/auis/ux-flow/_components/golden-eye-overlays.tsx` | `GoldenEyeScreenPreview` (side panel with a variant switch and "Open in a new tab") and `GoldenEyeCommentComposer` (comment modal) |
| `app/auis/ux-flow/_components/use-golden-eye-comments.ts` | `useGoldenEyeComments({ flow })` → `{ comments, addComment, refresh }` — Review Bridge comments with `origin: "ux-flow"` |
| `app/auis/ux-flow/_components/flow-updates.tsx` | `FlowUpdatesBadge`, `FlowUpdatesHistorySection`, `FlowUpdate` |
| `app/auis/styleguide/_primitives.tsx` | `PageHero` (with `trailing`) and `Section` |
| `components/ui/Icon.tsx` | Material Symbols for pins, chips and buttons |
| `components/auis/FlowStateDriver.tsx` | replays `?ge=` recipes (mounted in `app/layout.tsx` — nothing to wire) |
| `lib/auis-states/registry.ts` | `SCREEN_STATES` — the State Mode registry behind `?state=` |

For node/edge *conventions* (step labels, branch labelling, decision questions)
the single-path example is `app/auis/ux-flow/example/page.tsx` — skim it too.

---

## Golden eye vs. a normal flow — pick the right skill

| | `auis-create-ux-flow` | **this skill (`-golden-eye`)** |
|---|---|---|
| Scope | ONE journey, start → finish | SEVERAL journeys (scenarios) merged |
| Board | shared `<FlowDiagram>` | **self-contained `<ReactFlow>`** page |
| Shared screens | n/a | **deduped** — one card, one dot per scenario |
| Lens / focus | none | **per-scenario lens** (dim + band) |
| Card click | side panel (iframe) | side panel with **variant switch** (one iframe per state) |
| Comment | Review Bridge (via the board) | Review Bridge (authored on the page via the shared hook) |
| Suggest edit | yes (flow suggestions) | **no** — structural changes go through `auis-update-ux-flow` |
| Fullscreen / changelog | yes | yes (authored on the page) |

If the user describes a single linear path, stop and use
`auis-create-ux-flow`. Use this skill only when the value is in **seeing
multiple scenarios at once and toggling between them**.

---

## Why a self-contained ReactFlow page here (and not `<FlowDiagram>`)

The base flow skill says "always `<FlowDiagram>`, never bare ReactFlow." The
golden-eye view is the **one deliberate exception**. The shared board has no
concept of scenario dots, lens dimming, the focus band, or per-card variants —
so a golden-eye page renders `<ReactFlow>` directly and authors those features
itself, exactly as the example does. There is **no shared golden-eye board
component** and you must not build one: copy the example page and adapt it.
This is **not** license to hand-roll a bare canvas for a normal flow; it is
specific to compiled multi-scenario views.

---

## Core mental model

1. **Scenario** — a distinct journey you overlay on the board. Each gets a
   label and a color.
2. **Dedup** — a screen used by more than one scenario is drawn **once**, as a
   single card, carrying **one colored dot per owning scenario**. 2+ dots = a
   shared screen. Never duplicate a card just because two scenarios touch it.
   Dedup by semantic identity (same screen / same route), not by matching
   labels.
3. **Lens / focus** — chips (`All` + one per scenario) above the canvas.
   Picking a scenario **dims** (opacity + desaturate) every node and edge that
   isn't part of it and draws a tinted **band** around the ones that are.
4. **Convergence** — the point where scenarios rejoin a **shared trunk** (e.g.
   every scenario ends at "Publish"). These are the most valuable cards to
   dedup.
5. **Cross-scenario continuation** — one scenario's terminal is another's
   entry, or a decision routes into a **sub-journey** that converges back (the
   "no template → create one → come back" shape).

---

## Input expected from the user

```txt
Compiled view name: [e.g. "Workspace — compiled view", "Checkout golden eye"]
Slug:               [e.g. "workspace-golden-eye", "checkout-golden-eye"]
Scenarios:          [2–6 journeys to overlay, each with a one-line intent]
Per scenario:       [ordered screens/states + decision points]
Shared screens:     [which screens more than one scenario touches — the dedup list]
Convergences:       [where scenarios rejoin]
Cross-scenario:     [scenario A's end = scenario B's start / decision → sub-journey]
Prototype links:    [optional href per screen — real internal routes only]
States per screen:  [optional — states to expose as variants (?state= / ?ge=)]
Intro text:         [1–2 sentences: what region of the product this compiles]
Group:              [optional — FlowGroup in the hub]
```

Infer anything missing from context — never ask for more than necessary. For
links not provided, use `#` (the card then opens nothing; the side panel needs
a real route).

---

## Step 1 — Pick & map the scenarios (the merge analysis)

This is the whole game. Before any code:

1. **List each scenario end-to-end** as its own linear path.
2. **Find shared screens across scenarios** → these dedup into single cards.
   Record which scenarios own each (the dot list).
3. **List decision points**, including the "state gates" that make scenarios
   branch: `Has a template?`, `First time here?`, `Already verified?`.
4. **List convergences** (where paths rejoin the shared trunk).
5. **List cross-scenario links** (terminal-of-A = entry-of-B; decision →
   sub-journey → converge back).
6. **Terminal states** per scenario.

Produce a merge table before touching code, e.g. for *create a workspace* +
*adjust a workspace*:

```
Card                    | create workspace | adjust workspace | shared?
------------------------|------------------|------------------|--------
Workspaces (list)       |   entry          |   entry          |  2 dots
Decision: exists?       |   → no           |   → yes          |  2 dots
New workspace form      |   yes            |   —              |  1 dot
Workspace editor        |   yes            |   yes (re-enters)|  2 dots  ← convergence
Publish                 |   yes            |   yes            |  2 dots
```

The cards with 2 dots are the spine of the value — they are what a single
linear flow could never show.

---

## Step 2 — Scenario palette (lens colors)

Each scenario gets a `-600` color token. Build the registry like the example's
`SCENARIO`:

```ts
type Scenario = "create" | "adjust" | "template"
type Focus = Scenario | "all"

const SCENARIO: Record<Scenario, { label: string; color: string }> = {
  create:   { label: "Create a workspace", color: "var(--au-blue-600)" },
  adjust:   { label: "Adjust a workspace", color: "var(--au-emerald-600)" },
  template: { label: "Create a template",  color: "var(--au-purple-600)" },
}
const ALL = Object.keys(SCENARIO) as Scenario[]
const FOCI: { id: Focus; label: string }[] = [
  { id: "all", label: "All" },
  ...ALL.map((s) => ({ id: s, label: SCENARIO[s].label })),
]
```

**Palette order (use in this order):**
`au-blue-600` → `au-emerald-600` → `au-purple-600` → `au-pink-600` →
`au-teal-600` → `au-lime-600` → `au-slate-600`.

**Avoid `au-amber-*` and `au-red-*` as scenario colors** — amber is the
decision language (dashed boxes + branch edges) and red reads as error. Using
them for a lens muddies both. The `cross` edge preset is pink dashed
(`--au-pink-500`): if a scenario needs pink, switch the cross preset to a token
no scenario uses. Cap a single board at ~6 scenarios; beyond that the dots and
lenses stop being legible — split into two compiled views instead.

---

## Step 3 — Layout geometry (streams + shared trunk)

Lay scenarios out as **parallel vertical streams** that drop into a **shared
trunk** at the convergence. The example does exactly this (visual stream left,
structural stream right, coverage audit far right, shared trunk centred) —
mirror it.

```ts
// One x-band per stream. Example for two streams + a centred trunk:
const A_X = 80     // stream A (left)
const T_X = 520    // shared trunk (centre)
const B_X = 960    // stream B (right)

// Tiny constructors keep BASE_NODES readable (copy from the example):
const S = (id: string, x: number, y: number, d: ScreenData): Node =>
  ({ id, type: "screen", position: { x, y }, zIndex: 10, data: d })
const D = (id: string, x: number, y: number, d: DecisionData): Node =>
  ({ id, type: "decision", position: { x, y }, zIndex: 10, data: d })

// Membership shorthands — one per scenario, plus the combinations you reuse:
const CR: Scenario[] = ["create"]
const AD: Scenario[] = ["adjust"]
const BOTH: Scenario[] = ["create", "adjust"]
```

**Card widths:** `ScreenNode` is `w-52` (208 px) and `DecisionNode` is `w-56`
(224 px), so a decision centred on a screen column sits at `x - 8` (the
example writes `D("d-change", TX - 8, …)`).

**Y spacing:** ~175–200 px between sequential rows in a stream; bump to ~200 px
around decisions to leave room for branch labels. Shared cards sit at the y
where the streams meet. Start at `y: 0`.

**Handles — 4 sides, target + source.** Every node exposes top/bottom/left/
right handles in both directions so edges can attach from any side (essential
once streams weave). IDs are side + role: `"t-t"` / `"t-s"`, `"b-t"` / `"b-s"`,
`"l-t"` / `"l-s"`, `"r-t"` / `"r-s"`. Copy the `SIDES` array and the
`NodeHandles` component verbatim.

**Canvas height:** the example fixes the non-fullscreen canvas at
`height: 880` and relies on `fitView` (`padding: 0.08`) to frame the whole
graph — do the same. No per-node height math needed.

---

## Step 4 — Node types (copy from the example)

Three renderers, registered once as `nodeTypes`. **Copy all three from
`example-golden-eye/page.tsx`** — do not redefine the shapes from scratch:

- **`screen`** (`ScreenNode`) — the card. Renders `ScenarioDots`, a
  `CommentPin` when the card has comments, and `step` / `title` / `note`, plus
  a "N states" hint when it lists variants. Data shape:
  ```ts
  type ScreenVariant = { label: string; href: string }
  type ScreenData = {
    step?: string
    title: string
    note?: string
    href?: string                 // the screen's real route
    variants?: ScreenVariant[]    // several states of ONE screen in one card
    scenarios: Scenario[]         // ← dedup / lens membership
    _comments?: number            // filled at render time from the comments map
  }
  ```
- **`decision`** (`DecisionNode`) — amber dashed box: `title` + `question` +
  scenario dots.
  ```ts
  type DecisionData = {
    step?: string
    title: string
    question?: string
    scenarios: Scenario[]
    _comments?: number
  }
  ```
- **`section`** (`SectionNode`) — the tinted **focus band** drawn behind the
  focused scenario's nodes. `type SectionData = { title: string; scenario: Scenario }`.

```ts
const nodeTypes = { screen: ScreenNode, decision: DecisionNode, section: SectionNode }
```

`variants` is the trick for "expired / used / cancelled"-style triples and for
state coverage: one card, several states, the side panel shows one tab per
state. Use it whenever a single conceptual screen has several terminal
variants or several registered states (Step 7).

Node ids are **stable, semantic, kebab-case** (`"workspace-editor"`, not
`"n3"`): comments are anchored to them (`flowRef.nodeId`), so renaming an id
later orphans its comments.

---

## Step 5 — Edges

Three edge presets, declared inline like the example (`base`, `branch`, `cross`):

- **`base`** — grey `smoothstep`, the main flow (entry → step, step → step,
  convergence → trunk).
- **`branch`** — amber, every edge **leaving a decision**; always labelled with
  the choice (`"Yes"`, `"No"`, `"Card"`, `"Only the look"`).
- **`cross`** — pink dashed, a **cross-scenario jump** (one scenario continuing
  into another's territory, or a loop back).

Every edge sets `sourceHandle` + `targetHandle` (the `"x-s"` / `"x-t"` ids) so
the line attaches to the right side:

```ts
const EDGES: Edge[] = [
  { id: "e1", source: "workspaces", target: "d-exists", sourceHandle: "b-s", targetHandle: "t-t", ...base },
  { id: "c1", source: "d-exists", target: "create-form", sourceHandle: "l-s", targetHandle: "t-t", label: "No — create one", ...branch },
  { id: "a1", source: "d-exists", target: "editor", sourceHandle: "b-s", targetHandle: "t-t", label: "Yes — adjust it", ...branch },
  { id: "c2", source: "create-form", target: "editor", sourceHandle: "b-s", targetHandle: "l-t", ...base },
  { id: "e2", source: "editor", target: "publish", sourceHandle: "b-s", targetHandle: "t-t", ...base },
]
```

Label entry edges with the action that starts the scenario; leave plain `base`
edges unlabelled unless they carry context.

---

## Step 6 — The three "golden eye" interactions (copy verbatim, then adapt)

These are what make it a golden eye. Lift them from the example; change only
what is noted.

**6a — Lens engine.** Two `useMemo`s + one helper, driven by `focus` state:

- **Nodes:** map `BASE_NODES`; when `focus !== "all"` and a node's `scenarios`
  don't include `focus`, add
  `className: "opacity-15 saturate-0 transition-all duration-300"` (else
  `"opacity-100 transition-all duration-300"`). Merge the live `_comments`
  counts (`comments[n.id]?.length`) and the dragged `positions`. When focused,
  prepend `focusBand(focus)`.
- **Edges:** when focused, dim any edge not fully inside the scenario —
  `NODE_SCENARIOS[source]` **and** `NODE_SCENARIOS[target]` must include it —
  as `{ ...e, label: undefined, style: { ...e.style, opacity: 0.1 } }`.
- **`focusBand(scenario)`** returns the `section` node (`id: "band"`,
  `zIndex: 0`, not selectable or draggable) sized to the bounding box of that
  scenario's members (`FOOTPRINT = { w: 230, h: 120 }`, `PAD = 40`). Copy it
  as-is; it reads `n.data.scenarios` from `BASE_NODES`.

Rules that keep the lens honest:

- **Membership is the contract.** A node on scenario X's path must list X, and
  an edge lights up only when both endpoints list the focused scenario — so a
  shared card that two scenarios pass through must list both, otherwise the
  edges into it dim and the path looks broken.
- **Bands are bounding boxes.** A scenario whose members are scattered across
  distant columns produces a band that swallows other streams. Keep each
  scenario's members in a compact region — its own stream plus the trunk —
  and give scenario-specific screens their own column.
- **Membership, not colors, drives dedup.** If two scenarios touch the same
  screen, that is one node with both ids in `scenarios` — never two nodes
  with different colors.

Keep dragging working: `onNodesChange` writes `position` changes into a
`positions` record (skipping `"band"`) so the controlled graph doesn't snap
cards back (copy the example's handler).

**6b — Click-to-open side panel.** `onNodeClick` (when not in comment mode):
for a `screen` with `href` or `variants`, set `openScreen` to
`{ title, variants }` (falling back to a single variant
`{ label: title, href }`), reset `screenVariant` to `0` and open
`GoldenEyeScreenPreview`. The shared overlay renders the iframe in an
extra-wide `AuSheet`, an `AuSegmented` switch when there are several variants,
and an "Open in a new tab" footer. Copy the handler and the overlay props from
the example.

**6c — Comment mode → Review Bridge.** A bottom-centre `Move / Comment`
toolbar. In Comment mode a card click opens `GoldenEyeCommentComposer` for
that card; "Send comment" calls `addComment({ id, title }, draft)` from
`useGoldenEyeComments({ flow: "<slug>" })`, which writes a Review Bridge
comment with `origin: "ux-flow"` and `flowRef: { flow, nodeId, nodeLabel }`.
The note then shows in Review Mode and is resolved by
`auis-review-bridge-solve`. Change **exactly one thing**:

1. **`flow` must equal this page's folder slug** — it is the comment bucket
   (`flowRef.flow`); get it wrong and the notes land under another flow.

Do **not** post golden-eye comments to `/api/flow-suggestions`: that route only
accepts structural proposals with nodes and rejects `[ge:…]`-style comment
descriptions with a 400. (The hook still reads old `[ge:<node-id>]` records
from that route, read-only, so pages migrated from the previous scheme keep
their history; new pages never write there.) If the viewer has no Review
identity yet, `addComment` opens the identity modal and returns `false` —
nothing else to handle.

Also copy the **fullscreen** toggle (CSS overlay + Esc + re-`fitView` after a
short delay) and the in-fullscreen focus `Panel` (the lens chips also live
above the canvas outside fullscreen), plus the legend row.

---

## Step 7 — State deep links (`?state=` and `?ge=`)

A compiled view is most useful when a card opens the real screen **already in
the state the scenario needs**. Two mechanisms, both consumed through a card's
`variants[]`:

**`?state=<name>` — State Mode registry.** Screens registered in
`lib/auis-states/registry.ts` (`SCREEN_STATES`) read their state from the URL
with `useScreenStateOverride` (see `app/auis/states/example/page.tsx`:
`?state=empty|loading|error|permission`, `?plan=pro`). No recipe needed —
link the query param directly. The matrix at `/auis/states` lists every
registered screen and its axes; check the registry for the exact state names
before writing a variant.

**`?ge=<recipe>` — interaction replay.** For states that live in component
state and have no URL (an open modal, a wizard on step 2, a side panel, a
menu). `FlowStateDriver` (mounted in `app/layout.tsx`, active on every route)
reads `?ge=` and replays the click path after hydration. Grammar — steps
joined by `>>`:

| Step | Effect |
|---|---|
| `t:<text>` | clicks the first clickable whose text / aria-label / title matches (exact first, then contains, case-insensitive) |
| `c:<css>` | clicks the first match of the CSS selector |
| `w:<ms>` | waits that many milliseconds |

Each step waits up to 5 s for its target to appear (portals and modals mount
async); if it never shows up, the driver stops and shows a "Could not reach
the state" badge. Build the URL with the `ge()` helper so the recipe is
URL-encoded:

```ts
const ge = (path: string, recipe: string) => `${path}?ge=${encodeURIComponent(recipe)}`

const STATES_EXAMPLE = "/auis/states/example"

S("example-screen", GX, 420, {
  step: "states · 02",
  title: "Example screen, state by state",
  note: "Registry states use ?state=; interaction states use ?ge= recipes",
  href: STATES_EXAMPLE,
  variants: [
    { label: "Default", href: STATES_EXAMPLE },
    { label: "Empty", href: `${STATES_EXAMPLE}?state=empty` },
    { label: "Loading", href: `${STATES_EXAMPLE}?state=loading` },
    { label: "New item (modal)", href: ge(STATES_EXAMPLE, "t:New item") },
    { label: "Details (side panel)", href: ge(STATES_EXAMPLE, "t:Open details>>w:400>>t:Edit") },
  ],
  scenarios: SC,
}),
```

Rules:

- Prefer `?state=` when the screen is in the registry; use `?ge=` only for
  states the registry cannot express.
- Prefer `t:` over `c:` — button text survives markup changes, selectors
  don't. Add a `w:` step between clicks that open async overlays.
- A recipe depends on the real button text: **open every `?ge=` variant in the
  browser once** and confirm the badge goes away.
- The first variant is what a plain card click opens; put the default state
  first.
- Every variant `href` is a route that exists in this repo — same rule as a
  normal flow. Use real Auis routes (`/auis/states/example`,
  `/auis/styleguide/components/au-button`, …) until the product screens exist.

---

## Step 8 — Changelog (wired from birth)

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
    summary: "Compiled view created: [N] scenarios merged into one graph.",
    tags: ["new-page"],
  },
]
```

After this, `auis-update-ux-flow` prepends entries on every structural change
(a new scenario added, a shared card split, a convergence point moved).

---

## Step 9 — Page structure

```tsx
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ReactFlow, Background, Controls, Panel, Handle, Position, MarkerType,
  type Edge, type Node, type NodeChange, type NodeProps, type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { Icon } from "@/components/ui/Icon"
import { PageHero, Section } from "../../styleguide/_primitives"
import { GoldenEyeCommentComposer, GoldenEyeScreenPreview } from "../_components/golden-eye-overlays"
import { useGoldenEyeComments } from "../_components/use-golden-eye-comments"
import { FlowUpdatesBadge, FlowUpdatesHistorySection, type FlowUpdate } from "../_components/flow-updates"

// …ge(), SCENARIO / ALL / FOCI, data types, CommentPin, ScenarioDots, NodeHandles,
//   ScreenNode / DecisionNode / SectionNode, nodeTypes, base / branch / cross,
//   column constants, S() / D(), membership shorthands, BASE_NODES, EDGES,
//   NODE_SCENARIOS, focusBand(), updates[]…

export default function [Name]GoldenEyePage() {
  // focus · openScreen / screenPreviewOpen / screenVariant · isFullscreen ·
  // commentMode · useGoldenEyeComments({ flow: "[slug]" }) · composer /
  // composerOpen / draft / sending · positions · rfRef
  // nodes / edges useMemo (lens) · onNodesChange (drag persistence) ·
  // fullscreen effects · sendComment · focusTabs
  return (
    <>
      <PageHero
        title="[Compiled view name]"
        trailing={
          <>
            <span className="inline-flex items-center rounded-full border border-(--au-amber-300) bg-(--au-amber-100) px-2 py-0.5 text-2xs font-medium text-(--au-amber-800)">
              compiled view
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
          title="Compiled flowchart"
          lead="2+ dots on a card = screen shared between scenarios. The lens dims what is outside the focused scenario and draws its band. In Move mode: drag cards and click to open the real screen. In Comment mode: click a card to leave a note. Fullscreen button in the corner."
        >
          {/* focus chips, legend, then the ReactFlow block with its Panels
              (focus in fullscreen · fullscreen toggle · Move / Comment) — copy from the example */}
        </Section>
      </div>

      {/* Docs — back inside a normal text column */}
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-10 pb-14">

        {/* Compiled scenarios — one entry per scenario */}
        <Section id="scenarios" title="Compiled scenarios" lead="Each journey overlaid on this map: what it is, where it enters, where it converges.">
          {/* list: scenario dot + label + entry → terminal + which shared cards it touches */}
        </Section>

        {/* Shared screens and convergence — the dedup decisions */}
        <Section id="shared" title="Shared screens and convergence" lead="Why these screens became a single card — and where the scenarios meet again.">
          {/* ordered list, one line per deduped / convergence card + each gate decision */}
        </Section>

        {/* Changelog — always last */}
        <FlowUpdatesHistorySection updates={updates} />
      </div>

      {/* Screen side panel + comment composer — copy the props from the example */}
      <GoldenEyeScreenPreview … />
      <GoldenEyeCommentComposer … />
    </>
  )
}
```

The two doc sections are part of the deliverable, not decoration:

- **Compiled scenarios** — orientation: one row per scenario (its dot / color,
  one-line intent, entry → terminal, and the shared cards it passes through).
- **Shared screens and convergence** — the dedup ledger: each shared card and
  *why* it is one card (e.g. "Workspace editor — create and adjust use the
  same screen; adjust re-enters here directly"), plus each convergence point
  and each gate decision.

---

## Step 10 — Register in flow-meta.ts

`app/auis/ux-flow/_data/flow-meta.ts` is the single source — the hub sidebar
(`../navigation.ts`), the hub gallery (`../page.tsx`) and the Review Bridge
suggestions panel all derive from it. Never edit the styleguide
`navigation.ts` (its "UX flows" group only lists the hub and the two examples).

Append one entry to `FLOW_META`:

```ts
{
  slug: "[slug]",
  title: "[Domain] — compiled view",
  description: "[one line: which scenarios were fused, and into what]",
  group: "Compiled views",
},
```

Rules:

- The slug ends in `-golden-eye` (the example is `example-golden-eye`); the
  title carries the "— compiled view" suffix so it reads differently from the
  single-journey flows in the sidebar.
- Use a dedicated group such as `"Compiled views"` (or the product area the
  view belongs to). If the group does not exist yet, add it to `FLOW_GROUPS` —
  array order is the sidebar and gallery order. Never register under
  `"Examples"` (reserved for the neutral references shipped with Auis).
- Do **not** register a golden-eye page in `flow-subflow.tsx`: its nodes carry
  `scenarios`, a `section` type and 4-side handle ids that the shared
  `FlowDiagram` does not know, so it cannot expand inline inside another flow.

---

## Step 11 — Strings inside node data + house rules

**Never use ASCII double quotes inside a string value** — it breaks the
parser. Use single quotes, a template literal, or rephrase:

```ts
note: 'Click "Create workspace" to begin.',   // single-quoted outer
note: `Click "Create workspace" to begin.`,   // template literal
note: "Click Create workspace to begin.",     // rephrased
note: "Click "Create workspace" to begin.",   // breaks
```

House rules the page must respect:

- **Tokens only** — `var(--au-*)`, `var(--fg-*)`, `var(--bg-*)`,
  `var(--border-*)`, `var(--shadow-*)`, `text-2xs` / `text-3xs`, `rounded-*`.
  No hex, no `px` arbitrary values, no new tokens. Scenario colors are tokens
  from the palette in Step 2.
- **`Au*` components from `components/ui/`** for overlays (`AuSheet`,
  `AuModal`, `AuSegmented`, `AuButton`, `AuTextarea` — already inside the
  shared golden-eye overlays). Never hand-roll a modal, sheet or menu on the
  page.
- **Icons through `components/ui/Icon.tsx`** (Material Symbols: `chat_bubble`,
  `layers`, `fullscreen`, `fullscreen_exit`, …). No raw `<svg>`.
- **No emoji** in labels, notes, chips, summaries or comments.
- **English UI text** everywhere.

---

## Step 12 — Validate

```bash
npm run typecheck    # must pass — no TS errors
npm run lint         # must pass — or `npx eslint app/auis/ux-flow/[slug]/page.tsx`
```

If the dev server is up (`npm run dev`, `http://127.0.0.1:3000`), open
`/auis/ux-flow/[slug]` and confirm: the graph fits on load; each lens chip
dims the rest and draws the band; shared cards show one dot per owning
scenario; a card click opens the side panel and the variant switch loads each
state (every `?ge=` recipe finishes without the "Could not reach the state"
badge); Comment mode posts a note that appears in the Review Bridge; dragging
persists; fullscreen toggles and Esc exits; the browser console stays clean.

---

## Quick checklist before submitting

- [ ] Read `example-golden-eye/page.tsx` first — node renderers, handles, lens
      engine, side-panel handler, comment wiring, fullscreen all **copied**
      from it, not re-derived
- [ ] Self-contained `<ReactFlow>` page (the named exception) — NOT `<FlowDiagram>`,
      and no new shared board component
- [ ] Scenarios mapped: merge table done, shared screens deduped to one card
      with one dot per owning scenario, convergences + cross-scenario links found
- [ ] `SCENARIO` palette uses `-600` tokens in the recommended order; **no amber
      / red** as scenario colors; ≤ ~6 scenarios
- [ ] Streams + shared trunk laid out; decisions at `x - 8`; 4-side handles
      (`x-t` / `x-s`) on every edge; `fitView` frames the graph; canvas
      `height: 880` outside fullscreen
- [ ] Lens engine: out-of-focus nodes `opacity-15 saturate-0`, edges dimmed +
      labels dropped, `focusBand` drawn; membership accurate on every node;
      dragging persists via `positions`
- [ ] Side panel: `GoldenEyeScreenPreview` with variants; every `href` /
      variant is a route that exists (or `#` deliberately); `?state=` names
      match the registry; every `?ge=` recipe verified in the browser
- [ ] Comment: `useGoldenEyeComments({ flow })` with `flow` **equal to the
      folder slug**; nothing posted to `/api/flow-suggestions`
- [ ] Node ids stable and semantic (comments anchor to them)
- [ ] Changelog wired: `updates[]` seeded with a `"new-page"` entry dated today,
      `FlowUpdatesBadge` in `trailing`, `FlowUpdatesHistorySection` last
- [ ] Canvas section is full-width; doc sections ("Compiled scenarios",
      "Shared screens and convergence") are inside the text column
- [ ] No ASCII double quotes inside string values; no emoji; English; tokens
      only; `Icon` for icons
- [ ] `flow-meta.ts` updated under "Compiled views" (group added to
      `FLOW_GROUPS` if new); not under "Examples"; not in `flow-subflow.tsx`;
      styleguide `navigation.ts` untouched
- [ ] `npm run typecheck` and `npm run lint` pass

---

## Output to return

```md
Built golden-eye (compiled) UX flow: [Compiled view name]

Route: /auis/ux-flow/[slug]

Compiled structure:
- [N] scenarios: [list with their colors]
- [N] screen cards ([N] shared / deduped — 2+ dots)
- [N] decision nodes
- Convergences: [list]
- Cross-scenario links: [list]
- State deep links: [N] ?state= variants, [N] ?ge= recipes (all verified)

Changed:
- app/auis/ux-flow/[slug]/page.tsx — created
- app/auis/ux-flow/_data/flow-meta.ts — registered under "Compiled views" (group added: yes / no)

Validation:
- typecheck — passed / failed
- lint — passed / failed
- browser check — lens, dots, side panel, comment, fullscreen: passed / not run
```
