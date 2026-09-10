# Architecture — Auis

How the pieces fit together. For code conventions (`Au` prefix, tokens, component-lookup order) the source of truth is [`../AGENTS.md`](../AGENTS.md); for the product's mental model, [`../AUIS.md`](../AUIS.md).

For the provenance boundary—what was restored from the original private host and
what remains intentionally product-owned—see
[`EXTRACTION-AUDIT.md`](EXTRACTION-AUDIT.md).

## Overview

Auis is a **Next.js product** (not documentation): the design system runs alongside the app, the screens are navigable, the flows are code, and comments become a work queue for agents. Four pillars:

1. **Design system as code** — primitives in `components/ui/`, tokens in `app/globals.css`, documented in the styleguide.
2. **Builder by composition** — new screens start from existing components; a reusable pattern becomes an official component.
3. **Review/Edit/State as modes** — comments and visual edits carry route/target context, so agents resolve them with enough context; screen states are URL params, so every scenario is a deep link.
4. **Skills as an execution contract** — agents follow the repo's rules via skills instead of inventing structure.

## Surfaces (routes)

| Surface | Route | Role |
|---|---|---|
| Welcome | `/auis/welcome` | First-run setup (project name, one-liner, logo) → `/api/setup`; soft-gated from the hub until configured |
| Styleguide | `/auis/styleguide` | Living foundations and component showcases; Layer B grows with the product |
| Review Bridge (dashboard) | `/auis/review-bridge` | Local queue of comments + suggestions |
| Review Inbox | `/auis/styleguide/review` | Inbox for Review Mode comments |
| UX Flow hub | `/auis/ux-flow` | Gallery + sidebar; one page per flow (`/auis/ux-flow/<slug>`) with the editor, comments, suggestions and compiled views |
| State Mode matrix | `/auis/states` | Every registered screen in every URL-driven state; `npm run states:pdf` exports it |
| Projects | `/auis/projects` | Workbench for imported screens/projects |
| Design System Tweaks | `/auis/design-system-tweaks` | Controlled token experiments |
| Roadmap | `/auis/roadmap` | Non-authoritative parking lot for builder ideas |

## Component layers

Dependency is **one-way** (upper layers consume lower ones — see [`component-layers.md`](component-layers.md)):

- **Builder chrome** — `components/auis-review/` (canvas, pins, popovers, command menu), `components/auis-edit/` (toolbar, inspector, controls), `components/auis-states/` (State Mode provider + toolbar), `components/auis/` (AuisDot, ModeFamilySwitch, FlowStateDriver). The root layout mounts Review, Edit, State Mode, the state driver, and the dot globally; the three modes are mutually exclusive.
- **Primitives** — `components/ui/` (30 `.tsx`: **26** `Au*` + `Icon.tsx` + three shadcn primitives, `badge.tsx`, `popover.tsx` and `radio-group.tsx`): the subset the chrome imports (`AuButton`, `AuModal`, `AuSheet`, `AuDropdownMenu`, `AuInput`, `Icon`, …), plus the Review Bridge's own surfaces (`AuMentionMenu`/`AuMentionChip`) and Auis's mark (`AuLogo`). The origin product's full catalog was **not** brought over.
- **State/logic** — `lib/auis-review/`, `lib/auis-edit/`, `lib/auis-states/` (registry, store, `useScreenStateOverride`), `lib/bridge-store/` (fs document store shared by the bridges), `lib/hooks/` (Zustand stores, element anchoring, command parsing, voice, AI assist).

## Bridges (runtime)

```
Review Mode (UI)  ──creates comment──▶  /api/review-bridge/*  ──▶  review-bridge/data/*.json
                                                  │
   agent (auis-review-bridge-solve, or the /loop dispatcher) reads the queue  ◀───┘
                                                  │
                     resolves → marks in_review → you approve/reject in the inbox
```

