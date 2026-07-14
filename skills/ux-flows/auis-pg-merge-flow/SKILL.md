---
name: auis-pg-merge-flow
description: >
  Merges a `.awflow.json` (exported from the PG repo) with a flow that
  already exists at `/auis/styleguide/ux-flows/[slug]`. Reads the
  file, compares it against the page's current `NODES`/`EDGES`, generates
  a readable diff, analyzes the UX viability of each change, asks for
  selective approval, and applies it. Always records an entry in
  `updates[]` when there is a structural change. Use when the user says
  "merge the PG flow", "update the flow with the .awflow", "apply the
  design changes to flow X", "diff between the local flow and the PG one",
  or attaches a `.awflow.json` whose slug already exists in `ux-flows/`. Do
  NOT use when the flow does not yet exist locally — for that case, use
  `auis-pg-create-flow`.
---

# Auis PG — Merge `.awflow.json` into existing flow

Compares a PG export against the corresponding local flow, shows the delta,
classifies each change (structural vs cosmetic vs problematic in UX terms)
and applies it selectively under approval. Adds the changelog entry when
there is a structural change.

## Prerequisites

- `app/auis/styleguide/ux-flows/_lib/awflow-import.ts` exists.
- The target flow already exists at `app/auis/styleguide/ux-flows/<slug>/page.tsx`.
- If it doesn't exist, stop and redirect to
  [`auis-pg-create-flow`](../auis-pg-create-flow/SKILL.md).

---

## Step 1 — Load the file + the local flow

1. Load the `.awflow.json` (path, pasted content, or attachment) and
   parse it via `parseAuFlowFile`. Stop on error.
2. Resolve the local slug:
   - default: `file.flow.id`
   - if the user uses a different slug (e.g. PG `login` → local
     `login-auth`), confirm it.
