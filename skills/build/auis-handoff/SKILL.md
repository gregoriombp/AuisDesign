---
name: auis-handoff
description: >
  Converts a Claude Design (or Cloud Design) handoff into production code by
  remapping the generated output onto Auis/styleguide components first
  and shadcn/ui primitives second, instead of copying the generated component
  architecture directly. Accepts /fetch URLs from claude.com/design, zip
  exports, exported folders, generated code, screenshots, or flow
  descriptions, and produces a real page or flow built from the design
  system. Use whenever the user mentions "Claude Design handoff", "Cloud
  Design handoff", "/fetch URL", "zip from claude.com/design", "exported
  design", "translate generated code into the design system", "remap
  handoff", "implement Claude Design output", or hands over a Claude/Cloud
  Design export to turn into real code in a Auis project.
---

# Auis — Claude Design Handoff

Convert a Claude Design (or Cloud Design) handoff into production code, using
**Auis/styleguide first** and **shadcn/ui second**. The generated handoff
is a reference for layout, copy, and visual intent — not for component architecture.

> **Prerequisite:** the design system must already be initialized
> (`/auis/styleguide` route in place). If it isn't, run the
> `auis-foundation` skill first.
>
> **Different from `auis-page`:** the page-builder skill works from a
> static design (screenshot, Figma, wireframe). This skill works specifically
> from a Claude/Cloud Design **export with generated code**, where the
> central problem is *not trusting* the generated component boundaries.

## Input

```txt
Design source: [CLAUDE DESIGN /fetch URL, ZIP FILE, EXPORTED FOLDER, GENERATED CODE, SCREENSHOT, OR FLOW]
Target project: [PROJECT PATH OR CURRENT REPOSITORY]
Page or flow name: [NAME]
Route: [DESIRED ROUTE OR "INFER FROM PROJECT"]
Mode: [analyze only | implement | implement and create missing playground components]
```

## Core rule

**Claude Design output is a visual and content reference, not the component architecture.**

Generated code typically has:

- arbitrary div nesting that doesn't match real components
- hardcoded colors and one-off styling
- duplicated wrapper components that should collapse
- huge monolithic components that should split
- ad-hoc state models for things shadcn handles natively

Do **not** copy generated components directly. Rebuild the page or flow using,
in priority order:

1. `/auis/styleguide/components` (official)
2. existing app components
3. `/auis/styleguide/playground/components`
4. shadcn/ui primitives and accessibility patterns
5. new playground components — only when something is genuinely missing

## Non-negotiables

- shadcn/ui stays the primitive layer.
- The canonical namespace is `Auis/styleguide`.
- Repository docs go under `/auis/styleguide`.
- Next.js route showcases go under `/app/auis/styleguide`.
- Do **not** use `/app/styleguide`.
- Every component imported, wrapped, installed, or created must end up
  represented in Auis/styleguide.

## Workflow

### 1. Ingest the source

Adapt to the input type:

- **Zip file** → unpack into a temporary review folder under `/tmp/` or the
  project's `tmp/`. Don't unpack into `src/` or `app/`.
- **`/fetch` URL from claude.com/design** → fetch and read the export.
- **Generated code** (raw `.tsx`, `.jsx`) → inspect for layout, copy, assets,
  interactions, and state hints. Don't import it as-is.
- **Screenshot or flow description** → analyze the visual structure as you
  would for a regular page reference.

Treat the export as **read-only inspiration**. Don't trust the generated
component names or their boundaries.

### 2. Inspect Auis and shadcn

Inspect:

- `/auis/styleguide/foundation`
- `/auis/styleguide/components`
- `/auis/styleguide/playground/components`
- `/app/auis/styleguide`
- app routes and layouts
- `components/ui`
- `components.json`
- Tailwind config
- `globals.css`

If shadcn isn't initialized:

```bash
npx shadcn@latest init
```

### 3. Extract intent from the handoff

Before writing any code, document what the design is actually trying to do:

```txt
Experience:
- User goal:        [what the user is doing on this page/flow]
- Route or step:    [where in the app this lives]
- Sections:         [the logical sections of the UI]
- Repeated patterns:[anything that appears more than once]
- Interactions:     [clicks, form submissions, navigation]
- Form behavior:    [validation, async, dependent fields]
- States:           [loading, empty, error, success]
- Responsive:       [breakpoints and behavior]
- Assets:           [images, icons, illustrations]
```

This intent doc is the contract for the rebuild. The generated code is just
a hint about how to satisfy it.

### 4. Build the handoff mapping

Create a mapping table **before** writing implementation code:

| Design part | Generated component | UI role | Auis match | shadcn primitive | Decision |
|-------------|---------------------|---------|------------------|------------------|----------|

`Decision` must be one of:

- **reuse** — an existing Auis component fits as-is
- **wrap** — wrap a shadcn primitive with Auis naming/intent
- **compose** — combine multiple primitives or existing components
- **create playground component** — genuinely new, goes into playground first
- **discard generated wrapper** — generated component adds nothing, drop it

If `Mode` is `analyze only`, return after this step. The mapping table + intent
doc is the deliverable.

### 5. Rebuild with real components

When implementing, follow these rules:

- **Prefer Auis official components** even when the generated code
  structures things differently. The styleguide wins.
- **Use shadcn primitives for behavior-heavy UI**: dialogs, popovers, menus,
  tabs, tooltips, forms, command menus, drawers. The accessibility behavior
  shadcn provides is almost always better than what's in generated code.
- **Keep what's worth keeping** from the export: copy, content hierarchy,
  layout intent, assets.
- **Replace** arbitrary div nesting, hardcoded colors, and one-off generated
  state models with tokens and proper components.
- **Split** huge generated components into reusable product components.
- **Collapse** tiny wrapper-only generated components into proper components.

For complex new components surfaced during the rebuild, hand off to the
`auis-component` skill rather than inlining everything here.

### 6. Coverage — every component must end up in the styleguide

Build a coverage list from the page's final imports.

For every component imported by the page from:

- `@/components/ui/*`
- `@/components/*`
- local app component folders
- newly created files

make sure it has an entry in one of:

```txt
/auis/styleguide/components/[component-name]
/auis/styleguide/playground/components/[component-name]
```

If `Mode` is `implement and create missing playground components`, create stubs
for any missing ones in `/auis/styleguide/playground/components/[name]`
with status **needs review**.

If route showcases exist, also update:

```txt
/app/auis/styleguide/components/[component-name]/page.tsx
```

Update whichever registry files the project already uses:

```txt
/app/auis/styleguide/navigation.ts
/auis/styleguide/registry/components.json
/auis/styleguide/components/index.ts
```

The `auis-audit` skill exists to catch gaps after the fact.

### 7. Validate

Run available checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Use browser verification when visual fidelity matters.

## Output to return

```md
Auis Claude Design handoff complete.

Source:
- Type: [zip | /fetch URL | generated code | screenshot | flow]
- Location: [path or URL]

Implemented:
- Page/flow: [name]
- Route: [route]

Mapping:
- [design part] → [Auis/shadcn component] → [decision]

Components:
- Reused:    [list]
- Wrapped:   [list]
- Created:   [list]
- Playground:[list]
- Discarded: [list of generated wrappers dropped]

Coverage:
- [component] — official / playground / covered / missing

Changed:
- [file path] — what changed

Validation:
- [command] — passed / failed / not available
```

## Notes

- The export is a reference; the design system is the source of truth. If
  they conflict, the design system wins.
- Don't import generated code into `app/` or `src/` directly. Inspect it,
  then rewrite.
- If the export is ambiguous about behavior or interaction, ask before guessing.
- Save the intent doc somewhere — it's useful for future iterations on the same flow.
- If the user wants to *bootstrap a whole design system* from a Claude Design
  export (not implement a single page), this is the wrong skill — use
  `auis-foundation` instead.
