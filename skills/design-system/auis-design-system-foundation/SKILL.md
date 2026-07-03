---
name: auis-design-system-foundation
description: >
  Bootstrap or update the Auis design system foundation from a visual
  reference. This is the only skill allowed to create or change tokens.
---

# Auis — Design System Foundation

Use this skill only when the user explicitly asks to create or revise the
foundation/tokens of the design system.

`AGENTS.md` is the source of truth. If anything here conflicts with it, follow
`AGENTS.md`.

## Scope

This skill may update:

- `app/globals.css` token definitions (`@theme`, `:root`, dark mode)
- foundation pages under `app/auis/styleguide/foundation/`
- styleguide navigation for foundation pages
- token usage documentation

This skill must not create Playground/quarantine areas. This repo has no
styleguide Playground.

## Workflow

1. Read `AGENTS.md`.
2. Identify the reference source and current foundation pages.
3. Audit existing tokens before adding or changing anything.
4. Classify token changes:
   - safe: additive aliases or documentation sync
   - needs review: color scale, type scale, radius, motion changes
   - breaking: removal or rename of tokens in use
5. Apply only safe changes without approval.
6. For risky changes, report the delta and wait for approval.
7. Keep `@theme` and `:root` channels in sync.
8. Validate with `npm run typecheck`, focused lint, and visual checks only when
   the changed foundation page needs them.

## Output

Report:

- tokens added/changed/left untouched
- foundation pages updated
- risky changes skipped
- validations run
