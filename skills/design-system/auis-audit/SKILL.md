---
name: auis-audit
description: >
  Scans a folder, file, or whole repository and reports every component that's
  used or implemented but missing from /auis/styleguide. Catches app
  components, shadcn/ui primitives, wrapped components, and page-local
  components, then either reports gaps, creates missing playground stubs, or
  creates stubs and updates navigation. Use whenever the user asks to "audit
  styleguide", "check coverage", "find missing components", "what's not in
  the styleguide", "components not registered", "compare repo to design
  system", "styleguide gaps", or wants to verify that every component used
  in the app is documented in Auis/styleguide.
---

# Auis — Styleguide Coverage Audit

Scan a target (folder, file, or whole repo) and report every component that's
used or implemented but missing from Auis/styleguide. Either report only,
or create missing stubs, or create stubs and update navigation.

> This is a **coverage check**, not a refactor. The audit never deletes or
> renames components.

## Input

```txt
Target to scan: [FOLDER OR FILE PATH]
Target project: [PROJECT PATH OR CURRENT REPOSITORY]
Styleguide path: [/auis/styleguide OR CUSTOM PATH]
App styleguide route: [/app/auis/styleguide OR CUSTOM PATH]
Mode: [report only | create missing stubs | create missing stubs and update navigation]
```

Optional:

```txt
Include playground as covered: [yes | no]   # default: yes
Ignore paths: [node_modules, .next, dist, build, generated, etc.]
```

## Goal

Make sure every component imported, implemented, or used in the target has a
corresponding entry in Auis/styleguide. The audit catches:

- app components
- shadcn/ui components
- wrapped shadcn components
- page-local reusable components
- imports from `@/components/*`
- imports from `@/components/ui/*`
- components found in scanned components folders

## Non-negotiables

- shadcn/ui stays the primitive layer.
- The canonical namespace is `Auis/styleguide`.
- Repository styleguide source defaults to `/auis/styleguide`.
- Next.js route showcases default to `/app/auis/styleguide`.
- Do **not** use `/app/styleguide`.
- The audit never deletes or renames components.

## Workflow

### 1. Inspect project paths

Resolve:

- repository root
- the scan target (the user-specified folder or file)
- `/auis/styleguide/components`
- `/auis/styleguide/playground/components`
- `/app/auis/styleguide/components`
- navigation and registry files
- aliases from `tsconfig.json`, `jsconfig.json`, and `components.json`

### 2. Build a component inventory from the target

Scan the target for:

- component files: `.tsx`, `.jsx`, `.ts`, `.js`
- exported React components
- default exports with PascalCase names
- imports from `@/components/ui/*`
- imports from `@/components/*`
- relative imports that resolve to component files

Ignore (unless explicitly requested):

- `node_modules`
- `.next`
- `dist`
- `build`
- `out`
- coverage folders
- test fixtures
- generated files

Normalize names:

- `button.tsx` → `Button`
- `data-table.tsx` → `DataTable`
- `navigation-menu.tsx` → `NavigationMenu`

### 3. Build the styleguide inventory

Scan:

```txt
/auis/styleguide/components
/auis/styleguide/playground/components
/app/auis/styleguide/components
```

Also inspect:

```txt
/app/auis/styleguide/navigation.ts
/auis/styleguide/registry/components.json
/auis/styleguide/components/index.ts
```

Classify each component:

- **official** — present in `/auis/styleguide/components`
- **playground** — present in `/auis/styleguide/playground/components`
- **route showcase only** — has a page in `/app/auis/styleguide/components/[name]` but no source entry
- **registry only** — appears in registry/navigation but has no actual entry
- **missing** — used in the app but not present anywhere in the styleguide
- **orphaned** — present in the styleguide but not used anywhere in the app

### 4. Compare coverage

For every component found in the target:

```txt
Component:        [name]
Source files:     [paths where it's defined]
Imported from:    [files in target that import it]
Styleguide status: [official | playground | route-only | registry-only | missing]
Required action:  [none | promote | add stub | document]
```

Coverage is valid when a component appears in at least one accepted styleguide
location.

If `Include playground as covered` is `no`, playground entries are reported as
**needs official promotion**.

### 5. Apply the chosen mode

#### `report only`

Do not edit files. Return the full report (see Output below).

#### `create missing stubs`

For each missing component, create a minimal styleguide source entry under:

```txt
/auis/styleguide/playground/components/[component-name]
```

Each stub includes:

- purpose (short description, can be marked TODO)
- source files
- import path
- shadcn primitive if applicable
- status: **needs review**
- TODOs for variants, states, props, and accessibility

#### `create missing stubs and update navigation`

Do everything from the previous mode, then update existing navigation or
registry files. Don't invent a navigation system when none exists — if the
project has nothing to update, fall back to stubs only and note it in the output.

### 6. Validate

If files changed, run available checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

If nothing changed (report-only mode), skip validation.

## Output to return

```md
Auis styleguide coverage audit complete.

Scan:
- Target: [path]
- Styleguide: [path]
- Mode: [mode]

Summary:
- Components found: [N]
- Covered: [N]
- Missing: [N]
- Playground only: [N]
- Orphaned styleguide entries: [N]

Missing components:
| Component | Found in | Required action |
|-----------|----------|-----------------|
| [name]    | [files]  | [action]        |

Orphaned styleguide entries (optional):
| Component | Styleguide path | Note |
|-----------|-----------------|------|

Changed:
- [file path] — what changed   (omit this section in report-only mode)

Validation:
- [command] — passed / failed / not available
```

## Notes

- Treat shadcn components imported into the app as components that need
  styleguide coverage — they're part of the surface area the team is shipping.
- Prefer adding missing entries to **playground** first unless the user asks
  to promote them directly.
- This audit is a coverage check, not a refactor. Don't move, rename, or
  delete components.
- When the same component name resolves to different files (e.g. a local
  `Button` and `@/components/ui/button`), report both and let the user decide.
- If the project has no styleguide structure at all, stop and recommend
  running the `auis-foundation` skill first.
