---
name: setup-design-system-from-reference
description: >
  [INACTIVE in this repo — do not trigger.] Initial design-system bootstrap from a
  reference image. This repo is already set up — do not re-bootstrap. To change tokens
  or foundation use auis-design-system-foundation. Kept only as a record of the
  Auis initial setup. See AGENTS.md.
---

# Design System Setup — Reference Image

This skill takes **a reference image** (a screenshot from Dribbble,
Behance, Mobbin, or any visual inspiration) and sets up a
**Next.js + shadcn/ui** project with an `/auis/styleguide` route documenting the
extracted/inferred tokens.

> **Different from the `setup-design-system-from-claude-design` skill:** here there
> is no bundle and no ready-made components. Tokens are extracted from the image and the
> components are installed via `shadcn add` (step 5.1).

---

## Input

An image (PNG, JPG, WebP). It can be:

- A screenshot from Dribbble/Behance/Mobbin.
- A screen grab of a real product.
- A Figma mockup exported as an image.
- A photograph of printed graphic material.

If the user does not attach an image, **ask** before continuing.

---

## Workflow

### 1. Analyze the design

Examine the image and identify/infer:

**Colors:**
- Primary / brand color → full scale (50–900+).
- Neutral/grey colors → full scale (50–900+).
- Semantic colors (success, error, warning, info) — if visible.
- Background and surface.
- Border colors.
- Any other colors present.

**Typography:**
- Font family (sans-serif, serif, monospace, etc.). When there is no obvious
  clue, suggest the closest Google Font and mark it as an inference.
- Heading sizes and weights.
- Body / label / caption sizes.
- Other details (line-height, letter-spacing) if inferable.

**Spacing & Radius:**
- Spacing rhythm (tight, normal, relaxed).
- Border radius style (sharp, rounded, pill).

**Shadows:**
- Shadow style (none, subtle, prominent).

> Whenever you are inferring (not measuring), mark the token with **(inferred)**
> in the final summary so the user can adjust it.

---

### 2. Initialize shadcn

```bash
npx shadcn@latest init
```

When prompted:

- Style: **Default**
- Base color: **Neutral** (we will override it with our tokens)
- CSS variables: **Yes**

---

### 3. Generate and apply `globals.css`

Replace `/app/globals.css` with the extracted tokens:

```css
@import "tailwindcss";

:root {
  /* === BASE === */
  --background: [extracted];
  --foreground: [extracted];

  /* === CARD === */
  --card: [extracted];
  --card-foreground: [extracted];

  /* === POPOVER / DROPDOWN / TOOLTIP === */
  --popover: [same as card, or white];
  --popover-foreground: [same as card-foreground];

  /* === PRIMARY === */
  --primary: [extracted];
  --primary-foreground: [white or dark, based on contrast];

  /* === SECONDARY === */
  --secondary: [light grey or a muted version];
  --secondary-foreground: [dark text];

  /* === MUTED === */
  --muted: [light grey background];
  --muted-foreground: [medium grey text];

  /* === ACCENT === */
  --accent: [same as secondary, or a light tint];
  --accent-foreground: [dark text];

  /* === DESTRUCTIVE === */
  --destructive: [red/error];
  --destructive-foreground: [white];

  /* === BORDERS & INPUTS === */
  --border: [extracted];
  --input: [a slightly darker border];
  --ring: [primary, for focus];

  /* === BORDER RADIUS === */
  --radius: [extracted, e.g. 0.5rem];

  /* === CHART COLORS === */
  --chart-1: [primary];
  --chart-2: [complementary];
  --chart-3: [variation];
  --chart-4: [variation];
  --chart-5: [variation];

  /* === SIDEBAR === */
  --sidebar: [sidebar background];
  --sidebar-foreground: [sidebar text];
  --sidebar-primary: [primary];
  --sidebar-primary-foreground: [white];
  --sidebar-accent: [accent];
  --sidebar-accent-foreground: [dark text];
  --sidebar-border: [border];
  --sidebar-ring: [primary];

  /* === CUSTOM SEMANTIC COLORS === */
  --success: [green];
  --success-foreground: [white];
  --warning: [yellow/orange];
  --warning-foreground: [dark for contrast];
  --info: [blue];
  --info-foreground: [white];
}

.dark {
  /* Values inverted for dark mode */
  --background: [dark background];
  --foreground: [light text];
  /* ... remaining variables */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: [extracted], sans-serif;
}
```

