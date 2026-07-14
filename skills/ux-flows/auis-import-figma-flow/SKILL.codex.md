---
name: auis-import-figma-flow
description: >
  Imports a Figma flow as a screen-by-screen navigable PROJECT under
  `/auis/projects` — enumerates the frames via the Figma MCP,
  renders each screen as a screenshot (.webp in /public), generates the
  typed manifest in `app/auis/projects/_data/projects.ts`, and
  activates the "Projects" card on the hub. The screens become cards with
  the "Restyle with the design system" and "Build in repo" buttons. Use
  when the user asks to "import a Figma flow", "create a project from
  Figma", "import Onboarding / Checkout", "bring the Figma screens
  into the repo", or pastes a figma.com URL with the intent of importing it
  as a project. Do NOT use for `.awflow.json` → ReactFlow diagram (that is
  `auis-pg-create-flow`): here the source is a Figma URL and the output is
  SCREENSHOTS-as-a-project, not a node diagram.
---

# Auis — Import a Figma flow as a project

Brings an entire Figma flow into the `/auis/projects` workbench: each
screen = one frame rendered as a screenshot, navigable screen by screen, with
per-screen actions. The design in Figma is usually on an **old design
system** — the screenshot is only a visual reference; the re-skin/build always
remaps to the current Au* tokens and components (see
[`auis-project-build-solve`](../auis-project-build-solve/SKILL.md)).

## Prerequisites

- Figma MCP authenticated — confirm with `whoami` (`mcp__figma__whoami`).
- The file has to be in the **Figma cloud** (the MCP can't read a local
  `.fig`). If the user only has the `.fig`, ask them to open/upload it in
  Figma and send the share URL. The `.fig` is a ZIP with `canvas.fig` in the
  kiwi format (binary, unstable) — not worth parsing; the robust route is the
  URL.
- `cwebp` available (`which cwebp`) to compress the screenshots. Without it,
  fall back to PNG (heavier) or stop and say so.
- `app/auis/projects/_data/projects.ts` exists with the `Project` type.
  If it doesn't, something is out of place — stop and say so.

---

## Step 1 — Parse the URL and define the project

From the URL `figma.com/design/:fileKey/:nome?node-id=:a-:b`:
- `fileKey` = first segment.
- `nodeId` = `node-id` with `-` → `:` (e.g. `929-29942` → `929:29942`).

⚠️ The node-id the user copies usually points at a loose element (a
component, not the flow's page). Confirm it is the flow's **page/section** in
Step 2. `get_metadata(fileKey)` WITHOUT a nodeId lists pages, but it may come
back incomplete — always prefer the flow's node-id directly.

Ask for (or infer) the project's `slug` + `title` (e.g. `onboarding` /
"Onboarding"). The slug must not collide with `built` nor with an existing
slug in `PROJECTS`.

---

## Step 2 — Enumerate the screens

`get_metadata(fileKey, nodeId)` on the flow's node. The subtree is large →
it usually exceeds the limit and gets saved to a file. Parse that file
(JSON `[{type,text}]` with XML inside) with Python:

```python
import json, xml.etree.ElementTree as ET
data = json.loads(open(PATH, encoding="utf-8").read())
xml = "".join(p.get("text","") for p in data if p.get("text","").lstrip().startswith("<"))
root = ET.fromstring("<root>"+xml+"</root>")
```

- The **sections** (`<section>`) are the flow's groupers.
- The **screens** are the child `<frame>`s with a screen size (in Memory
  Base, 1920×1080 — adjust the filter to the size of the file at hand).
- The frame's name usually carries the order embedded: `... | Tela NN | Área | NN`.
  Derive `step` ("Tela NN"), `section` (the `<section>`'s name), `name`
  (clean label, e.g. "Homepage 01"), and `order` (flow order:
  step → section → number).

**Count and CONFIRM with the user before the bulk download** (e.g. "That's
73 screens across 16 sections, ~1.5 MB in .webp — do I go with all of them,
or a subset of the sections?"). Allow a subset.

---

## Step 3 — Render and download each screen

Create `public/projects/<slug>/`. For each frame:

1. `get_screenshot(fileKey, frameNodeId, maxDimension=1280)` → returns an
   ephemeral `image_url` + `width`/`height`.
2. Download it and convert to webp. Do it in **batches** (~12-14 concurrent
   `get_screenshot` calls per message, then a `Bash` that downloads the batch
   — the URLs are short-lived, download them right away):

```bash
B="https://www.figma.com/api/mcp/asset"
dl(){ curl -fsS -o /tmp/_dl.png "$B/$2" && cwebp -quiet -q 82 /tmp/_dl.png -o "$1.webp" && echo "ok $1" || echo "FAIL $1"; }
dl <id> <asset-uuid>   # id = nodeId with ":" -> "-"
```

The `id` (= `figmaNodeId` with `:`→`-`) is the file name AND the screen's key
in the manifest. Never persist Figma's `image_url` (ephemeral).

---

## Step 4 — Generate the manifest

Write the `Project` entry (with `screens[]`, all `status:"imported"`) in
`app/auis/projects/_data/projects.ts`. Generate it by script so it stays
deterministic — a `(nodeId, name, step, section)` table in flow order, and the
script computes `id`, `order`, `thumbnail` (`/projects/<slug>/<id>.webp`),
`w/h`. Replace `export const PROJECTS: Project[] = []` (or append to the array
if there are already projects). Project fields: `figmaFileKey`, `figmaNodeId`,
`figmaUrl`, `importedAt`, `updatedAt`.

Then **verify** that every `thumbnail` in the manifest has a matching `.webp`
and that there are no orphans.

---

## Step 5 — Activate the hub card

In `app/auis/page.tsx`, the "Projects" item must be
`status: "ready"` (idempotent — if it already is, skip). That's what swaps
"Unavailable" for "Open".

---

## Step 6 — Validation

```bash
npm run typecheck
```

The LAN dev server usually already runs on `:3000` — **don't start
a second one** (Next 16 blocks it). Check over HTTP (or ask the user to open
it in their own browser):

- `/auis` → Projects card active (link `/auis/projects`).
- `/auis/projects` → the project's card with "<N> screens".
- `/auis/projects/<slug>` → screens grouped by section (check the count of
  section blocks) + screenshots loading.
- `GET /projects/<slug>/<id>.webp` → 200 `image/webp`.

**Don't commit** — leave the `git diff` to the user.

---

## Expected output

```md
Project imported: <title>
Route: /auis/projects/<slug>
Screens: <N> across <S> sections · <size> in .webp
Source: figma.com/design/<fileKey> (node <figmaNodeId>)

Files:
- app/auis/projects/_data/projects.ts (project entry)
- public/projects/<slug>/*.webp (<N> screenshots)
- app/auis/page.tsx (card "Projects" -> ready, if it is the 1st project)

Validation: typecheck passed · routes 200
```

---

## What NOT to do

- **Don't hotlink** Figma's `image_url` — it's ephemeral; always download it.
- **Don't parse the local `.fig`** — unstable kiwi format; use the URL.
- **Don't build/re-skin screens here** — the import only renders +
  manifests. Building is `auis-project-build-solve`.
- **Don't rename ids** — `id`/`figmaNodeId` are stable keys (file, store,
  builtRoute). Keep Figma's `nodeId`.
- **Don't create new tokens** (`AGENTS.md` rule).
- **Don't use the slug `built`** (it collides with the route of the built
  screens).
- **Don't commit.**
