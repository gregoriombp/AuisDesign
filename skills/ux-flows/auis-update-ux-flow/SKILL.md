---
name: auis-update-ux-flow
description: >
  Registers a structural update to an existing UX flow page in the Auis
  styleguide (`/auis/styleguide/ux-flows/[slug]`). Applies the requested
  change to the ReactFlow diagram (new screen, new branch, removed node,
  rework) and adds an entry to that flow's `updates` array so the page shows
  an "Atualizado em" badge plus a "Histórico de atualizações" section. Use
  when the user asks to "update flow X", "log an update on the flow", "add a
  page to the flow", "new branch on the flow", says "the flow's dynamic
  changed", "remove a screen from the flow", or hands over a meeting decision
  that changes an existing flow. NOT for creating a new flow from scratch —
  for that, use `auis-create-ux-flow`. NOT for tweaking copy or styling of an
  existing flow page — that's a normal edit, no changelog.
---

# Auis — UX Flow Update Logger

Apply a **structural** change to an existing UX flow page and record it in
the page's `updates` array so the styleguide visibly tracks meaningful
changes over time.

If the flow does **not exist yet**, stop and route the user to
[`auis-create-ux-flow`](../auis-create-ux-flow/SKILL.md).

---

## What counts as a "meaningful" update

This is the most important part of the skill. The `updates` log is **not** a
git history — it only carries changes a designer/PM would want flagged when
returning to the page weeks later.

| Change | Logged? | Tag |
|---|---|---|
| New `ScreenNode` or `DecisionNode` added | **yes** | `new-page` |
| Node removed from the flow | **yes** | `removed-page` |
| New branch (new edge leaving a `DecisionNode`) | **yes** | `new-branch` |
| New `CrossFlowNode` (jump to another flow) | **yes** | `flow-rework` |
| Branches reordered or rerouted so the perceived sequence changes | **yes** | `flow-rework` |
| `ScreenNode` becomes `DecisionNode` (or vice-versa) | **yes** | `flow-rework` |
| New external integration relevant to the flow (magic-link, OAuth provider, etc.) | **yes** | `integration` |
| Only `data.label` / `data.note` / `data.question` text changed | **no** | — |
| Only node position / color / styling changed | **no** | — |
| Node `id` renamed but connections unchanged | **no** | — |

