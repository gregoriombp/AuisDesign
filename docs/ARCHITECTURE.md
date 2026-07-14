# Architecture — Auis

How the pieces fit together. For code conventions (`Au` prefix, tokens, component-lookup order) the source of truth is [`../AGENTS.md`](../AGENTS.md); for the product's mental model, [`../AUIS.md`](../AUIS.md).

## Overview

Auis is a **Next.js product** (not documentation): the design system runs alongside the app, the screens are navigable, the flows are code, and comments become a work queue for agents. Four pillars:

1. **Design system as code** — primitives in `components/ui/`, tokens in `app/globals.css`, documented in the styleguide.
2. **Builder by composition** — new screens start from existing components; a reusable pattern becomes an official component.
3. **Review/Edit as a queue** — comments and visual edits carry route/target context, so agents resolve them with enough context.
4. **Skills as an execution contract** — agents follow the repo's rules via skills instead of inventing structure.

## Surfaces (routes)

| Surface | Route | Role |
|---|---|---|
| Styleguide | `/auis/styleguide` | Living design system (zeroed — ready to populate) |
| Review Bridge (dashboard) | `/auis/review-bridge` | Local queue of comments + suggestions |
| Review Inbox | `/auis/styleguide/review` | Inbox for Review Mode comments |
| UX Flow | `/auis/ux-flow` | Flow viewer/hub as a prototype |
| Projects | `/auis/projects` | Workbench for imported screens/projects |
| Design System Tweaks | `/auis/design-system-tweaks` | Controlled token experiments |

## Component layers

Dependency is **one-way** (upper layers consume lower ones — see [`component-layers.md`](component-layers.md)):

- **Builder chrome** — `components/auis-review/` (canvas, pins, popovers, command menu), `components/auis-edit/` (toolbar, inspector, controls), `components/auis/` (AuisDot, ModeFamilySwitch).
- **Primitives** — `components/ui/` (24 `.tsx`: **21** `Au*` + `Icon.tsx` + two shadcn primitives, `badge.tsx` and `popover.tsx`): the subset the chrome imports (`AuButton`, `AuModal`, `AuSheet`, `AuDropdownMenu`, `AuInput`, `Icon`, …), plus the Review Bridge's own surfaces (`AuMentionMenu`/`AuMentionChip`) and Auis's mark (`AuLogo`). The origin product's full catalog was **not** brought over.
- **State/logic** — `lib/auis-review/`, `lib/auis-edit/`, `lib/hooks/` (Zustand stores, element anchoring, command parsing, voice, AI assist).

## Bridges (runtime)

```
Review Mode (UI)  ──creates comment──▶  /api/review-bridge/*  ──▶  review-bridge/data/*.json
                                                  │
   agent (skill auis-review-bridge-solve) reads the queue  ◀───┘
                                                  │
                     resolves → marks in_review → you approve/reject in the inbox
```

- **Review Bridge** — **serverless** (same-origin routes `app/api/review-bridge/*`, the `npm run dev` default) or **opt-in legacy Express** (`review-bridge/`, `npm run dev:bridge`, `127.0.0.1:9878`). Both write the same JSONs with atomic writes.
- **Flow Bridge** — suggestions via `/api/flow-suggestions` → `flow-bridge/data/`.
- **Edit Bridge** — non-destructive "ops" via `/api/page-edits` → `page-editor/data/`; `auis-edit-bridge-solve` materializes them into code.
- **Project Builds** — `/api/project-builds` feeds `auis-project-build-solve`.
- **Review AI** — `/api/review/transcribe` (voice → text) and `/api/review/suggest` (comment assist) give Review Mode its AI help. Both are server-only proxies to OpenAI, keyed by `OPENAI_API_KEY`. ⚠️ call an LLM.

The `*/data/` directories are **runtime state** (gitignored), not source code.

## Skills system

```
skills/<cap>/<name>/SKILL.md            (Claude — canonical)
skills/<cap>/<name>/SKILL.codex.md      (Codex — only when it diverges; 13 cases)
        │  npm run skills:catalog                 │  npm run skills:sync
        ▼                                         ▼
skills/registry.json + CATALOG.md        .claude/skills/<name>/   (Claude Code)
                                         .agents/skills/<name>/   (Codex/Cursor; applies SKILL.codex.md)
```

- **Capabilities:** Design System (9), UX Flows (7), Bridges (8), Build & Handoff (2), Content (1), Support (9).
- **Platforms:** 34 on Claude+Codex, 2 Claude-only (`auis-review-bridge-dispatch`, `auis-edit-bridge-solve`).
- **Origin:** 6 generic (Cowork, "zeroed" core) + 21 repo-local (rich variants: bridges, ux-flow, audit) + 9 support.
- `scripts/skills-sync.mjs` does a manual recursive copy (avoids permission-mode problems on restricted mounts) and applies the Codex variant where one exists.

## Stack

Next.js (App Router) · React 19 · **Tailwind v4** (`@theme` + `:root` in `globals.css`, no `tailwind.config`) · shadcn/ui (lowercase primitives + `Au*` wrapper) · Material Symbols via `components/ui/Icon.tsx` · Zustand · `@xyflow/react` (flows). MCPs in `.mcp.json` (figma, shadcn, playwright, mobbin).

## Branding & theming

Auis ships **no brand assets for your product** — it is a builder, and your product doesn't exist yet. The one mark in `public/` is `auis-wordmark.svg`: Auis's own, rendered by `AuLogo` in the builder chrome (`/auis/*`). No logo registry, no illustration set, no integration icons. `AuLogo` is the only component allowed to render a mark, and it renders *Auis's* — a component in `components/ui/` must never hardcode one, because it lands in *your* product. The tokens sit on a neutral baseline; theming for your own product is the `auis-foundation` skill.
