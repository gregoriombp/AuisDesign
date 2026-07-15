# Design system layers — the canonical taxonomy

> Source of truth for the **classification** of every component in the Auis DS.
> Sibling of [`styleguide-page-structure.md`](./styleguide-page-structure.md) (which
> defines the *structure* of each page) and of [`component-map.md`](./component-map.md)
> (which tells you *what to import*). Here we define which **layer** each piece
> lives in within the styleguide sidebar (`app/auis/styleguide/navigation.ts`).
>
> **This is a classification yardstick, not an inventory.** It applies to both layers of the
> [component map](./component-map.md): the 22 `Au*` that ship (Layer A — the builder's own UI)
> and, above all, **the components you are about to build** (Layer B). Layer A is registered
> in the styleguide today; this taxonomy also tells you where *your* next component goes.

## Why it exists

Taxonomy: a dev glancing at the sidebar should be able to tell a reusable brick (`AuButton`)
from a piece that only makes sense inside this product (`AuMentionChip`) — without them
sitting side by side in one undifferentiated "Components" list.

The sidebar reflects the design system's **abstraction pyramid**. Reading top to
bottom, the dev learns the hierarchy: from the most fundamental and reusable (base) to the
most specific and product-bound (top).

```
┌─────────────────────────────────────────────────────────────┐
│  Domain       ← only makes sense in Auis (brand, billing)   │  + specific
│  Patterns     ← a whole flow/region, still generic          │
│  Components   ← composes primitives, business-agnostic      │
│  Primitives   ← 1-purpose brick, no domain                  │  + fundamental
│  Foundations  ← tokens: color, typography, spacing, motion… │  (base, not a component)
└─────────────────────────────────────────────────────────────┘
```

**Dependency rule:** each layer depends only on the layers **below** it, never on the
ones above. `AuButton` (primitive) never imports `AuMentionChip` (domain); `AuMentionChip`
is free to use `Icon` and the `badge` primitive — which is exactly what it
does. That is what keeps the base stable: touching a primitive propagates to everyone;
touching a domain piece keeps the damage local.

## The 4 layers (the classification yardstick)

Examples are drawn from what actually ships (Layer A). Your own components (Layer B) classify
the same way.

| Layer | Key question | Business-aware? | Examples that ship |
|---|---|---|---|
| **Primitives** | Is it a single-purpose brick, made only of tokens + HTML/Radix? | No | `AuButton`, `AuInput`/`AuField`, `AuCheckbox`, `AuToggle`, `AuSlider`, `AuPill`, `AuToast`, `AuAlert`, `AuEmpty`, `AuProgress`, `AuTabs`, `AuDropdownMenu`, `AuBreadcrumb`, `Icon` |
| **Components** | Does it combine primitives into a generic block, reusable in any product? | No | `AuCard`, `AuStatCard`, `AuTable`, `AuModal`, `AuSheet`, `AuBreadcrumbsBar` |
| **Patterns** | Does it orchestrate a whole flow or screen region, but stay generic? | A little | *(none ship — this layer is yours to fill: an app shell, an onboarding flow, a multi-step wizard, a settings region)* |
| **Domain** | Is it tied to an Auis concept (Review Bridge, brand)? | Yes | `AuMentionMenu`, `AuMentionChip`, `AuLogo` |

> The **Patterns** row is empty on purpose, and the **Domain** row is Auis's own domain (the
> builder), not your product's. When you build a pricing table, an integration tile, or a
> billing card, those are *your* Domain — they belong in Layer B of the
> [component map](./component-map.md).

### Tie-break rules

1. **If it would stop making sense in a product other than yours → it's Domain.**
   (wins over the other layers)
2. **In doubt between two adjacent layers → pick the lower one** (more
   fundamental / more reusable) and record why here.
3. Guiding question: *"does it compose other DS components?"* No → Primitive. Yes and
   generic → Component. Yes and multi-step/region → Pattern. Yes but bound to the
   business → Domain.

## I created a new component — which layer does it go in?

```
Does it only make sense inside your product (billing, integrations, your domain)?
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
hub.

No family ships with more than one item today — every `Au*` is a single top-level entry. The
pattern is there for when that changes: when your second table variant appears, don't add a
second top-level `Tables` entry — make the first one the hub and hang the variant off it as a
child.

## Current mapping

Mirrors [`navigation.ts`](../app/auis/styleguide/navigation.ts) — check the nav for the live
inventory. We deliberately don't duplicate the list here; it would fall behind with every new
component.

Today the nav registers foundations, all Layer A components, and the Auis builder surfaces.
New Layer B families join the same taxonomy through `auis-component`. For what ships and how
to import it, use [`component-map.md`](./component-map.md) → Layer A.

### Boundary precedents

Debatable calls, resolved by applying tie-break #1 — *"only makes sense in this product"*.
Kept because the reasoning transfers to the calls you'll have to make:

- **Decorative visuals** (a dot tunnel, an animated background) → *Components*, not Domain.
  No business logic; they'd make sense in any product.
- **Generic payment UI** (a saved-card chip, a card-brand mark) → *Components*, not Domain.
  Any SaaS with billing uses them; they aren't exclusive to one product.
- **`AuEmpty` / `AuAlert`** → *Primitives*. They compose sub-parts, but have a single
  feedback purpose; they stay in the base for reuse.

Applied to what ships, that leaves **Domain** holding only the unmistakably-Auis pieces: the
Review Bridge surfaces (`AuMentionMenu`, `AuMentionChip`) and Auis's own mark (`AuLogo`).

## Scope of this phase

The physical `components/ui/` folder stays **flat on purpose** — the layer lives in
**navigation and governance**, not in the filesystem. Splitting 22 files into subfolders
would break every import for marginal gain. If a folder migration is ever wanted, it follows
exactly this mapping as its script.

Out of scope (decided): moving files, creating barrel exports, renaming
components.
