---
name: auis-page
description: >
  Builds a full page in a Auis design system project (Next.js +
  shadcn/ui) from a screenshot, Figma URL, wireframe, or written description.
  Maps every visual element to existing Auis components first, falls
  back to shadcn/ui primitives or playground components when needed, and
  ensures every imported component is also represented in
  /auis/styleguide. Use whenever the user asks to "build a page",
  "implement screen", "create dashboard/landing/profile/settings page",
  "scaffold page from Figma", "translate mockup to code", "implement this
  screenshot", or hands over a reference and asks for a working page.
---

# Auis — Page Builder

Build a page from a design reference, reusing Auis components first,
shadcn primitives second, and creating new playground components only when
nothing fits.

> **Prerequisite:** the design system must already be initialized
> (`/auis/styleguide` route in place). If it isn't, run the
> `auis-foundation` skill first.

## Input

```txt
Page name: [PAGE NAME]
Reference design: [SCREENSHOT, FIGMA URL, WIREFRAME, OR DESCRIPTION]
Target project: [PROJECT PATH OR CURRENT REPOSITORY]
Route: [DESIRED ROUTE OR "INFER FROM PROJECT"]
```

## Non-negotiables

- shadcn/ui stays the primitive layer.
- `/auis/styleguide` is the canonical Auis source.
- `/app/auis/styleguide` is the canonical route namespace.
- Do **not** create `/app/styleguide`.
- Prefer official Auis components before creating page-local components.
- Every component imported, installed, wrapped, or created for the page must
  also be exported / documented / registered in Auis/styleguide.

## Workflow

### 1. Inspect Auis and the app

Inspect:

- `/auis/styleguide/foundation`
- `/auis/styleguide/components`
- `/auis/styleguide/playground/components`
- `/app/auis/styleguide`
- existing routes and layouts
- app components
- `components/ui`
- shadcn setup
- Tailwind tokens
- navigation, registry, or Product Builder config when present

### 2. Analyze the design visually

Identify, from the reference:

**Layout structure**
- main sections
- sidebar / header / footer presence
- grid and columns
- container widths
- spacing rhythm

**UI sections**
- break the page into logical sections
- name each section by purpose
- spot repeated elements

**Content hierarchy**
- primary heading
- main content
- supporting content
- actions / CTAs

**Interaction model**
- tabs, filters, forms
- dialogs / drawers, menus
- loading, empty, and error states

### 3. Map sections to components

Use this priority, in order:

1. Official Auis components from `/auis/styleguide/components`
2. Existing app components
3. Playground components from `/auis/styleguide/playground/components`
4. shadcn/ui primitives
5. New Auis playground components (only if 1–4 don't fit)

For each visual element, build a mapping table:

| Visual element     | Component source   | Component       | Notes |
|--------------------|--------------------|-----------------|-------|
| Navigation sidebar | Auis or shadcn | Sidebar       | Reuse existing if available |
| Tabs               | shadcn/ui          | Tabs            | Register in styleguide if newly imported |
| Cards              | shadcn/ui          | Card            | Use tokenized styling |
| Buttons            | shadcn/ui          | Button          | Use variants |
| Form fields        | shadcn/ui          | Input, Label, Select | Accessible labels |
| Status tags        | shadcn/ui          | Badge           | Semantic variants |
| Modal              | shadcn/ui          | Dialog          | Focus management |
| Menu               | shadcn/ui          | DropdownMenu    | Keyboard support |
| Icons              | lucide-react       | Icon component  | Use existing icon rules |

Use shadcn MCP when available to verify components and install commands.

### 4. Install missing shadcn components

If shadcn isn't initialized yet:

```bash
npx shadcn@latest init
```

Install only what the page actually needs:

```bash
npx shadcn@latest add [component1] [component2] [component3]
```

Read the generated files before editing. Preserve local modifications.

### 5. Build or reuse components

If a section needs a component that doesn't exist:

- Create it as a **reusable component** (not inline page markup) when it's
  repeated or likely to be reused.
- Base it on shadcn primitives when possible.
- Put unreviewed new components under `/auis/styleguide/playground/components`.
- Promote to `/auis/styleguide/components` only if the project convention
  or the user says it's official.

For complex components, hand off to the `auis-component` skill instead
of inlining the work here.

### 6. Build the page

Use the project's routing convention.

For Next.js App Router, a typical route looks like:

```txt
/app/[page-name]/page.tsx
```

Or, when the product route belongs under Auis:

```txt
/app/auis/[page-name]/page.tsx
```

The page should use:

- semantic HTML
- design tokens (no hardcoded colors / sizes)
- responsive layout
- accessible interactions
- stable dimensions for repeated UI
- clear loading, empty, and error states
- existing layouts and providers

### 7. Export every used component to Auis/styleguide

Before finishing, build a **component coverage list** from the page's imports.

For every component imported by the page from:

- `@/components/ui/*`
- `@/components/*`
- local app component folders
- newly created page component files

make sure it has a styleguide entry in one of:

```txt
/auis/styleguide/components/[component-name]
/auis/styleguide/playground/components/[component-name]
```

If the project uses a route-based styleguide, also add or update:

```txt
/app/auis/styleguide/components/[component-name]/page.tsx
```

Update whichever registry files exist:

```txt
/app/auis/styleguide/navigation.ts
/auis/styleguide/registry/components.json
/auis/styleguide/components/index.ts
```

**This includes shadcn components imported into the app.** If the page imports
`Button`, `Card`, `Tabs`, or any other shadcn component, each must be visible
or registered in Auis/styleguide. The `auis-audit` skill exists
to catch gaps here.

### 8. Register the page

If the repo has a route registry, Product Builder config, navigation, sitemap,
or canvas metadata, update it. Don't invent a registry where none exists.

### 9. Validate

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
Auis page complete.

Page:
- [PAGE NAME]
- Route: [route]

Changed:
- [file path] — what changed

Sections:
- [section] — [components used]

Component coverage:
- [component] — official / playground / added / already covered

New components:
- [component or "none"]

shadcn/ui:
- Used: yes / no
- Components installed: [list]

Validation:
- [command] — passed / failed / not available
```

## Notes

- Existing Auis components come first.
- shadcn remains the primitive layer.
- Every imported component must be represented in Auis/styleguide.
- Experimental page-specific components still belong in the styleguide playground.
- If the design reference is ambiguous on layout or behavior, ask before scaffolding.
