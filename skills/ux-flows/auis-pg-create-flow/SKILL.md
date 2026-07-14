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
  "import a flow from PG", "create a flow from the .awflow", "new flow
  from design", "scaffold the .awflow.json", or attaches/points to an
  `.awflow.json` file to create a brand-new flow. Do NOT use when the
  slug already exists in `ux-flows/` — for that case, use
  `auis-pg-merge-flow`.
---

# Auis PG — Create flow from `.awflow.json`

Creates a new flow in the styleguide from the designer's (PG) export. The
`.awflow.json` file carries the diagram (nodes + edges) and the screens'
specs (purpose, scenarios, criteria). This skill does **not** merge — if the
flow already exists, redirect to [`auis-pg-merge-flow`](../auis-pg-merge-flow/SKILL.md).

## Prerequisites

- `app/auis/styleguide/ux-flows/_lib/awflow-import.ts` exists in the
  repo (the importer module). If it doesn't, stop and tell the user —
  something is out of place.
- There is at least one reference flow in `ux-flows/login-auth/` or
  `ux-flows/primeiro-acesso/` to copy the page pattern from.

---

## Step 1 — Locate and validate the file

The user provides the `.awflow.json` in one of these ways:

1. **Local path** — "use /Users/.../login.awflow.json"
2. **Pasted content** — JSON in the chat itself
3. **Attached in Claude** — file visible in the conversation

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

- The default is `file.flow.id` (e.g. `"login"`, `"pa-responsavel"`).
- The styleguide in my repo uses its own slugs — e.g. the PG flow `login`
  may become `login-auth` here. List the existing flows in
  `app/auis/styleguide/ux-flows/` and ask the user whether they
  want the PG slug or another one.
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
   "login" screen → `/login`, `/`, `/entrar`).
3. Ask the user; accept the literal value, "#" (placeholder), or
   "skip" (leaves "#").

**Don't ask one by one if there are more than 6 screens** — present them all
at once (numbered list) and ask the user to answer in batch. Reduce friction.

---

## Step 5 — Summary + light UX analysis

Before creating files, show a plan:

```
New flow: <meta.title>
Slug: ux-flows/<slug>
Section: <meta.section>

Diagram:
- <X> screens, <Y> decisions
- <Z> edges (<W> branches)

Screens with a real href: <count>/<total>
Screens with href "#" (placeholder): <count>

Narrative: <persona summary, if any>

Initial updates: 1 entry ("Structure imported from [repo] on [date]")
```

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

Create `app/auis/styleguide/ux-flows/<slug>/page.tsx` following the
pattern of the existing pages (use `login-auth/page.tsx` or
`primeiro-acesso/page.tsx` as reference).

Minimum structure:

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
  // ... from mapped.nodes, WITH the hrefs filled in
]

const EDGES: Edge[] = [
  // ... from mapped.edges
]

const updates: FlowUpdate[] = [
  // proposedUpdate from the mapper
]

export default function Page() {
  return (
    <main>
      <PageHero
        title="<meta.title>"
        trailing={<FlowUpdatesBadge updates={updates} />}
      >
        <p>{/* meta.description in markdown */}</p>
      </PageHero>

      <Section id="diagrama" title="Diagram" lead="...">
        <FlowDiagram flow="<slug>" nodes={NODES} edges={EDGES} />
      </Section>

      {/* optional: Section "Narrative" if narrative != null */}
      {/* optional: Section "Criteria" listing screens[].criteria */}

      <FlowUpdatesHistorySection updates={updates} />
    </main>
  )
}
```

Notes:

- Use **edgeBase** or **branchEdge** mixed into the mapper's output — the
  mapper already filled in `markerEnd` and `style`, so in the final .tsx you
  just list them.
- `FlowDiagram` needs the `flow="<slug>"` prop (the key for the suggestions
  bridge — see `flow-editor.tsx`).
- Add `Section`s for the narrative and the criteria **only if the narrative
  is present**. With no narrative, the page content is just the diagram +
  updates.
- **Don't invent content**: if the screen has no `purpose`, don't write prose
  out of thin air — leave the section empty or omit it.

---

## Step 7 — Register in `navigation.ts`

Edit `app/auis/styleguide/navigation.ts`. Add it under the "UX
Flows" section (or the appropriate section if it is `section: "adm"`):

```ts
{
  name: "<meta.title>",
  href: "/auis/styleguide/ux-flows/<slug>",
}
```

Keep alphabetical order within the section when possible.

---

## Step 8 — Validation

```bash
npm run typecheck
```

If it passes:

- Open `http://localhost:3000/auis/styleguide/ux-flows/<slug>` in the
  browser (usually `127.0.0.1:3000`).
- Confirm: PageHero with the "Atualizado em" badge, the diagram renders,
  the screen cards carry the right href.
- Confirm the link shows up in the styleguide sidebar.

If the user wants to see the visual diff first, **don't run `git add`** —
let them review it with `git diff` and commit when they're ready.

---

## Expected output

```md
Flow created: <meta.title>

Route: /auis/styleguide/ux-flows/<slug>
Section: <studio|adm>

Diagram:
- <X> screens, <Y> decisions
- <Z> edges (<W> branches)
- <count>/<total> screens with a real href

Updates: 1 initial entry (import from <repo>)

Files:
- app/auis/styleguide/ux-flows/<slug>/page.tsx (new)
- app/auis/styleguide/navigation.ts (entry added)

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
- **Don't create a separate `screens.ts` or `narrative.ts` file**. Everything
  inline in `page.tsx`, the styleguide pattern.
- **Don't add new tokens**. Reuse the existing ones (`var(--au-*)`,
  `var(--border-*)`, etc.). If a token is missing for a case, ask for the
  design system to be adjusted first.
