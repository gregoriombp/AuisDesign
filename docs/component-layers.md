# Design system layers — the canonical taxonomy

> Source of truth for the **classification** of every component in the Auis DS.
> Sibling of [`styleguide-page-structure.md`](./styleguide-page-structure.md) (which
> defines the *structure* of each page). Here we define which **layer** each piece
> lives in within the styleguide sidebar (`app/auis/styleguide/navigation.ts`).

This is the 2026-05 version.

## Why it exists

The per-component documentation is already strong. What was missing was **taxonomy**: a dev
glancing at the sidebar couldn't tell a reusable brick (`Buttons`) from a one-off
business-screen piece (`WhatsApp panel`) — both sat side by side in a single
"Components" section with ~55 items in alphabetical order.

The sidebar now reflects the design system's **abstraction pyramid**. Reading top to
bottom, the dev learns the hierarchy: from the most fundamental and reusable (base) to the
most specific and product-bound (top).

```
┌─────────────────────────────────────────────────────────────┐
│  Domain       ← only makes sense in Auis (agent, billing)   │  + specific
│  Patterns     ← a whole flow/region, still generic          │
│  Components   ← composes primitives, business-agnostic      │
│  Primitives   ← 1-purpose brick, no domain                  │  + fundamental
│  Foundations  ← tokens: color, typography, spacing, motion… │  (base, not a component)
└─────────────────────────────────────────────────────────────┘
```

**Dependency rule:** each layer depends only on the layers **below** it, never on the
ones above. `Buttons` (primitive) never imports an `Integration card` (domain); an
`Integration card` is free to use `Buttons`, `Avatar`, `Pills`. That is what keeps the base
stable — touching a primitive propagates to everyone; touching a domain piece keeps the
damage local.

## The 4 layers (the classification yardstick)

| Layer | Key question | Business-aware? | Examples |
|---|---|---|---|
| **Primitives** | Is it a single-purpose brick, made only of tokens + HTML/Radix? | No | Buttons, Inputs, Select, Checkbox, Avatar, Pills, Toast, Skeleton |
| **Components** | Does it combine primitives into a generic block, reusable in any product? | No | Cards, Modals, Sheet, Table, Nav rail, Page header, Stat card |
| **Patterns** | Does it orchestrate a whole flow or screen region, but stay generic? | A little | Onboarding shell, Welcome modal, Connect modal, Password setup |
| **Domain** | Is it tied to an Auis business concept (agent, integration, billing, brand)? | Yes | Agent visuals, Specialists pair, Integration card, WhatsApp panel |

### Tie-break rules

1. **If it would stop making sense in a product other than Auis → it's Domain.**
   (wins over the other layers)
2. **In doubt between two adjacent layers → pick the lower one** (more
   fundamental / more reusable) and record why here.
3. Guiding question: *"does it compose other DS components?"* No → Primitive. Yes and
   generic → Component. Yes and multi-step/region → Pattern. Yes but bound to the
   business → Domain.

## I created a new component — which layer does it go in?

```
Does it only make sense inside Auis (agent, integration, billing, brand)?
   └─ yes → Domain
   └─ no  → Is it a whole flow/region (multi-step)?
              └─ yes → Patterns
              └─ no  → Does it compose other DS components?
                         └─ yes → Components
                         └─ no  → Primitives
```

Register the component in `navigation.ts` under its layer's section, in alphabetical
order. **No `href` changes** when it moves layer — the grouping is navigation
governance only.

When a family has more than one concrete item, use a parent item with
`children` instead of creating several top-level entries. The parent item points at the
canonical hub; the children point at technical subpages or anchors inside the
hub. Current examples:

- `Tables` → `AuTable`, `Data table`, `Members table`
- `Modals and dialogs` → `AuModal`, `Connect modal`, `Contact channel modal`,
  `Welcome modal`, `Add integration modal`
- `Sheets and drawers` → `AuSheet`, `Template builder sheet`
- `Agent visuals` → `Agent Core`, `User Agent`, `Cortex`

## Current mapping (audit)

Mirrors `app/auis/styleguide/navigation.ts` — check the nav for the live inventory (the count changes; we don't pin a number here).

The inventory by layer lives in the **Primitives / Components / Patterns /
Domain** sections of [`navigation.ts`](../app/auis/styleguide/navigation.ts). We
deliberately don't duplicate the list here — it would fall behind with every new
component. For the classification of each piece, read the 4-layer yardstick above and the
revised boundaries below.

### Revised boundaries (2026-05)

Debatable items, resolved by applying tie-break #1 — *"only makes sense in
Auis"*:

- **Dot tunnel** → *Components* (was Domain). Decorative visual with no business
  logic; it makes sense in any product, so it is not Domain.
- **Payment method card** + **Card brand** → *Components*, together (Payment method
  card was Domain). A brand chip and a saved card are generic payment UI —
  any SaaS with billing uses them; they are not a concept exclusive to Auis.
- **Empty** / **Alerts** → *Primitives*. They compose sub-parts, but have a single
  feedback purpose; they stay in the base for reuse.

Result: **Domain** keeps only the unmistakably Auis — agents
(Specialists pair, Agent visuals), integrations (Integration card, Brand logo,
WhatsApp panel), and commercial (Additional plan banner).

## Scope of this phase

The physical `components/ui/` folder stays **flat on purpose** — the layer lives in
**navigation and governance**, not in the filesystem. Moving ~78 files into subfolders
would break hundreds of imports for marginal gain. If a folder migration is ever
wanted, it follows exactly this mapping as its script.

Out of scope (decided): moving files, creating barrel exports, renaming
components.
