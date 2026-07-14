---
name: design-system-new-page
description: '[INACTIVE in this repo — do not trigger.] Generic, Au-blind version
  of "build a page", kept only as a record of the Auis initial setup. To build
  or rework a product page use auis-new-page, which reuses existing Au* components
  and Auis tokens. See AGENTS.md.'
---

> **[DEPRECATED in this repo — use `auis-new-page`].** This skill is generic and
> **Au-blind**: it generates pages/components outside the `Au*` convention and the Auis tokens.
> Do not use it here. To build or rework a page, use **`auis-new-page`**
> (see the "Routing" table in `AGENTS.md` and `docs/component-map.md`).

# Design System — New Page

Builds a complete page in Next.js (App Router) from a visual design
(screenshot or Figma link), reusing design system components
whenever possible.

> **Prerequisite:** the project must already have an initialized design system
> (the `/auis/styleguide` route configured). Without it, stop and tell the
> user to run `setup-design-system-from-claude-design` or
> `setup-design-system-from-reference` first.

---

## Input

Accepts one of two forms:

1. **Image** (PNG, JPG, WebP) — screenshot, mockup, photo.
2. **Figma URL** — in this case, use the Figma MCP (if available) to
   extract metadata, screenshot and variable defs before proceeding; if
   it is not available, ask for a PNG export.

If the input is missing, **ask** before proceeding.

---

## Workflow

### 1. Visual analysis of the design

Examine the input and identify:

**Layout structure:**
- How many main sections/columns?
- Is there a sidebar? A header? A footer?
- What is the grid? (1, 2, 3 columns).
- Container widths, spacing patterns.

**UI sections:**
- Break the page into logical sections (top → bottom, left → right).
- Name each section by its purpose (e.g. "Sidebar Navigation", "Task List",
  "Chat Panel").

**Content hierarchy:**
- What are the primary headings?
- What is main content vs. supporting content?
- What are the CTAs?

---

### 2. Map visual elements → design system components

For each element identified, map it to a component. **Absolute
priority:** reuse components already documented in
`/auis/styleguide/components/` before installing anything new.

| Visual element | Component | Notes |
|---|---|---|
| Navigation sidebar | Sidebar | Use sidebar primitives |
| Tabs / segmented control | Tabs | For switching sections |
| Cards with content | Card | CardHeader, CardContent, CardFooter |
| Item list | Card or Table | Depends on the complexity |
| Buttons | Button | Variants: default, outline, ghost |
| Form inputs | Input, Textarea | Always with a Label |
| Dropdowns | Select or DropdownMenu | |
| Badges / tags | Badge | For status |
| Icons | lucide-react | |
| Modal / dialog | Dialog | For overlays |
| Toast / notification | Toast / Sonner | For feedback |
| Avatar | Avatar | |
| Progress | Progress | |
| Checkbox / toggle | Checkbox or Switch | |

**Decision flow for each element:**

1. Does it already exist in `/auis/styleguide/components/`? → **import from
   the local wrapper** (`@/components/...`).
2. Does it exist in the shadcn registry but is not installed? → install it via
   the shadcn MCP (step 4).
3. Does it exist in neither? → consider using the
   `design-system-new-component` skill before moving on.

> **NEVER** create a component inline in the page if it looks like something
> reusable. Promote it to the design system first.

Use the shadcn MCP to check availability:
- `search_items_in_registries` for each type.
- `get_add_command_for_items` for the install commands.

---

### 3. Define the section structure

Before coding, generate a textual breakdown:

```
Page: [PAGE NAME]
├── Header
│   ├── Logo/Brand
│   ├── Navigation tabs
│   └── User actions
├── Sidebar (if any)
│   ├── Navigation items
│   └── ...
├── Main Content
│   ├── Section 1: [name]
│   ├── Section 2: [name]
│   └── ...
└── Footer (if any)
```

Confirm with the user that the breakdown matches before installing components.

---

### 4. Install the missing components

Based on the mapping from step 2, install only what does not yet exist in the
project:

```bash
npx shadcn@latest add [component1] [component2] [component3]
```

For each new component, consider whether it deserves to go through the
`design-system-new-component` skill (showcase + navigation entry) before
being used in production. For quick prototypes, you can use it directly.

---

### 5. Scaffold the page structure

Create `/app/[page-name]/page.tsx` (a normal route, **outside** the styleguide):

```tsx
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
// ... other imports

export default function PageName() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar (if any) */}
      <aside className="w-64 border-r bg-sidebar">
        {/* Sidebar content */}
      </aside>

      {/* Main content */}
      <main className="flex-1">
        {/* Header */}
        <header className="border-b p-4">
          {/* Header content */}
        </header>

        {/* Page content */}
        <div className="p-6">
          {/* Sections */}
        </div>
      </main>
    </div>
  )
}
```

---

### 6. Apply styling with tokens

Use Tailwind classes that reference the design system's CSS variables —
**never** hard-coded values:

- **Backgrounds:** `bg-background`, `bg-card`, `bg-muted`, `bg-sidebar`.
- **Text:** `text-foreground`, `text-muted-foreground`.
- **Borders:** `border-border`.
- **Spacing:** the Tailwind scale (`p-4`, `gap-6`, `space-y-4`).

If a visual value has no corresponding token, stop and ask the
user whether it is worth creating a new token (in `globals.css`) before hard-coding it.

---

### 7. Responsive behavior

Define how the layout adapts:

- **Mobile (< 768px):** the sidebar collapses, single column.
- **Tablet (768–1024px):** sidebar as an overlay or mini.
- **Desktop (> 1024px):** the full layout as in the design.

```tsx
<div className="flex flex-col md:flex-row">
  <aside className="hidden md:block md:w-64">
    {/* Sidebar - hidden on mobile */}
  </aside>
  <main className="flex-1">
    {/* Main content */}
  </main>
</div>
```

---

### 8. Add interactivity

Implement:

- Navigation/routing between pages.
- State for tabs, toggles, selections (`useState`).
- Form handling (if applicable).
- Loading and error states.

Components that need interactivity require `"use client"` at the top
of the file. If the page is mostly static, keep it as a Server
Component and isolate the interactive islands in `"use client"` sub-components.

---

### 9. Add the page metadata

```tsx
export const metadata = {
  title: 'Page Title',
  description: 'Page description for SEO',
}
```

---

## Expected output

- A list of the sections and components identified (steps 1–3).
- The missing shadcn components installed (step 4).
- The page created at `/app/[page-name]/page.tsx` (step 5).
- A responsive layout matching the design (step 7).
- Interactive elements working (step 8).
- Metadata configured (step 9).

---

## Example analysis

For a project management screenshot:

**Sections identified:**

1. Left sidebar — Navigation and project info.
2. Center panel — Chat/conversation with task cards.
3. Right panel — Task list with actions.

**Mapping:**

| Element | Component |
|---|---|
| Sidebar | Sidebar |
| Project dropdown | Select |
| Chat messages | Card |
| Task cards | Card (Header + Content + Footer) |
| "Approve Plan" | Button (default) |
| "Edit Plan" | Button (outline) |
| Task list items | Card or custom list |
| "View Plan" links | Button (ghost) |
| Status badges | Badge |
| Tabs (Preview/Plan/Code) | Tabs |
| Avatar | Avatar |
| Input | Input or Textarea |

**Install command:**

```bash
npx shadcn@latest add sidebar card button badge tabs avatar input select
```

---

## Notes

- **Works with any image** — a rough Figma, screenshots or mockups.
- **Visual analysis first** — identify patterns before mapping.
- **Use the shadcn MCP** to validate availability and get install commands.
- **CSS variables** for every color (defined in `globals.css`).
- **Mobile-first** — think about responsiveness from the start.
- **Import from the design system first** — only install from shadcn if there
  really is no equivalent in `/auis/styleguide/components/`.
- For components that will be reused on other pages, consider going through
  the `design-system-new-component` skill to create a showcase and register it
  in the styleguide navigation.
