---
name: auis-component
description: >
  Adds a new component to a Auis design system project (Next.js +
  shadcn/ui) and registers it under /auis/styleguide with a showcase
  route. Always checks the shadcn registry first via MCP, prefers extending
  existing primitives over building from scratch, and produces both the
  implementation and the styleguide documentation in a single pass. Use
  whenever the user asks to "add component", "install Button/Card/Dialog/Input/etc.",
  "create custom component", "wrap shadcn", "extend Button", "build a
  component for the design system", "register component in the styleguide",
  or names any component to include in the system.
---

# Auis — Component Builder

Add a component to the project using shadcn/ui as the primitive layer and
register it in `Auis/styleguide`. The hierarchy is always **shadcn registry →
extend shadcn → build custom**.

> **Prerequisite:** the design system must already be initialized
> (`/auis/styleguide` route in place). If it isn't, run the
> `auis-foundation` skill first.

## Input

```txt
Component name: [COMPONENT NAME]
Target project: [PROJECT PATH OR CURRENT REPOSITORY]
Design reference: [OPTIONAL SCREENSHOT, FIGMA URL, OR DESCRIPTION]
Status: [official | playground]
```

## Non-negotiables

- shadcn/ui stays the primitive layer.
- The canonical namespace is `Auis/styleguide`.
- Repository docs and component inventory live under `/auis/styleguide`.
- Next.js App Router showcase pages live under `/app/auis/styleguide`.
- Do **not** use `/app/styleguide`.
- A component is not done until it's implemented, documented, and visible in
  Auis/styleguide.

## Workflow

### 1. Inspect the existing system

Inspect:

- `/auis/styleguide/foundation`
- `/auis/styleguide/components`
- `/auis/styleguide/playground/components`
- `/app/auis/styleguide`
- `components/ui`
- existing app components
- `components.json`
- Tailwind + shadcn setup
- styleguide navigation or registry files

Reuse existing conventions. Never invent a parallel structure when one already exists.

### 2. Check shadcn first

If `components.json` or shadcn aliases are missing, initialize before installing:

```bash
npx shadcn@latest init
```

Use **shadcn MCP** when available — it's the authoritative source:

- `search_items_in_registries` for `[component name]`
- `view_items_in_registries` for structure and dependencies
- `get_item_examples_from_registries` for usage examples (try `[component]-demo`)
- `get_add_command_for_items` for the install command

**Decision tree:**

- shadcn component exists exactly → install or reuse.
- shadcn component is close but not exact → wrap or extend.
- shadcn component doesn't exist → build custom from shadcn primitives + Auis tokens.

**Quick reference — common shadcn components:**

- **Layout:** Card, Separator, Tabs, Accordion, Collapsible
- **Forms:** Button, Input, Select, Checkbox, Radio Group, Switch, Textarea, Label, Form
- **Feedback:** Alert, Toast/Sonner, Progress, Skeleton, Badge
- **Overlay:** Dialog, Drawer, Popover, Tooltip, Dropdown Menu, Context Menu, Alert Dialog
- **Navigation:** Navigation Menu, Breadcrumb, Pagination, Command, Sidebar
- **Data:** Table, Calendar, Chart

### 3. Install or reuse the shadcn primitive

```bash
npx shadcn@latest add [component-name]
```

Then **read the generated file** in `components/ui` and identify:

- exported names
- variants
- size options
- data attributes
- accessibility behavior
- which CSS variables it consumes

Don't blindly overwrite local modifications.

### 4. Implement the Auis component

Strategy, in order:

1. Reuse an existing official Auis component when it already fits.
2. Wrap a shadcn primitive when the API or visual layer needs Auis naming.
3. Compose multiple shadcn primitives for complex UI.
4. Build custom only when shadcn doesn't provide a suitable primitive.

Requirements every component meets:

- TypeScript with typed props
- `className` support (use `cn()`)
- semantic HTML
- accessible keyboard behavior
- ARIA attributes when needed
- design tokens and Tailwind classes — **no hardcoded styling**
- stable layout across states (no jumps when loading/disabled)
- `lucide-react` icons when icons are needed

**Wrapper pattern** (when extending a shadcn primitive):

```tsx
import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AuisButtonProps = React.ComponentProps<typeof Button> & {
  intent?: "default" | "success" | "warning" | "info"
}

export function AuisButton({
  intent = "default",
  className,
  ...props
}: AuisButtonProps) {
  return (
    <Button
      className={cn(
        intent === "success" && "bg-success text-success-foreground hover:bg-success/90",
        intent === "warning" && "bg-warning text-warning-foreground hover:bg-warning/90",
        intent === "info" && "bg-info text-info-foreground hover:bg-info/90",
        className,
      )}
      {...props}
    />
  )
}
```

### 5. Document in Auis/styleguide

Create or update the component documentation:

```txt
/auis/styleguide/components/[component-name]
```

If the component is new and unreviewed, put it under:

```txt
/auis/styleguide/playground/components/[component-name]
```

Each entry includes:

- purpose
- anatomy
- variants
- sizes
- states
- props
- token usage
- accessibility notes
- shadcn primitives used
- import path
- implementation status

If the project uses a route-based styleguide, also create the showcase:

```txt
/app/auis/styleguide/components/[component-name]/page.tsx
```

The showcase must include:

- all variants
- all sizes
- disabled / loading / error states when relevant
- dark mode preview when supported
- realistic usage examples
- code snippets

### 6. Update navigation and registry

Update whichever files the project already uses:

```txt
/app/auis/styleguide/navigation.ts
/auis/styleguide/registry/components.json
/auis/styleguide/components/index.ts
```

Don't invent a new registry format if the project already has one.

### 7. Validate

Run available checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Output to return

```md
Auis component complete.

Component:
- [COMPONENT NAME]

Changed:
- [file path] — what changed

Styleguide:
- Source entry: [path]
- Showcase route: [path or "n/a"]
- Navigation updated: yes / no

shadcn/ui:
- Used: yes / no
- Primitive(s): [list]
- Install command: [or "n/a"]

Validation:
- [command] — passed / failed / not available
```

## Notes

- Always prefer extending shadcn over creating custom UI.
- Official components → `/auis/styleguide/components`.
- Unreviewed / experimental components → `/auis/styleguide/playground/components`.
- Anything imported by the app should be findable from Auis/styleguide.
- If the user gives a generic name (e.g. "Tag", "Pill"), confirm whether they
  want a wrapper around an existing shadcn primitive (Badge) or a brand-new component.