3. Read the local flow's `page.tsx` and extract `NODES` and `EDGES`
   (parse the array literal by hand — don't try to execute the file).

---

## Step 2 — Compute the diff

Compare by `id` (nodes) and by `from+to+label` (edges, since edges have no
stable id in PG nor in the local styleguide).

### Node diff

| Change | Detection | Classification |
|---|---|---|
| Node added | id exists in the .awflow but not locally | `new-page` |
| Node removed | id exists locally but not in the .awflow | `removed-page` |
| `kind` changed (screen ↔ decision) | same id, different kinds | `flow-rework` |
| `title` changed | same id, same kinds, different titles | cosmetic (not logged) |
| `position` changed | same id, same kinds and titles, different positions | cosmetic (not logged) |
| `note`/`question` changed | textual | cosmetic (not logged) |

### Edge diff

| Change | Detection | Classification |
|---|---|---|
| Edge added | (from,to,label) is new | `new-branch` if `branch=true`, otherwise `flow-rework` |
| Edge removed | (from,to,label) is gone | `flow-rework` |
| Edge reroute | same from, new target or new label | `flow-rework` |

### Result

Produce a structure like this before showing it to the user:

```ts
{
  added: { nodes: AuFlowNode[]; edges: AuFlowEdge[] },
  removed: { nodes: LocalNode[]; edges: LocalEdge[] },
  changed: {
    nodes: Array<{ id, kind, title, fields: string[] }>,
    edges: Array<{ from, to, fields: string[] }>,
  },
}
```

Where `fields` lists what changed (e.g. `["title", "note"]`).

---

## Step 3 — UX viability analysis

For **each item** in the diff, classify:

- 🟢 **Safe** — clear structural change, no side effects (e.g. a new
  decision with symmetric branches).
- 🟡 **Review** — worth the user looking first (e.g. a removed screen that
  was terminal, a flow that lost its way back, a decision with no error
  branch, a new branch that diverges a lot from the local pattern).
- 🔴 **Block** — blocks until justified (e.g. removes a screen that has open
  suggestions in the flow-bridge, an edge points at a nonexistent node, the
  new flow ends on a decision with no terminal).

**Don't invent rules** — use common sense. When in doubt, mark it 🟡.

---

## Step 4 — Present the diff + analysis

Show the user a compact summary:

```
Diff: <slug> (local) vs <PG repo>

Screens:
  + 3 new:
    🟢 sso-connecting — "Connecting to the IdP" (SSO · screen)
    🟢 2fa-backup    — "Backup codes" (screen)
    🟡 sem-acesso    — "No access via this method" (terminal, no way back)
  - 1 removed:
    🟡 erro-generico — was linked to [email, password]; orphan afterwards

Decisions:
  + 1 new:
    🟢 dec-auth-compat — "Org compatible w/ method?" (filters anti-enumeration)
  ~ 1 changed:
    🟢 dec-multiorg — question changed from "1 org?" to "1+ compatible org?"

Edges:
  + 5 new (3 amber branches)
  - 2 removed (1 was a branch)
  ~ 4 rerouted

Analysis:
  🔴 0
  🟡 2 (worth reviewing)
  🟢 everything else

Changelog tags: ["new-page", "new-branch", "flow-rework"]
```

---

## Step 5 — Selective approval

Ask the user:

1. **Apply everything** (all deltas, ignores 🟡 — only 🔴 blocks)
2. **Apply only the safe ones** (🟢) and list the 🟡 manually
3. **Review item by item** — iterate, and for each delta ask
   "apply / skip / abort"
4. **Abort** — change nothing

If there is any 🔴, **apply none of them** until the user resolves it.

When applying partially, make a mental commit of the approved set and move
on.

---

## Step 6 — Apply it to `page.tsx`

Edit `NODES` and `EDGES` in the flow's file:

- Add new nodes/edges respecting the existing pattern (`edgeBase`,
  `branchEdge`, `sourceHandle` on decisions).
- Remove the nodes that are gone + the orphan edges attached to them.
- Update textual fields when approved (title/note/question).
- **Preserve the existing nodes' `href`** — PG doesn't have that info, so
  don't overwrite what is already local. For NEW screens, ask for the href
  the same way the `auis-pg-create-flow` skill does in Step 4.
- Update the `position` when approved — don't touch layout without the user
  confirming (geometry decisions are expensive to redo).

---

## Step 7 — Add an entry to `updates[]`

If there was a structural change (any of the tags `new-page`,
`removed-page`, `new-branch`, `flow-rework`, `integration` applies), add
**a single entry** at the top of `updates`:

```ts
{
  date: "<YYYY-MM-DD today>",
  summary: "<single sentence, ≤140 chars, describing the set>",
  tags: [...],
}
```

The summary is ONE sentence describing the set, not item-by-item. E.g.:

- "SSO got a fast-lane via HRD and a new compatibility gate per auth
  method (anti-enumeration)."
- "Generic error screen removed; every decision now has its own error
  path."

If the page does **not yet have** the updates scaffolding (import,
`const updates`, badge + history section render), add it following what the
`auis-update-ux-flow` skill describes in Step 4.

---

## Step 8 — Validation

```bash
npm run typecheck
```

Visual:

- The "Updated on <date>" badge updated.
- The "Update history" section lists the new entry at the top
  with the correct tags (colored pills).
- The diagram reflects the new structure.
- The cards of the new screens show the right href.

For every screen that was 🟡 or 🔴, offer a preview with extra care.

---

## Expected output

```md
Flow updated: <meta.title>

Route: /auis/styleguide/ux-flows/<slug>

Applied:
  + N nodes / + N edges
  - N nodes / - N edges
  ~ N textual changes

Skipped (🟡 not approved): N
Blocked (🔴): N

Tags: [new-page, new-branch, ...]
Summary: <line recorded in the changelog>

Files:
- app/auis/styleguide/ux-flows/<slug>/page.tsx — NODES/EDGES + updates

Validation:
- typecheck: passed
```

---

## What NOT to do

- **Don't overwrite the screens' existing `href`.** PG doesn't have that
  info — keep what is already in the local flow.
- **Don't run the merge automatically**. Always ask for approval, even when
  everything is 🟢.
- **Don't paste the `.awflow` narrative/screens specs into comments in
  page.tsx** — that data stays available for the skill to read when it needs
  it (from the JSON), but `page.tsx` stays lean.
- **Don't delete previous updates.** Only prepend; never rewrite history.
- **Don't combine this with create.** If the flow doesn't exist, it's
  `auis-pg-create-flow`.
- **Don't try to "merge" flow-bridge comments.** That's another domain —
  open suggestions in the bridge must be resolved separately via
  `auis-flow-bridge-solve`, before or after this merge.
