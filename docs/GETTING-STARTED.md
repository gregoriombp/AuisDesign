# Getting started with Auis

This guide takes you from `git clone` to a working design system built by your AI agent. It assumes you have **Node.js ≥ 20** and one of: **Claude Code**, **Codex**, or **Cursor**.

## 1. Install and run

```bash
git clone https://github.com/gregoriombp/auis.git my-product
cd my-product
npm install        # postinstall generates .claude/skills + .agents/skills
npm run dev        # http://127.0.0.1:3000
```

Open `/auis/styleguide`. It will be mostly empty — that's correct. Auis ships **de-branded**: neutral tokens, empty component catalog, zeroed navigation. Your product fills it.

### Known state of this snapshot

The engine was extracted from a private product; it **compiles clean** (`typecheck`, `lint`, `build` all pass) but some content was deliberately emptied:

- `app/auis/projects/_data/projects.ts`, `app/auis/ux-flow/_data/flow-meta.ts`, `app/auis/ux-flow/[slug]/flow-data.ts` are **empty stubs** — galleries render empty until skills populate them.
- The inline sub-flow loader registry (`app/auis/styleguide/ux-flows/_components/flow-subflow.tsx`) is empty — register your flows there as you create them.
- `app/globals.css` carries some origin-product animations; harmless, prune at will (but never hand-edit tokens — see step 3).
- Two React 19 hooks lint rules are temporarily downgraded to warnings (see `eslint.config.mjs` TODO).

## 2. Point your agent at the rulebook

Everything an agent must know is in [`AGENTS.md`](../AGENTS.md). Claude Code discovers skills via `.claude/skills/`, Codex/Cursor via `.agents/skills/` — both are generated from `skills/` by `npm run skills:sync` (runs automatically on install and `dev`).

Fill in [`PRODUCT_CONTEXT.md`](../PRODUCT_CONTEXT.md) with your product's voice and vocabulary so the writing skills (`auis-ux-writing`) sound like you.

## 3. Build the foundation (tokens)

Give your agent a visual reference — a screenshot of a product you admire, a Figma URL, a Dribbble/Behance/Mobbin capture — and run:

```
/auis-foundation <reference>
```

The skill extracts colors, typography, spacing, radius, and shadows into design tokens in `app/globals.css`, and scaffolds the styleguide foundations pages.

**Rule: tokens are sacred.** `auis-foundation` (and `auis-foundation-update` for increments) are the *only* things allowed to create or change tokens. Nothing else — human or agent — hardcodes `#hex` or `w-[37px]`.

## 4. Add components

```
/auis-component Button
/auis-component Card
/auis-component Dialog
```

Each run: checks the shadcn registry first → installs/wraps the primitive as an `Au*` component (`components/ui/AuButton.tsx`) → creates a showcase page under `/auis/styleguide/components/au-button` → registers it in `navigation.ts`. Reuse > extend > create, always.

## 5. Build pages

```
/auis-page <screenshot | Figma URL | written description>
```

The agent maps every visual element to your existing `Au*` components first, falls back to shadcn primitives, and ensures anything new is also documented in the styleguide. Feature-specific pieces stay local in `_components/`.

## 6. Design flows

```
/auis-flow <feature description>          # FigJam-convention flow board
/auis-create-ux-flow <steps or brief>     # navigable flow page in the styleguide
```

Flows are React pages with structured nodes/edges under `app/auis/styleguide/ux-flows/[slug]/`, cross-linked to real routes and files.

## 7. Review loop

```bash
npm run review-bridge:install   # once
npm run dev:bridge              # Next + review bridge on 127.0.0.1:9878
```

1. Browse your app, enter **Review Mode**, drop pin comments on anything ("this spacing is off", "wrong icon", "rewrite this empty state").
2. Comments land in a local queue (dashboard at `/auis/review-bridge`).
3. Your agent runs `/auis-review-bridge-solve` — it pulls the queue, applies scoped fixes, and moves items to *in review*.
4. You approve or reject each result from the inbox at `/auis/styleguide/review`.

There is also an adversarial reviewer: `/auis-review-bridge-germano-audit` unleashes a hyper-critical UX persona on a route and files its complaints into the same queue.

## 8. Audit

```
/auis-audit
```

Scans the repo for every component that's used but missing from the styleguide, and can create the missing showcase stubs. Run it periodically — it keeps the styleguide honest.

## 9. Verify

```bash
npm run typecheck && npm run lint && npm run build && npm run ds:check
```

`ds:check` reports design-system debt (hardcoded values, hand-rolled overlays) so you can feed it back into the review loop.

---

## The mental model in one paragraph

The design system is not documentation *about* the product — it **is** the product's UI layer, rendered live. Agents are the hands; skills are the contracts that keep those hands honest; Review Mode is how you direct them without writing prompts; and the styleguide is the ledger where every reusable piece must be registered. Once the loop is running, "design → build → review → ship" happens in one place: the repo.

Questions → open an issue. Deeper internals → [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`component-map.md`](component-map.md).
