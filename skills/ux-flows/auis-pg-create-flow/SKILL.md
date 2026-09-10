---
name: auis-pg-create-flow
description: >
  Creates a NEW UX flow in the Auis UX Flow hub (`/auis/ux-flow/[slug]`)
  from an `.awflow.json` file exported from the PG (designer) repo. Reads
  the file (local path or pasted content), parses it via `parseAuFlowFile`,
  maps it to the `FlowDiagram` shape via `mapAuFlowToLocal`, asks for the
  screens' `href` values (PG doesn't carry that info), scaffolds the full
  page at `app/auis/ux-flow/[slug]/page.tsx`, and registers it in
  `app/auis/ux-flow/_data/flow-meta.ts` (the hub gallery and sidebar derive
  from it). Use when the user asks to "import a flow from PG", "create a
  flow from the .awflow", "new flow from design", "scaffold the
  .awflow.json", or attaches/points to an `.awflow.json` file to create a
  brand-new flow. Do NOT use when the slug already exists under
  `app/auis/ux-flow/` — for that case, use `auis-pg-merge-flow`.
---

# Auis PG — Create flow from `.awflow.json`

Creates a new flow in the UX Flow hub (`/auis/ux-flow`) from the designer's
(PG) export. The `.awflow.json` file carries the diagram (nodes + edges) and
the screens' specs (purpose, scenarios, criteria). This skill does **not**
merge — if the flow already exists, redirect to
[`auis-pg-merge-flow`](../auis-pg-merge-flow/SKILL.md).

## Prerequisites

- `app/auis/ux-flow/_lib/awflow-import.ts` exists in the repo (the importer
  module). If it doesn't, stop and tell the user — something is out of place.
- The public reference flow exists at `app/auis/ux-flow/example/page.tsx` to
  copy the page contract from.
- `app/auis/ux-flow/_data/flow-meta.ts` exports `FLOW_META` and
  `FLOW_GROUPS` — the only registration point. The hub sidebar
  (`app/auis/ux-flow/navigation.ts`) and the gallery
  (`app/auis/ux-flow/page.tsx`) are derived from it; never edit them by hand.

---

## Step 1 — Locate and validate the file

The user provides the `.awflow.json` in one of these ways:

1. **Local path** — "use /Users/.../login.awflow.json"
2. **Pasted content** — JSON in the chat itself
3. **Attached in the chat** — file visible in the conversation