---

### 4. Install the recommended font

If a Google Font is compatible, add it in `/app/layout.tsx`:

```tsx
import { Inter } from 'next/font/google'  // or the recommended font

const font = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={font.className}>{children}</body>
    </html>
  )
}
```

---

### 5. Install demo components

Since there is no bundle here, we install shadcn components directly so we can
demonstrate the tokens in the styleguide:

```bash
npx shadcn@latest add button card badge alert radio-group
```

> Add more components (input, dialog, tabs, etc.) if the visual
> reference clearly requires it.

---

### 6. Create the styleguide navigation config

`/app/auis/styleguide/navigation.ts`:

```ts
export interface NavItem {
  name: string
  href: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    title: "Foundation",
    items: [
      { name: "Design Tokens", href: "/auis/styleguide" },
    ]
  },
  {
    title: "Components",
    items: [
      // Added by Prompt 2 / by later skills
    ]
  }
]
```

---

### 7. Create the styleguide layout with a sidebar

`/app/auis/styleguide/layout.tsx`:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { navigation } from "./navigation"

export default function StyleguideLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-card p-6 flex flex-col gap-6 fixed top-0 left-0 h-screen overflow-y-auto">
        <div>
          <Link href="/auis/styleguide" className="text-xl font-bold">
            Design System
          </Link>
        </div>

        <nav className="flex flex-col gap-6">
          {navigation.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                {section.title}
              </h3>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "block px-3 py-2 rounded-md text-sm transition-colors",
                        pathname === item.href
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 ml-64 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

---

### 8. Create the main styleguide page

`/app/auis/styleguide/page.tsx` — displays **every token** on a single page:

- **Color palette** — swatches with the CSS variable name.
- **Primary scale** — 50 to 900.
- **Grey scale** — 50 to 900.
- **Semantic colors** — success, warning, error, info.
- **Typography** — heading and body samples.
- **Border radius** — examples of each size.
- **Shadows** — examples.
- **Components** — a preview of Button, Card, Badge, Alert, Radio Group using
  the tokens.
- **Dark mode toggle** — a preview of both themes.

> **Important:** include any additional token inferred from the image that is
> not in the list above.

---

## Resulting directory structure

```
app/
└── auis/
    └── styleguide/
        ├── layout.tsx           # Sidebar nav (step 7)
        ├── navigation.ts        # Nav config (step 6)
        ├── page.tsx             # All tokens (step 8)
        └── components/
            └── [name]/
                └── page.tsx     # Added by later skills
```

---

## Expected output

- shadcn initialized.
- `/app/globals.css` with the tokens extracted from the image.
- The font installed in `/app/layout.tsx`.
- Demo components installed (button, card, badge, alert, radio-group).
- A navigable styleguide:
  - `/app/auis/styleguide/layout.tsx`
  - `/app/auis/styleguide/navigation.ts`
  - `/app/auis/styleguide/page.tsx`
- Ready for the next prompts (components, pages).

---

## Design summary (deliver at the end)

- **Primary color:** [hex and name]
- **Font:** [name]
- **Style:** [e.g. "Modern minimal", "Bold colorful", "Soft friendly"]
- **Border radius:** [e.g. "Rounded 8px", "Sharp", "Pill"]
- **Overall feel:** [brief description]
- **Tokens marked as (inferred):** [list of what came from inference, not
  from direct measurement — for the user to validate]

---

## Notes

- If anything in the image is ambiguous, **ask** before proceeding.
- **Never** use a shadcn component or token without explicit confirmation from the
  user.
- When in doubt, **do not** pull anything from shadcn — ask first.
