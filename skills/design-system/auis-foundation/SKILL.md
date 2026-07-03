---
name: auis-foundation
description: >
  Sets up a complete Auis design system in a Next.js + shadcn/ui project
  starting from any visual reference — a screenshot, Figma URL, Dribbble shot,
  Behance post, Mobbin capture, or any other design inspiration. Extracts or
  infers tokens (colors, typography, spacing, radius, shadows), initializes
  shadcn/ui, writes the tokens into globals.css, installs the foundation
  components, and scaffolds the canonical /auis/styleguide route. Use
  whenever the user asks to "set up a design system", "bootstrap styleguide",
  "extract tokens from screenshot", "initialize Auis", "create design
  system from Figma/Dribbble/Behance", "build a styleguide from this design",
  or hands over visual inspiration to translate into a token system.
---

# Auis — Design System Foundation

Translate a design reference into a working Auis design system: shadcn/ui
under the hood, tokens in `globals.css`, and a navigable `/auis/styleguide`
route documenting everything.

This skill is the **first** step. The component and page skills assume the
foundation is already in place.

## Input

Either a visual reference or a target project (or both):

- **Design source:** screenshot, Figma URL, Dribbble shot, Behance post,
  Mobbin capture, exported mockup, or product photo.
- **Target project:** path to the repository, or "current repo".
- **Product namespace:** `Auis` (default — only change if the user explicitly asks).

If no design source is attached, ask before proceeding.

## Non-negotiables

- The canonical namespace is **`Auis/styleguide`**.
- In repository paths, use `/auis/styleguide` unless the project already
  uses uppercase `Auis`.
- For Next.js App Router projects, the route lives at `/app/auis/styleguide`.
- Do **not** create `/app/styleguide`, `/styleguide`, or any competing root styleguide.
- shadcn/ui is the foundation. CSS variables and Tailwind utility classes are
  the implementation layer.
- Every official component eventually has an entry under `Auis/styleguide`.

## Workflow

### 1. Inspect the project before editing

Before touching anything, inspect:

- framework + router (Next.js App Router? Pages? Vite? etc.)
- existing `/auis` or `/Auis` folder
- existing `/app/auis/styleguide` route
- existing components and `components/ui`
- Tailwind version and config
- `globals.css`
- shadcn setup (`components.json`, aliases, `cn` helper)
- current navigation or registry patterns

Reuse local conventions. **If a Auis styleguide already exists, update it
instead of creating a second one.**

### 2. Analyze the design

Look at the reference and identify or infer:

**Colors**
- Primary / brand color, plus full scale (50–900+).
- Neutral / grey scale (50–900+).
- Semantic colors: `success`, `error`, `warning`, `info` when visible.
- Background, surface, card, popover, border, input, ring.
- Sidebar colors when the product uses a sidebar.

**Typography**
- Font family. When there's no obvious match, suggest the closest Google Font
  and mark it as inferred.
- Heading sizes and weights.
- Body sizes, line heights, label/caption usage, monospace where relevant.

**Spacing, radius, shadows**
- Spacing rhythm (tight / normal / relaxed).
- Border radius style (sharp / rounded / pill).
- Shadow depth and usage.
- Border and divider behavior.

**Component language**
- Buttons, forms, navigation, cards/panels, tables/lists, dialogs/drawers/popovers/tooltips, feedback states.

> Whenever you're inferring rather than measuring, mark the token as **(inferred)**
> in the final summary so the user can validate.

### 3. Initialize or verify shadcn/ui

If shadcn isn't initialized yet:

```bash
npx shadcn@latest init
```

Recommended answers:

- Style: **Default**
- Base color: **Neutral** (we'll override with our tokens)
- CSS variables: **Yes**

If shadcn is already initialized, keep the existing aliases and config.

### 4. Apply the design tokens

Update the app's token source using the repository convention.

- Tailwind v4 → update `globals.css` with CSS variables and `@theme inline`.
- Tailwind v3 → update CSS variables and `tailwind.config.*` when needed.

Use shadcn-compatible variables (this is the bridge between design tokens and UI):

```css
:root {
  --background: [extracted background];
  --foreground: [extracted foreground];
  --card: [extracted card];
  --card-foreground: [extracted card foreground];
  --popover: [extracted popover];
  --popover-foreground: [extracted popover foreground];
  --primary: [extracted primary];
  --primary-foreground: [contrast-safe foreground];
  --secondary: [extracted secondary];
  --secondary-foreground: [contrast-safe foreground];
  --muted: [extracted muted];
  --muted-foreground: [extracted muted foreground];
  --accent: [extracted accent];
  --accent-foreground: [contrast-safe foreground];
  --destructive: [error red];
  --destructive-foreground: [contrast-safe foreground];
  --border: [extracted border];
  --input: [extracted input border];
  --ring: [focus ring];
  --radius: [extracted radius];
  --success: [success];
  --success-foreground: [contrast-safe foreground];
  --warning: [warning];
  --warning-foreground: [contrast-safe foreground];
  --info: [info];
  --info-foreground: [contrast-safe foreground];
  --sidebar: [sidebar background];
  --sidebar-foreground: [sidebar text];
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: var(--primary-foreground);
  --sidebar-accent: [sidebar accent];
  --sidebar-accent-foreground: [sidebar accent foreground];
  --sidebar-border: [sidebar border];
  --sidebar-ring: var(--ring);
}
```

Add `.dark { ... }` overrides when the product supports dark mode.

For Tailwind v4, also include the `@theme inline` block exposing these variables
as `--color-*` tokens so utilities like `bg-primary` resolve.

### 5. Install the foundation shadcn components

The styleguide needs enough surface area to demo the tokens. Install:

```bash
npx shadcn@latest add button card badge alert radio-group tabs input label select separator switch tooltip dialog dropdown-menu
```

Add more (drawer, popover, table, accordion, etc.) when the reference clearly
calls for them. Use shadcn MCP when available to verify component names and
install commands.

### 6. Create the Auis styleguide source

Create or update:

```txt
/auis/styleguide/
  foundation/
    colors/
    typography/
    spacing/
    radius/
    shadows/
    iconography/
    logos/
  components/
  registry/
    components.json
  playground/
    components/
    paginas/
```

Each foundation doc should include:

- token name
- value
- usage
- Tailwind class when available
- shadcn variable mapping
- dark mode value when applicable

### 7. Create the styleguide route

For Next.js App Router projects without an existing convention, create:

```txt
/app/auis/styleguide/layout.tsx
/app/auis/styleguide/navigation.ts
/app/auis/styleguide/page.tsx
/app/auis/styleguide/components/
```

All navigation hrefs use:

```txt
/auis/styleguide
/auis/styleguide/components/[component-name]
```

Never `/styleguide`.

A reasonable layout starts with a sidebar nav driven by `navigation.ts`:

```ts
export interface NavItem { name: string; href: string }
export interface NavSection { title: string; items: NavItem[] }

export const navigation: NavSection[] = [
  {
    title: "Foundation",
    items: [{ name: "Design Tokens", href: "/auis/styleguide" }],
  },
  {
    title: "Components",
    items: [
      // populated by the component skill
    ],
  },
]
```

### 8. Build the foundation page

`/app/auis/styleguide/page.tsx` should display **everything in one place**:

- color palette with CSS variable names
- primary scale (50–900)
- neutral scale
- semantic colors (success, warning, error, info)
- typography samples (headings, body, label, mono)
- spacing examples
- border radius examples
- shadow examples
- shadcn component previews (Button, Card, Badge, Alert, Radio Group, etc.)
- dark mode preview when supported
- component inventory summary

Include any extra token inferred from the reference that isn't in the standard list.

### 9. Component registry rule

Every component that becomes official must be represented in:

```txt
/auis/styleguide/components/[component-name]
```

If the app uses route-based showcases, also create:

```txt
/app/auis/styleguide/components/[component-name]/page.tsx
```

Update navigation and registry files whenever components are added. The
`auis-component` skill handles this for new components — this skill
just sets up the structure.

### 10. Validate

Run only the commands the project actually has:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

If visual fidelity matters, run the app and inspect `/auis/styleguide`.

## Output to return

```md
Auis design system foundation complete.

Changed:
- [file path] — what changed

Architecture:
- Canonical namespace: /auis/styleguide
- Route namespace: /app/auis/styleguide

shadcn/ui:
- Initialized: yes / no / already existed
- Components installed: [list]

Design summary:
- Primary color: [hex]
- Font: [name]
- Style: [e.g. "modern minimal", "bold colorful", "soft friendly"]
- Radius: [e.g. "rounded 8px", "sharp", "pill"]
- Overall feel: [short description]
- Tokens marked (inferred): [list — for the user to validate]

Validation:
- [command] — passed / failed / not available
```

## Notes

- Make reasonable inferences when the design is incomplete, and flag them.
- Use contrast-safe foregrounds.
- Keep shadcn CSS variables as the bridge between design tokens and UI.
- Don't let one-off page styling become the design system.
- If anything in the reference is ambiguous, ask before extracting.
