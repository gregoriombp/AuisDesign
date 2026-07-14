---
name: auis-foundation-update
description: >
  INCREMENTALLY updates the foundation tokens of the Auis design system in
  app/globals.css (color, typography, spacing, radius, shadow, motion) — additive,
  reviewed, WITHOUT rebootstrapping and WITHOUT rewriting the file. Keeps the
  @theme (utility) and :root (var) + dark channels in sync. Use when the user asks
  to "add a token", extend the type/spacing scale, "create a token for X",
  tokenize a set of values, fill in the missing steps of a scale, or update the
  foundation without redoing the design system. This is NOT bootstrapping from a
  visual reference — for that, use auis-design-system-foundation.
---

# Auis — Foundation Update (incremental)

Use this to ADD or ADJUST tokens in a foundation that **already exists** — never
to rebootstrap. Sibling of `auis-design-system-foundation` (which bootstraps
from a reference and may rewrite `globals.css`). These two are the only skills
authorized to touch tokens.

`AGENTS.md` is the source of truth. If anything here conflicts with it, follow
`AGENTS.md`.

## Hard rules

- **Never** rewrite/rescaffold `globals.css`. Surgical edits to the token block
  only; don't touch CSS that isn't a token.
- **Additive by default.** Don't remove or rename a token in use (that's breaking).
- **Two channels in sync:** `@theme` (generates the Tailwind v4 utility classes)
  and the mirror in `:root` / `--au-*` (consumed via `var()`), including the dark
  mode override. A new token goes into both when it applies to both.
- Never create a color outside the 10 `au-*` families; no loose hex values.
- A new token goes into the vocabulary in `docs/component-map.md` and, when it
  makes sense, gets an example on the matching foundation page.

## Workflow

1. Read `AGENTS.md` and the current token block in `app/globals.css`.
2. **Audit what already exists** — don't duplicate a token that already covers the
   value, and check whether a semantic system is already there (e.g. the
   `body-*`/`display-*`/`caption`/`au-eyebrow` utilities) before creating a
   parallel one.
3. **Classify each change:**
   - **safe** (apply directly): adding a new token that changes nothing existing;
     an alias; docs. Zero visual change.
   - **needs review** (propose + wait for an ok): changing the value of a token in
     use, or redefining a scale (type/color/radius) — it has visual impact.
   - **breaking** (only with an explicit ok): removing/renaming a token in use.
4. Apply the **safe** ones; for needs-review/breaking, show the delta and wait for
   approval.
5. Sync `@theme` + `:root` + dark.
6. Validate: `npm run typecheck`, `npm run ds:check`, and a visual check
   (Playwright) whenever a value **in use** changes.
7. Update `docs/component-map.md` (token vocabulary).

## Output

- tokens added / changed / untouched (with px or value)
- the classification of each (safe / needs review / breaking)
- risky changes skipped (awaiting an ok)
- validations run
