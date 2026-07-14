---
name: design-system-new-component
description: >
  [INACTIVE in this repo — do not trigger.] Generic, Au-blind version of "new
  component", kept only as a record of the Auis initial setup. To add or
  edit a design-system component use auis-new-component, which enforces
  the Au prefix, Auis tokens, and the shadcn-wrapper flow. See AGENTS.md.
---

# Design System — New Component

Adds a component to the project following the hierarchy: **shadcn registry →
extend shadcn → build custom**. In every case, it generates a showcase in the
styleguide at `/app/auis/styleguide/components/[name]/page.tsx` and
updates the navigation.

> **Prerequisite:** the project must already have an initialized design system
> (the `/auis/styleguide` route configured via the
> `setup-design-system-from-claude-design` or
> `setup-design-system-from-reference` skill). If it does not, stop and tell the
> user to run that skill first.

---

## Workflow

### 1. Check whether the component exists in shadcn

Use the **shadcn MCP** to query the registry before doing anything else:

- **Search:** `search_items_in_registries` with query `"[component name]"`.
- **If found, view the details:** `view_items_in_registries` to check
  structure and dependencies.
- **Get usage examples:** `get_item_examples_from_registries` with query
  `"[component]-demo"`.

**Decision:**

- The component exists in the registry → go to **step 2 (Install)**.
- The component does not exist → go to **step 4 (Build custom)**.

**Most common shadcn components (quick reference):**

- **Layout:** Card, Separator, Tabs, Accordion, Collapsible.
- **Forms:** Button, Input, Select, Checkbox, Radio, Switch, Textarea, Label,
  Form.
- **Feedback:** Alert, Toast, Progress, Skeleton, Badge.
- **Overlay:** Dialog, Drawer, Popover, Tooltip, Dropdown Menu, Context Menu,
  Alert Dialog.
- **Navigation:** Navigation Menu, Breadcrumb, Pagination, Command.
- **Data:** Table, Data Table, Calendar, Chart.

---

### 2. Install the shadcn component

Get the install command via the shadcn MCP:

- `get_add_command_for_items` for the target component.

Run:

```bash
npx shadcn@latest add [component-name]
```

This adds the component to `/components/ui/` and it automatically consumes
the CSS variables defined in `globals.css`.

Before moving on, open the generated file and identify:

- The available variants (size, variant, style).
- The props interface.
- How it uses the CSS variables (for consistency with your tokens).

---

### 3. Customize the component (if needed)

If the base component needs extra variants or behaviors, **do not edit the
file in `/components/ui/`** directly (it will be overwritten on updates).
Create a wrapped version at `/components/[ComponentName].tsx`:

```tsx
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CustomButtonProps extends React.ComponentProps<typeof Button> {
  intent?: 'default' | 'success' | 'warning' | 'info'
}

export function CustomButton({
  intent = 'default',
  className,
  ...props
}: CustomButtonProps) {
  return (
    <Button
      className={cn(
        // Use CSS variables via Tailwind classes
        intent === 'success' && 'bg-success text-success-foreground hover:bg-success/90',
        intent === 'warning' && 'bg-warning text-warning-foreground hover:bg-warning/90',
        intent === 'info' && 'bg-info text-info-foreground hover:bg-info/90',
        className
      )}
      {...props}
    />
  )
}
```

**Customization patterns:**

- Add color variants using your CSS variables (`bg-success`,
  `text-warning`, etc.).
- Add size variants.
- Compose multiple shadcn components together.
- Add loading states, icons or other features.

---

### 4. Build a custom component (if shadcn doesn't have it)

If the registry does not have the component, build it using:

- shadcn primitives as building blocks (Radix UI, etc.).
- CSS variables via Tailwind classes (`bg-primary`, `text-foreground`).
- Patterns consistent with the project's other shadcn components.

```tsx
import { cn } from "@/lib/utils"

interface CustomWidgetProps {
  variant?: 'default' | 'primary' | 'muted'
  children: React.ReactNode
  className?: string
}

export function CustomWidget({
  variant = 'default',
  children,
  className
}: CustomWidgetProps) {
  return (
    <div className={cn(
      "rounded-lg border p-4",
      variant === 'default' && 'bg-card text-card-foreground border-border',
      variant === 'primary' && 'bg-primary text-primary-foreground border-primary',
      variant === 'muted' && 'bg-muted text-muted-foreground border-border',
      className
    )}>
      {children}
    </div>
  )
}
```

---

### 5. Create the component showcase

Add `/app/auis/styleguide/components/[component-name]/page.tsx`
containing:

- **Every variant side by side** (sizes, colors, styles).
- **Every state** (default, hover, focus, disabled, loading).
- **Dark mode preview** (toggle between themes).
- **Interactive demo** with prop controls.
- **Code examples** for the most common uses.

Use the shadcn MCP examples (`get_item_examples_from_registries`) as a
starting point.

---

### 6. Document usage

Include in the showcase page:

- The import statement.
- A basic usage example.
- A props table (name, type, default, description).
- Examples per variant, with the code underneath.
- Accessibility notes (keyboard navigation, ARIA).

---

### 7. Update the styleguide navigation

Edit `/app/auis/styleguide/navigation.ts` and add the component to the
`Components` section:

```ts
{
  title: "Components",
  items: [
    // ... existing components
    { name: "[Component Name]", href: "/auis/styleguide/components/[component-name]" },
  ]
}
```

This makes the component show up in the styleguide sidebar.

---

## Resulting directory structure

```
components/
├── ui/                      # shadcn base (auto-generated, don't edit)
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
└── [CustomComponent].tsx    # Wrappers and custom components

app/
└── auis/
    └── styleguide/
        ├── navigation.ts                          # ← edit (step 7)
        └── components/
            └── [component-name]/
                └── page.tsx                       # ← create (step 5)
```

---

## Expected output

- The component installed/created in `/components/`.
- A showcase at `/app/auis/styleguide/components/[name]/page.tsx`.
- The navigation updated in `/app/auis/styleguide/navigation.ts`.
- The component visible in the styleguide sidebar.
- Usage documented with code examples.

---

## Notes

- **Use the shadcn MCP** to search, view and get examples before building.
- **CSS variables are the source of truth** (defined in `globals.css`).
- **Tailwind classes reference the CSS variables** (`bg-primary`,
  `text-muted-foreground`).
- **No Figma needed** for component development — shadcn defines the design.
- **Extend, don't rebuild** — customize shadcn components instead of
  starting from scratch.
- Never edit files in `/components/ui/` directly; create wrappers in
  `/components/`.
