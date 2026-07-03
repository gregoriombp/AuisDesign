---
name: auis-design-system-audit
description: >
  Audit the Auis Auis design system for internal consistency across
  tokens, components, showcases, navigation, and page usage.
---

# Auis — Design System Audit

Use this skill to find and fix inconsistencies in the design system.

`AGENTS.md` is the source of truth. If anything here conflicts with it, follow
`AGENTS.md`.

## Scope

Audit:

- `app/globals.css`
- `components/ui/Au*.tsx`
- lowercase shadcn primitives in `components/ui/*.tsx`
- legacy root components in `components/*.tsx`
- showcases under `app/auis/styleguide/components/`
- `app/auis/styleguide/navigation.ts`
- product pages that import DS components

Do not audit `.next/`, `.agents/`, `.claude/worktrees/`, `node_modules/`,
`review-bridge/data/`, or `flow-bridge/data/`.

This repo has no DS Playground/quarantine area. Do not create or recommend one.

## Checks

1. Tokens:
   - no hardcoded hex colors or arbitrary Tailwind values
   - used variables exist in `app/globals.css`
   - `@theme` and `:root` channels stay aligned
2. Components:
   - new DS components are `Au*`
   - existing `Au*` components preserve their public props
   - product icons use `Icon.tsx`
   - shadcn primitives are wrapped before product use
3. Showcases:
   - each official component has a relevant showcase or family hub
   - family children are grouped under parent nav entries
   - showcase links resolve
4. Navigation:
   - no broken hrefs
   - no duplicate top-level entries for family members
5. Pages:
   - product pages import wrappers/components, not showcase code
   - no new DS-like inline component is hidden inside a page without reason

## Workflow

1. Read `AGENTS.md`.
2. Run targeted `rg`/file checks first; avoid broad generated directories.
3. Apply safe doc/nav/import fixes directly.
4. Do not delete tokens/components without usage checks.
5. Validate with `npm run typecheck` and focused lint for touched files.

## Output

Report:

- token issues
- component/showcase/nav issues
- page import issues
- fixes applied
- remaining risks
- validations run
