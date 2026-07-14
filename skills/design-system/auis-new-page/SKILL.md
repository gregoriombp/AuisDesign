---
name: auis-new-page
description: >
  Build or rework a product page in this Next.js app using the Auis design
  system, existing components, existing tokens, and desktop-only constraints.
---

# Auis — New Page

Use this skill for product pages, feature screens, and substantial page reworks.

`AGENTS.md` is the source of truth. If anything here conflicts with it, follow
`AGENTS.md`.

## Hard Rules

- Build the usable product screen, not a marketing/landing placeholder.
- Reuse `components/ui/Au*` and feature modules before creating anything new.
- Do not create Playground/quarantine pages or `components/playground`.
- Do not create tokens or arbitrary Tailwind values.
- Desktop-only: do not add mobile/tablet variants unless explicitly requested.
- Product icons use `components/ui/Icon.tsx`.
- App-feature modules under `components/` (e.g. `components/auth/`) consume `Au*`;
  they are not DS components and should not be renamed to `Au*`.

## Pre-flight (mandatory — before writing the page)

1. **Open `docs/component-map.md`** and map each element of the screen to an
   existing `Au*` component (or feature module) before writing anything.
2. **Reuse first — a page is assembly, not new primitives.** Compose from existing
   `Au*` components; don't inline one-off buttons/cards/inputs.
3. **Tokens only** (`docs/component-map.md` → token vocabulary): no `#hex`, no
   arbitrary values. **Icons through `Icon`**, never a raw `<svg>`.
4. If a reusable DS component is genuinely missing, stop and create it via
   `auis-new-component` first — don't inline a one-off in the page.
5. When done, run `npm run ds:check`.

## Workflow

1. Read `AGENTS.md` and, for product voice, the relevant section of
   `PRODUCT_CONTEXT.md`.
2. Locate the target route and adjacent `_components` or feature modules.
3. Inspect existing `Au*` components and local patterns before adding code.
4. Implement the page with stable desktop layout, real states, and complete
   controls expected by the workflow.
5. If a reusable DS component is truly missing, stop and use
   `auis-new-component` for that component first.
6. Keep copy in product voice: direct, enterprise, resolving the user's job.
7. Validate with focused lint and `npm run typecheck`. Use Playwright only when
   visual verification is genuinely needed.

## Output

Report:

- route/page changed
- existing components reused
- new components created, if any
- validations run
- any deferred DS gap