**Borderline cases** (e.g. small copy that changes the flow's intent):
ask the user once before logging. Default to **not logging** when unsure.

If the user's request maps to a "no" row above, refuse politely and tell
them to edit the page directly — do not create a changelog entry.

---

## Step 1 — Identify the flow

Inputs you need from the user:

- **Slug** — folder name under `app/auis/styleguide/ux-flows/`. If the
  user gives a friendly name ("first access"), resolve it by listing
  existing flows and matching.
- **Change description** — one sentence describing the structural
  delta. Examples:
  - "New 'link expired' screen on the invite branch when the e-mail is over 10 days old."
  - "Magic-link replaces the temporary password on first login."
  - "Welcome screen removed — the flow now goes straight to the dashboard."
- **Date** — default to today (`YYYY-MM-DD`). The user can override.
- **Optional graph changes** — exact node/edge additions, removals, or
  rewires. If not given, infer from the description and confirm before
  editing the page.

If the flow page does not exist, stop and route to
`auis-create-ux-flow`.

---

## Step 2 — Classify

Apply the table above to the requested change. If it lands in a "no" row,
**stop and explain** why no changelog entry will be created. Offer to make
the edit directly without logging.

Pick the matching tag(s) — one update entry can carry multiple tags
(e.g. `["new-page", "new-branch"]` when a new screen also introduces a new
decision exit).

---

## Step 3 — Apply graph changes

Open `app/auis/styleguide/ux-flows/[slug]/page.tsx` and edit the
`NODES` and `EDGES` arrays to reflect the new structure.

Rules that mirror `auis-create-ux-flow`:

- Reuse the `screen` / `decision` / `crossflow` node types from the shared
  `<FlowDiagram>` (imported from `../_components/flow-editor`) — never
  redefine or invent new node types in the page. A `crossflow` node marks a
  jump to ANOTHER ux-flow: `title` = destination flow name, `href` =
  `/auis/styleguide/ux-flows/[other-slug]` (details in
  `auis-create-ux-flow` Step 3).
- Keep the column geometry consistent (see `auis-create-ux-flow`
  Step 2). If the new node sits off the main column, add a documented X
  constant (e.g. `EXPIRADO_X = 560`).
- Always specify `sourceHandle` on edges leaving a decision node.
- Use `edgeBase` for main-flow edges, `branchEdge` for decision exits, `crossEdge` for edges touching a `crossflow` node.
- Label every decision exit with the choice ("Yes", "No", "Pix", etc.).
- Update the `Y` table if you insert a new row.
- Update the container `height` if the diagram grew.
- For any new `screen` node, fill `href` with the real internal route
  whenever a prototype exists — clicking the card opens it in the side
  drawer. Only use `#` when no prototype is built yet.
- Update the `screens` array (Section 3 of the page) when adding/removing a
  documented screen. Sub-branch variants that don't get their own doc entry
  in the original page also don't need one now.
- Update the "Design decisions" section only when the rationale changes.

---

## Step 4 — Add the `updates` entry

### 4a — Ensure scaffolding exists

If the page does **not yet** have updates wiring (first time the skill
touches this flow), add three things:

1. Import at the top of `page.tsx`:

   ```tsx
   import {
     FlowUpdatesBadge,
     FlowUpdatesHistorySection,
     type FlowUpdate,
   } from "../_components/flow-updates"
   ```

2. `const updates` declaration just above the page component:

   ```ts
   const updates: FlowUpdate[] = []
   ```

3. Render the badge and the history section. The badge goes in the
   `PageHero` `trailing` slot; the history section goes **last** inside the
   main column, after the existing sections:

   ```tsx
   <PageHero
     title="[Flow name]"
     trailing={<FlowUpdatesBadge updates={updates} />}
   >
     ...
   </PageHero>

   {/* ...existing sections... */}

   <FlowUpdatesHistorySection updates={updates} />
   ```

Both `FlowUpdatesBadge` and `FlowUpdatesHistorySection` return `null` when
`updates` is empty — safe to render unconditionally. If `PageHero` in this
file does not yet support `trailing`, check `_primitives.tsx` — the prop is
in place since 2026-05.

### 4b — Prepend the entry

`updates` is ordered most-recent-first. Prepend the new entry:

```ts
const updates: FlowUpdate[] = [
  {
    date: "2026-05-22",
    summary: "New 'link expired' screen on the invite branch when the e-mail is over 10 days old.",
    tags: ["new-page", "new-branch"],
  },
  // ...older entries below, untouched...
]
```

Rules for `summary`:

- One sentence, ≤ 140 characters.
- Describe **what changed in the flow**, not what changed in the code (no
  "added node X with id Y").
- Avoid trailing tech jargon — readers are designers and PMs.

---

## Step 5 — Validate

```bash
npm run typecheck
```

If the local dev server is running, open the page and confirm:

- The "Atualizado em <data>" badge appears next to the title.
- The "Histórico de atualizações" section renders at the bottom with the
  new entry on top.
- Tags render with their distinct pill colors (`new-page` blue, `new-branch`
  amber, `removed-page` red, `flow-rework` amber, `integration` emerald).
- The diagram reflects the structural change.

---

## What NOT to do

- Do **not** create a separate `updates.ts` file per flow — the array lives
  inline in `page.tsx`. One file per flow stays the convention.
- Do **not** log non-structural changes. If the user asks to "log" a text
  tweak, refuse and explain.
- Do **not** rewrite past entries. They are append-only history — only
  prepend.
- Do **not** rename existing node ids when the only goal is "cleanup". That
  risks breaking the visual diff for readers tracking the flow's evolution.
- Do **not** add an `updates` array to a flow page just to "prepare" it
  without a real change to log — the scaffolding only goes in when the
  first entry is created.

---

## Quick checklist before finishing

- [ ] Change is genuinely structural (matches a "yes" row in the table)
- [ ] Graph (`NODES`/`EDGES`) reflects the change
- [ ] `Y` table and container `height` updated if a row was added
- [ ] `screens` array updated if a documented screen was added/removed
- [ ] `updates` array exists with import + render wiring
- [ ] New entry prepended with `{ date, summary, tags }`
- [ ] `summary` ≤ 140 chars, design-oriented language
- [ ] `npm run typecheck` passes

---

## Output to return

```md
Updated UX flow: [Flow name]

Route: /auis/styleguide/ux-flows/[slug]

Change: [one-line summary the user gave]
Tags: [list]

Graph diff:
- [+/-] [node / edge changes in plain language]

Files changed:
- app/auis/styleguide/ux-flows/[slug]/page.tsx — graph + updates entry

Validation:
- typecheck — passed / failed
```
