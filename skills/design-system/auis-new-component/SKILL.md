---
name: auis-new-component
description: >
  Add or update an Auis Auis design system component using existing
  tokens, shadcn primitives where appropriate, a showcase page, and navigation.
---

# Auis — New Component

Use this skill when adding a design system component or touching an existing
`Au*` component.

`AGENTS.md` is the source of truth. If anything here conflicts with it, follow
`AGENTS.md`.

## Hard Rules

- New design system components are `Au*` in `components/ui/Au[Name].tsx`.
- New showcases live at `app/auis/styleguide/components/au-[name]/page.tsx`.
- Existing legacy showcase folders must not be renamed.
- Do not create `components/playground`, styleguide Playground routes, or
  unprefixed DS components.
- Do not add tokens. Only `auis-design-system-foundation` can do that.
- Do not use arbitrary Tailwind values for color, spacing, radius, shadow, or
  typography.
- Use Material Symbols via `components/ui/Icon.tsx` for product icons.

## Pre-flight (mandatory — before writing any code)

1. **Open `docs/component-map.md`** and search by intent. What you need probably
   already exists; the map names it and the near-duplicates to avoid (which card,
   which table, the Fluid caveat).
2. **Reuse > extend > create.** If something is close, extend or wrap it. Build new
   only when nothing fits and the semantics are genuinely new — never duplicate
   under a new name.
3. **Compose from primitives.** The new piece is a *recipe* of existing `Au*`
   primitives (`AuButton`, `Icon`, `AuInput`, `AuAvatar`, `AuPill`…) — don't
   re-implement a button/input/icon inline.
4. **Icons through `Icon`** (Material Symbols). Never a raw `<svg>` or hardcoded
   glyph; `react-icons` only for brand marks.
5. **Tokens only** — the semantic tokens in `docs/component-map.md` (`bg-raised`,
   `text-fg-primary`, `border-subtle`, `rounded-lg`, `shadow-sm`…). No `#hex`, no
   `w-[37px]`, no arbitrary values. Missing token → report it, don't create it.
6. When done, run `npm run ds:check` and fix what it flags. Register the new
   component in `docs/component-map.md`.

## Workflow

1. Read `AGENTS.md`.
2. Check existing options before writing (see Pre-flight):
   - `components/ui/Au*`
   - legacy `components/*`
   - lowercase shadcn primitives in `components/ui/*.tsx`
3. If a shadcn primitive is appropriate and missing, install it with
   `npx shadcn@latest add <name>`.
4. Create or update `components/ui/Au[Name].tsx` as the brand wrapper.
   Preserve existing props when touching old components.
5. Add or update the showcase:
   - New component: `app/auis/styleguide/components/au-[name]/page.tsx`
   - Family component: add it under the existing family hub and show it inline.
6. Update `app/auis/styleguide/navigation.ts`.
7. Migrate imports only where needed for the requested change.
8. Validate with focused lint and `npm run typecheck`.

## Output

Report:

- files changed
- primitive installed or reused
- showcase/nav status
- validations run
- any token that was needed but not created
