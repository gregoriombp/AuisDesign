---
name: auis-project-build-solve
description: >
  Fulfills, in bulk, the per-screen action requests from the
  `/auis/projects` workbench — the "Restyle with the design system"
  button (kind `restyle`) and the "Build in repo" button (kind
  `build`) write requests to `/api/project-builds` (stored in
  `flow-bridge/data/project-builds.json`). This skill reads the requests
  (with a filter), MAKES A PLAN and waits for approval, then: for
  `build`, rebuilds the screen as a real page using Au* components and
  current tokens (backed by `auis-new-page`), using Figma's
  `get_design_context` as reference; for `restyle`, produces a preview in
  the current DS. It stamps each request `in_review`/`apply` with
  `actor {kind:"agent",id:"claude",name:"Claude"}` + `builtRoute`, and
  updates the manifest. Use when the user asks to "resolve the project
  builds", "build the requested screens", "apply the requests for a
  project", or "take the build requests and resolve them". Do NOT use it
  for importing (that is `auis-import-figma-flow`) nor for UX Flow
  suggestions (that is `auis-flow-bridge-solve`).
---

# Auis — Resolve the projects' build/restyle requests

The screen cards in `/auis/projects/<slug>` have two buttons that write
requests via `POST /api/project-builds`. This skill consumes that queue
and fulfills the requests — always with a **plan + approval before touching
code**, in the same spirit as
[`auis-review-bridge-solve`](../auis-review-bridge-solve/SKILL.md).

## Prerequisites

- Local dev server up (`127.0.0.1:3000`) to talk to the API. **Don't start a
  second one** (Next 16 blocks it).
- `app/api/project-builds/` (store + routes) and the manifest
  `app/auis/projects/_data/projects.ts` exist.

---

## Step 1 — Read the queue

`GET /api/project-builds` with the filter the user asked for:
`?projectSlug=&screenId=&kind=&status=`. Default: `status=open`.

```bash
curl -s "http://localhost:3000/api/project-builds?projectSlug=<slug>&status=open" | python3 -m json.tool
```

Each request carries `kind` (`restyle`|`build`), `screenId`, `screenName`,
`figmaFileKey`, `figmaNodeId`, `thumbnail`, `note?`. If the queue is
empty, say so and stop.

---

## Step 2 — Plan (before any code)

For each request, write one line in the plan:
- the screen (`screenName` + `figmaNodeId`), the `kind`, and what will be done.
- for `build`: the destination route (see Step 4) and the Au* components you
  intend to use.

Show the plan and **wait for explicit approval**. If a request is
ambiguous, flag it to ask about (you may answer with a question instead of
acting).

---

## Step 3 — Screen reference (Figma)

For each screen you're handling, pull the structure as a REFERENCE (not the
source of truth): `get_design_context(figmaFileKey, figmaNodeId)`. Also look at
the screenshot already imported at `public/projects/<slug>/<screenId>.webp`.
The design comes from the **old DS** — you re-map the intent (layout,
hierarchy, copy) onto the current Au* tokens and components. Follow
[`auis-new-page`](../auis-new-page/SKILL.md) to assemble the
page (component lookup: Au* → shadcn → custom; tokens are sacred).

---

## Step 4 — Build (`build`) or re-skin (`restyle`)

**`build`** — a real, routable page:
- Route: `app/auis/projects/built/<slug>/<screenId-or-name>/page.tsx`.
  Use the static `built/` segment — it does **not** collide with the
  `projects/[slug]` route (as long as no project has the slug `built`).
  ⚠️ Do NOT create a folder named after the project's slug under `projects/`:
  that shadows the `[slug]` viewer.
- `builtRoute` = `/auis/projects/built/<slug>/<...>`.
- Compose with Au* (e.g. a project's welcome screen uses
  `AuLogo` + `AuButton`). Include a context bar at the top
  ("Rebuilt from <step · name>", a link back to the project, an
  "Original in Figma" link). Desktop-only screen.

**`restyle`** — a re-skin preview in the current DS (it doesn't necessarily
become a product route). Treat it as a lighter/partial `build`, or a
side-by-side preview, depending on the request.

---

## Step 5 — Transition the request + update the manifest

1. (Optional) `PUT /api/project-builds/<id>` `{transition:"in_review",
   actor:{kind:"agent",id:"claude",name:"Claude"}}` when you start.
2. On completion: `PUT .../<id>` `{transition:"apply",
   actor:{kind:"agent",id:"claude",name:"Claude"}, builtRoute:"<route>"}`.
   That stamps the resolution and archives the request.
3. **Update the manifest** (`_data/projects.ts`) on the matching screen:
   `status: "built"` (or `"restyled"`) + `builtRoute`. The manifest is the
   durable state; the API is only the queue. The manifest is what makes the
   card show the "In repo" pill + "View in repo".

If the user rejects it later, they resolve it from the inbox/`discard` — don't
undo it automatically.

---

## Step 6 — Validation

```bash
npm run typecheck
```

Confirm over HTTP: the `builtRoute` answers 200, and the screen's card in the
viewer now shows the "In repo" pill linking to it. **Don't commit.**

---

## Expected output

```md
Requests resolved: <N> (<builds> build · <restyles> restyle)

Per screen:
- <screenName> [<kind>] -> <builtRoute> (status: applied)

Files:
- app/auis/projects/built/<slug>/<...>/page.tsx (new)
- app/auis/projects/_data/projects.ts (status/builtRoute)

Store: <N> requests in applied (archived)
Validation: typecheck passed · routes 200
```

---

## What NOT to do

- **Don't touch code before the plan is approved.**
- **Don't create a `projects/<slug>/` folder** for built screens — it shadows
  the `[slug]` viewer. Always use `projects/built/<slug>/...`.
- **Don't invent tokens** and don't use arbitrary color/spacing values — only
  Au* + existing tokens (`AGENTS.md`).
- **Don't copy the old DS pixel for pixel** — re-map it to the current DS; the
  screenshot is a reference for intent, not for style.
- **Don't hand-edit the manifest AND the store to "force" a state** — the
  flow is: the API archives the request (apply) + the skill writes the
  manifest.
- **Don't commit.**