- **Review Bridge** — **serverless**: same-origin routes `app/api/review-bridge/*` persist to `review-bridge/data/` through `lib/bridge-store` (atomic writes + lock). Roles admin / reviewer / agent are resolved in `_session.ts` (always admin locally; `x-bridge-agent-token` for agents when a deployment enables auth). Agents are `claude`, `codex` and `germano`; the per-agent toggles in the floating dot (Live Response / Auto Construct) gate `/dispatch-queue`.
- **Flow Bridge** — suggestions via `/api/flow-suggestions` → `flow-bridge/data/`, with an integrity layer (base revision/hash, materialization receipts, `409` on a stale base).
- **State Mode API** — `/api/screen-states` exposes `lib/auis-states/registry.ts` to the matrix page and the PDF script.
- **Edit Bridge** — non-destructive "ops" via `/api/page-edits` → `page-editor/data/`; `auis-edit-bridge-solve` materializes them into code.
- **Project Builds** — `/api/project-builds` feeds `auis-project-build-solve`.
- **Brand setup** — the `/auis/welcome` form posts to `/api/setup`, which writes the logo to `public/assets/brand/` and the brand overlay to `app/auis/_data/brand.runtime.json`; `auis-brand` (sequenced by `auis-setup`) materializes that intent into `PRODUCT_CONTEXT.md` and `AuLogo`.
- **Review AI** — `/api/review/transcribe` (voice → text) and `/api/review/suggest` (comment assist) give Review Mode its AI help. Both are server-only proxies to OpenAI, keyed by `OPENAI_API_KEY`, and call an LLM.

The `*/data/` directories are **runtime state** (gitignored), not source code.

## Skills system

```
skills/<cap>/<name>/SKILL.md            (Claude — canonical)
skills/<cap>/<name>/SKILL.codex.md      (Codex — only when it diverges; 10 cases)
        │  npm run skills:catalog                 │  npm run skills:sync
        ▼                                         ▼
skills/registry.json + CATALOG.md        .claude/skills/<name>/   (Claude Code)
                                         .agents/skills/<name>/   (Codex/Cursor; applies SKILL.codex.md)
```

- **Capabilities:** Design System (11), UX Flows (7), Bridges (6), Build & Handoff (3), Content (2), Support (8). **37 total.**
- **Platforms:** 36 on Claude+Codex, 1 Claude-only (`auis-edit-bridge-solve`). Germano runs as a real subagent on both: `.claude/agents/germano.md` and `.codex/agents/germano.toml`.
- **Origin:** 6 generic (Cowork, "zeroed" core) + 23 repo-local (rich variants: onboarding, bridges, ux-flow, states, audit) + 8 support.
- `scripts/skills-sync.mjs` does a manual recursive copy (avoids permission-mode problems on restricted mounts) and applies the Codex variant where one exists.

## Stack

Next.js (App Router) · React 19 · **Tailwind v4** (`@theme` + `:root` in `globals.css`, no `tailwind.config`) · shadcn/ui (lowercase primitives + `Au*` wrapper) · Material Symbols via `components/ui/Icon.tsx` · Zustand · `@xyflow/react` (flows). MCPs in `.mcp.json` (figma, shadcn, playwright, and a UI-pattern reference server).

## Branding & theming

Auis ships **no brand assets for your product** — it is a builder, and your product doesn't exist yet. The one mark that *ships* in `public/` is `auis-wordmark.svg`: Auis's own, rendered by `AuLogo` in the builder chrome (`/auis/*`) as the default. No logo registry, no illustration set, no integration icons. `AuLogo` is the only component allowed to render a mark — and once a user seeds their brand through `/auis/welcome` (→ `/api/setup`, materialized by `auis-brand`), it renders **their** mark instead of Auis's, read server-side from `app/auis/_data/brand.ts` (the runtime overlay is gitignored). A component in `components/ui/` must never hardcode a mark, because it lands in *your* product. The tokens sit on a neutral baseline; theming for your own product is the `auis-foundation` skill.
