---
name: figma-code-library-import
description: Use when implementing or updating product UI from Figma in code through Claude or Cursor, especially when the project has its own component library and the implementation must reuse those components instead of creating one-off duplicates. Also use when a project needs or must maintain a /styleguide route that documents the design system components, tokens, variants, and states. This project does not assume shadcn.
---

# Figma Code Library Import

Use this skill when the user is moving screens, flows, or components from Figma into code and wants the implementation to stay consistent with the project's own component library.

Typical requests:

- "implement this Figma screen in the app"
- "import this platform we made in Figma into the code"
- "build this new page from Figma, but use our components"
- "add this component from Figma to the project library"
- "create or update the /styleguide page"

## Core Rules

- Inspect the codebase before implementing anything.
- Treat the project's component library as the default implementation layer.
- Do not recreate an existing component under a new name.
- Do not generate one-off UI primitives when a library component or variant already exists.
- Do not assume shadcn, install shadcn, or use shadcn naming unless the project already uses it.
- Keep reusable design-system work visible in `/styleguide`.
- Page-local composition is allowed only after component reuse has been checked.

## Source Of Truth

Use this hierarchy:

1. Existing code component library = implementation source of truth.
2. Figma design and component names = visual and semantic source of truth.
3. Existing tokens/theme files = styling source of truth.
4. Existing `/styleguide`, Storybook, docs, or examples = usage source of truth.
5. New components or variants = last resort when the library does not cover the need.

If Figma and code disagree, prefer code architecture and adapt the design into it. Preserve visual intent, but do not copy raw Figma output into parallel components.

## Required Workflow

### 1. Discover The Project Architecture

Before coding, inspect:

- package manager and framework files
- route system and app entrypoints
- component directories such as `components`, `ui`, `design-system`, `shared`, `features`, or package workspaces
- barrel exports such as `index.ts`, `components.ts`, or package entrypoints
- theme and token files
- existing `/styleguide`, Storybook, docs, playgrounds, or component examples
- naming conventions for components, props, variants, states, and sizes

Identify:

- the authoritative component library path
- how components are exported and imported
- how tokens and themes are consumed
- how routes are created
- whether existing components are global, feature-specific, or page-local

### 2. Read Figma Before Translating

When a Figma URL or node is provided, inspect it before writing code.

Prefer this order when Figma tools are available:

1. `get_design_context` for structure, measurements, and code hints.
2. `get_screenshot` for visual verification.
3. `get_metadata` when the node is too large or child nodes need to be targeted.

Do not paste generated Figma code directly into the app. Use it as reference only.

### 3. Build A Component Map

For every imported screen or section, classify each meaningful UI piece:

- `existing-library-component`: use the project component directly.
- `existing-library-variant`: use an existing component with different props, variant, size, state, or slot content.
- `compose-from-library`: assemble the section from existing library primitives.
- `extend-library-component`: add a real variant or prop to an existing component because the design system needs it.
- `new-library-component`: create a new reusable component because no equivalent exists.
- `page-local`: keep it inside the page because it is specific to this screen and unlikely to repeat.

Use this reuse order:

1. existing route/layout/shell component
2. existing domain component
3. existing design-system component
4. existing component variant or prop combination
5. composition from existing library components
6. extension of an existing library component
7. new library component
8. page-local markup

Only choose `new-library-component` after searching the codebase for equivalent names, imports, docs, and usage examples.

### 4. Implement With The Library First

When building a route or screen:

- import components from the existing library entrypoints
- preserve existing props and variants
- add variants to existing components when the new Figma state clearly belongs there
- keep layout wrappers consistent with the app's shell and route conventions
- use existing tokens/classes/theme APIs instead of hardcoded visual values
- keep feature-specific data and copy near the route, not inside generic components

When creating a new reusable component:

- place it in the same library structure as related components
- export it from the same barrel files as related components
- support the variants and states shown in Figma
- use existing token and typography conventions
- add focused tests or examples when the repo has that pattern
- document it in `/styleguide`

### 5. Maintain `/styleguide`

Every project using this skill should have a `/styleguide` route unless the user explicitly says not to create one.

If `/styleguide` does not exist, create it using the project's route system:

- Next.js App Router: `app/styleguide/page.tsx` or `src/app/styleguide/page.tsx`
- Next.js Pages Router: `pages/styleguide.tsx` or `src/pages/styleguide.tsx`
- React Router or other routers: add a `/styleguide` route in the existing route registry
- Other frameworks: follow the project's existing route convention

The styleguide should show the real component library, not static mockups.

Include sections that fit the project:

- tokens: colors, typography, spacing, radius, shadows, and elevation
- buttons and actions
- form controls
- navigation and tabs
- cards, surfaces, lists, tables, or data display
- status, alerts, badges, tags, empty states, and loading states
- modals, drawers, popovers, or overlays if present
- page shells or layout primitives if they are reusable

For each component, show meaningful variants, sizes, states, disabled/loading/error cases, and common compositions. Keep examples small, but make them useful enough to catch visual drift.

When an implementation adds or changes a reusable component, update `/styleguide` in the same task.

### 6. Prevent Duplicate Components

Before adding any component file, search for:

- same or similar component name
- same visual role under another name
- same Figma component represented in code
- existing examples in `/styleguide` or Storybook
- matching imports in routes or features

If an equivalent exists, reuse or extend it. Do not create names like `NewButton`, `FigmaButton`, `CustomCard`, `HeroCard2`, or page-specific copies of generic components.

If the library lacks a needed component, create a canonical component name based on the design-system role, not the page where it first appeared.

### 7. Validate

After implementation, run the project's normal checks that fit the change:

- typecheck
- lint
- tests
- build
- visual/browser smoke check for the changed route
- `/styleguide` route smoke check

Also verify:

- the new page imports from the component library where possible
- new reusable components are exported from the library
- `/styleguide` renders the actual components
- no duplicate component was introduced for an existing role
- no shadcn dependency or generated shadcn-style layer was added unless it already existed before the task

## Decision Rules

Create or extend a library component when:

- the same pattern is likely to appear on more than one page
- Figma defines it as a component or component set
- it has stable variants, states, slots, or props
- it belongs to navigation, forms, actions, cards, data display, feedback, or layout primitives

Keep markup page-local when:

- it is a one-off arrangement of existing components
- it contains only page-specific copy and layout
- extracting it would create a thin wrapper with no reusable API

Ask before changing architecture when:

- two different component libraries compete in the repo
- routing is ambiguous in a monorepo
- the user wants a quick throwaway prototype instead of a reusable implementation
- matching the Figma exactly would require breaking existing component APIs

## Ready-To-Use Prompt

```text
Use the figma-code-library-import skill.

Input:
[Figma URL, screenshot, or screen brief]

Requirements:
- Inspect the project component library first.
- Reuse existing library components and variants before creating anything new.
- Do not use shadcn unless this project already has it.
- If a reusable component or design-system piece is added or changed, update /styleguide.
- Validate the route and /styleguide after implementation.
```