Load the content. Then validate it by running `parseAuFlowFile` through a
temporary call (you can use an inline `tsx`-like runner, or simply read the
JSON and check:

- `schemaVersion === 1`
- `flow.id` is a non-empty string
- `graph.nodes` array, `graph.edges` array
- `screens` array

If any of them fails, **stop** and show the user the error. Don't try to
"fix" the file — ask for a clean export from PG.

---

## Step 2 — Resolve the slug

- The default is `file.flow.id` (e.g. `"login"`, `"checkout"`).
- The hub uses its own slugs — e.g. the PG flow `login` may become
  `login-auth` here. List the existing flows (the `FLOW_META` entries in
  `app/auis/ux-flow/_data/flow-meta.ts` plus any
  `app/auis/ux-flow/<slug>/page.tsx` folder) and ask the user whether they
  want the PG slug or another one.
- The slug becomes the route (`/auis/ux-flow/<slug>`) and the `flow` key of
  the suggestions bridge — lowercase, hyphenated, no spaces.
- If the chosen slug **already exists**, stop and say: "that flow already
  exists. Use `auis-pg-merge-flow`."

---

## Step 3 — Map to the local shape

Load the importer dynamically (via `tsx`/`node --import tsx/esm`, or
through the dev server with a temporary endpoint if that's easier) and
run `mapAuFlowToLocal(file)`. You get:

- `nodes` — `Node<ScreenData|DecisionData>[]` ready for `<FlowDiagram>`
- `edges` — `Edge[]` with the correct `markerEnd`, `style`, `sourceHandle`
- `meta` — `{ id, title, description, section }`
- `screens` — rich specs (purpose, scenarios, criteria) for each screen
- `narrative` — `{ persona, context, value }` (may be null)
- `proposedUpdate` — suggested first entry in `updates[]`
- `screensMissingHref` — list of screen node IDs with no href

`meta.section` (`studio` / `adm`) is data carried by the export — it is
**not** the hub group. The group is chosen in Step 5.

If you'd rather not run it at runtime, do the map **by hand** following what
`awflow-import.ts` does (the function is pure and the code is the reference).
But runtime is safer against drift.

---

## Step 4 — Resolve each screen's `href`

PG has no concept of href (the product's real route). This is the only
`ScreenData` field that needs human input.

For each id in `screensMissingHref`:

1. Show `screen.name` + `screen.purpose` (from the JSON specs).
2. Suggest 1-3 plausible routes based on the name/purpose (e.g. the
   "login" screen → `/login`, `/`, `/sign-in`).
3. Ask the user; accept the literal value, "#" (placeholder), or
   "skip" (leaves "#").

**Don't ask one by one if there are more than 6 screens** — present them all
at once (numbered list) and ask the user to answer in batch. Reduce friction.

---

## Step 5 — Summary + light UX analysis

Before creating files, show a plan:

```
New flow: <meta.title>
Route: /auis/ux-flow/<slug>
Hub group: <existing FLOW_GROUPS entry, or a new one>
PG section: <meta.section>

Diagram:
- <X> screens, <Y> decisions
- <Z> edges (<W> branches)

Screens with a real href: <count>/<total>
Screens with href "#" (placeholder): <count>

Narrative: <persona summary, if any>

Initial updates: 1 entry ("Structure imported from [repo] on [date]")
```

Ask for the hub **group** here: an existing `FLOW_GROUPS` entry or a new one
(e.g. "Onboarding", "Billing"). Don't file product flows under "Examples" —
that group is reserved for the product-neutral references shipped with Auis.

**Quick UX analysis** — only flag, don't block:

- Decisions with no error branch (only a "yes" exit, no "no") — common, but
  worth flagging
- Terminal nodes with no way back (dead-end) — normal for success,
  problematic for errors
- Branches that converge too quickly (may be losing granularity)
- Many decisions in a row with no screen between them (long decision
  chain) — may confuse the reader

**Don't fix them**. Just mention them in the summary: "FYI: I found N points
that may be worth reviewing — want the detail, or should I go ahead?"

Ask for **explicit approval** before creating files.

---

## Step 6 — Scaffold the page

Create `app/auis/ux-flow/<slug>/page.tsx` following the pattern of the
existing pages (use `app/auis/ux-flow/example/page.tsx` as reference).

Minimum structure:

```tsx
"use client"

import type { Edge, Node } from "@xyflow/react"

import { PageHero, Section } from "../../styleguide/_primitives"
import {
  branchEdge,
  edgeBase,
  FlowDiagram,
  type DecisionData,
  type ScreenData,
} from "../_components/flow-editor"
import {
  FlowUpdatesBadge,
  FlowUpdatesHistorySection,
  type FlowUpdate,
} from "../_components/flow-updates"

// Exported on purpose: the hub's inline sub-flow expansion
// (_components/flow-subflow.tsx) and the merge skill read NODES/EDGES
// straight from the page module.
export const NODES: Node[] = [
  // ... from mapped.nodes (data: ScreenData | DecisionData), WITH the hrefs filled in
]

export const EDGES: Edge[] = [
  // ... from mapped.edges
]

const updates: FlowUpdate[] = [
  // proposedUpdate from the mapper
]

export default function <PascalSlug>FlowPage() {
  return (
    <>
      <PageHero title="<meta.title>" trailing={<FlowUpdatesBadge updates={updates} />}>
        {/* meta.description as plain text */}
      </PageHero>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-10 pb-14">
        <Section id="flow" title="Flowchart" lead="...">
          <FlowDiagram flow="<slug>" nodes={NODES} edges={EDGES} height={820} />
        </Section>

        {/* optional: Section "Narrative" if narrative != null */}
        {/* optional: Section "Criteria" listing screens[].criteria */}

        <FlowUpdatesHistorySection updates={updates} />
      </div>
    </>
  )
}
```

Notes:

- Use **edgeBase** or **branchEdge** mixed into the mapper's output — the
  mapper already filled in `markerEnd` and `style`, so in the final .tsx you
  just list them.
- `FlowDiagram` needs the `flow="<slug>"` prop (the key for the suggestions
  bridge — `/api/flow-suggestions?flow=<slug>`; see `flow-editor.tsx`).
  `height` is optional (default 800).
- `NODES` and `EDGES` must be **exported**: the hub reads them from the page
  module (no separate data file). `ScreenData` = `{ step, title, href, note? }`,
  `DecisionData` = `{ step, title, question }`.
- `PageHero` renders its children as the lead text; `Section` takes `id`,
  `title` and an optional `lead`. Section ids are English (`flow`, `screens`,
  `narrative`, `criteria`).
- Add `Section`s for the narrative and the criteria **only if the narrative
  is present**. With no narrative, the page content is just the diagram +
  updates.
- **Don't invent content**: if the screen has no `purpose`, don't write prose
  out of thin air — leave the section empty or omit it.
- Optional: if other flows should be able to expand this one inline through
  an "other flow" diamond, add a loader for the slug in `LOADERS` inside
  `app/auis/ux-flow/_components/flow-subflow.tsx` (it imports the page's
  `NODES`/`EDGES`).

---

## Step 7 — Register in `flow-meta.ts`

Edit `app/auis/ux-flow/_data/flow-meta.ts` and add one entry to `FLOW_META`:

```ts
{
  slug: "<slug>",
  title: "<meta.title>",
  description: "<one sentence — meta.description, trimmed>",
  group: "<group>",
},
```

- `FlowMeta` has exactly four fields — `slug`, `title`, `description`,
  `group` — nothing else (no screen counts, no dates, no heights).
- If the group is new, append it to `FLOW_GROUPS` as well; its position is
  the order of the sections in the sidebar and the gallery.
- Do not touch `app/auis/ux-flow/navigation.ts` or `app/auis/ux-flow/page.tsx`
  — both derive from `FLOW_META`. The styleguide's `navigation.ts` is not
  involved either.
- `flow-meta.ts` must stay strings-only (no import of the flow pages), so the
  gallery bundle stays light.

---

## Step 8 — Validation

```bash
npm run typecheck
```

If it passes:

- Open `/auis/ux-flow/<slug>` on the dev server in the
  browser (usually `127.0.0.1:3000`).
- Confirm: `PageHero` with the "Updated on" badge, the diagram renders,
  clicking a screen opens its route in the side panel with the right href.
- Confirm the flow shows up in the hub sidebar (under its group) and as a
  card in the gallery at `/auis/ux-flow`.

If the user wants to see the visual diff first, **don't run `git add`** —
let them review it with `git diff` and commit when they're ready.

---

## Expected output

```md
Flow created: <meta.title>

Route: /auis/ux-flow/<slug>
Hub group: <group>
PG section: <studio|adm>

Diagram:
- <X> screens, <Y> decisions
- <Z> edges (<W> branches)
- <count>/<total> screens with a real href

Updates: 1 initial entry (import from <repo>)

Files:
- app/auis/ux-flow/<slug>/page.tsx (new)
- app/auis/ux-flow/_data/flow-meta.ts (entry added)

Validation:
- typecheck: passed
```

---

## What NOT to do

- **Don't invent hrefs.** If the user doesn't know the route, leave "#".
- **Don't combine this with merge.** If the slug exists, stop and redirect.
- **Don't try to "improve" the diagram** automatically — you create exactly
  what the `.awflow.json` describes. UX improvements are a separate
  conversation.
- **Don't translate identifiers**. `screen.id` is stable and used by the
  suggestions bridge — keep it identical to PG's.
- **Don't create a separate `screens.ts`, `narrative.ts` or `flow-data.ts`
  file**. Everything inline in `page.tsx`, the hub pattern.
- **Don't add fields to `FlowMeta`.** No `screens`, `updatedAt`, `height` or
  similar — the shape is the four strings; counts and dates live in the page
  (`updates[]`), not in the metadata.
- **Don't add new tokens**. Reuse the existing ones (`var(--au-*)`,
  `var(--border-*)`, etc.). If a token is missing for a case, ask for the
  design system to be adjusted first.
