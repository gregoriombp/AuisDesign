---
name: auis-flow
description: >
  Designs a feature's user flow as a FigJam board using the Auis
  convention: every screen becomes a card with name + route + file path +
  status; every transition becomes a labeled connector; every branch becomes a
  diamond; every screen carries a sticky listing its UI states. Names the file
  "Auis Flow — [Product] — [Feature]", scans the repo to mark
  shipped/in-progress/planned screens, and writes "// Flow:" back-reference
  comments at the top of each corresponding page.tsx so code and flow stay
  cross-linked. Use whenever the user asks to "design a user flow", "draw a
  flow", "map navigation", "where should this button lead", "criar FigJam
  desse fluxo", "fluxo dessa feature", "plan the screens for [feature]", or
  hands over a feature description that needs flow design before
  implementation.
---

# Auis — User Flow Designer

Design a feature's user flow in FigJam using the Auis convention, before
or alongside implementation. The flow is the contract that says **which screen
leads where** — the code stays free of navigation metadata, and FigJam stays
the single answer to "what happens when I click this".

> **Prerequisite:** the Auis design system is initialized
> (`auis-foundation` already ran, and `/auis/styleguide` exists).
> This skill writes back-references into real `page.tsx` files, so the project
> structure must exist or be intended to exist.

> **Companion skill:** load `figma-use-figjam` (and `figma-use`) before any
> `use_figma` call. This skill assumes those are loaded. If Figma MCP isn't
> available, it falls back to a Markdown flow spec.

## Input

```txt
Feature name: [FEATURE]                  e.g. "Pipedrive integration"
Product namespace: [PRODUCT]             e.g. "Auis"
Target project: [PROJECT PATH OR CURRENT REPOSITORY]
Description: [WHAT THE FEATURE DOES]     2–4 sentences
Known screens: [LIST OR "DERIVE FROM DESCRIPTION"]
Figma destination: [TEAM / FOLDER NAME OR "ASK"]
```

If any of these are missing, ask before generating. Don't guess the Figma
destination — flows live alongside other Auis flows for the same product
and being in the wrong folder defeats discoverability.

## Non-negotiables

- **File name:** `Auis Flow — [Product] — [Feature]`. No exceptions.
- One FigJam file per feature or jornada. If the feature grows past ~15
  screens, split by sub-jornada and add a macro flow that links to each.
- A screen card is the only thing that represents a screen. **Never draw screen
  mockups inside FigJam.** Mockups live in the prototype (the running app).
- Every card carries: name, route, file path, status
  (`planejada` / `em desenvolvimento` / `em produção`).
- Every transition (edge) carries a trigger label. No bare arrows.
- Every decision is a diamond, with the condition as its label.
- Every screen has a sticky listing UI states. The states are *named*, not drawn.
- Each `page.tsx` corresponding to an `em desenvolvimento` or `em produção`
  card carries `// Flow: <figjam url>` as the first non-import line.

## Workflow

### 1. Inspect the project

Before drawing anything, look at the target repo:

- `/app/[feature]` — existing routes for this feature
- `/auis/styleguide/components` — components the flow will reference for
  state stickies
- the navigation registry (`/app/auis/styleguide/navigation.ts` or the
  app-level nav) for routes already wired
- recent `page.tsx` files in the feature directory — record route, file path,
  and any existing `// Flow:` comment

This determines which screen cards start as `em produção` /
`em desenvolvimento` / `planejada`. A screen with a `page.tsx` that exports
something useful and is reachable from the nav is `em produção`. A `page.tsx`
that exists but is mostly stub/placeholder is `em desenvolvimento`. Anything
not yet on disk is `planejada`.

### 2. Build the screen list

If `Known screens` is given, use it. Otherwise derive screens from the
description by walking the user goal end to end and asking what the user sees
at each step.

Sensible defaults to start from when the user description is thin:

- **Integration feature:** discovery → connection (OAuth or API key) → field
  mapping → initial sync → maintenance (health, reconnect, disconnect)
- **Onboarding feature:** welcome → profile → workspace setup → invite team →
  first task
- **CRUD feature:** list/index → detail → create → edit → delete confirmation
- **Settings feature:** overview → section detail → edit form → confirmation

Never guess silently. If you fall back to a default, say so and confirm before
moving on.

### 3. Map the screens to routes and files

For every screen, propose:

- route (`/integrations/pipedrive/connect`)
- file path (`app/integrations/pipedrive/connect/page.tsx`)
- status — derived from step 1's inspection

Validate proposed routes against the project's navigation registry. If a route
collides with something existing, ask before claiming it.

### 4. Build the transitions

For each pair of screens that connects, write down:

- `from` screen
- `to` screen
- trigger label (button text, form submit, redirect cause)
- condition (only if it's a branch — see step 5)

Triggers are user-visible and human-readable. Good: `clica em "Conectar"`,
`submete o form com sucesso`, `redirect após 3s`. Bad: `onClick handler fires`,
`POST /api/integrations succeeded`. The flow speaks the user's language; the
code translates it.

### 5. Build the decision diamonds

Identify branching points where one trigger leads to different screens
depending on state.

Examples:

- `primeiro acesso?` — sim → onboarding, não → dashboard
- `integração já existe?` — sim → reconnect, não → fresh connect
- `tem permissão de admin?` — sim → settings, não → request access

Each diamond replaces the equivalent `if` statement in code. The code stays
short — `if (firstTime) redirect('/onboarding')` — and the *why* lives in the
diamond. This is the rule that keeps both layers clean.

### 6. Build the state stickies

For each screen, list the UI states that appear on it. Common candidates:

- loading
- empty
- error (note which errors — auth failure, network, validation)
- success
- partial / conflict / waiting / rate-limited (when applicable)

**Don't draw the states.** List them. The drawn version lives in the component
playground at `/auis/styleguide/components/[component-name]`. The sticky
exists so the team can see at a glance which screens have heavy state coverage
and which are happy-path only.

### 7. Generate the FigJam

Use `mcp__Figma__use_figma` (with `figma-use-figjam` already loaded). Create:

1. **Header frame** at the top — feature title, 2-line description, owner.
2. **Screen cards** laid out left-to-right following user progression. Use a
   consistent card template:

   ```
   ┌───────────────────────────┐
   │ [Screen name]             │
   ├───────────────────────────┤
   │ Rota:    /path/to/screen  │
   │ Arquivo: app/.../page.tsx │
   │ Status:  em produção      │
   └───────────────────────────┘
   ```

3. **Decision diamonds** at branch points, with the condition as label.
4. **Transitions** as labeled connectors. Never bare arrows.
5. **State stickies** docked to the right of each card, listing states.
6. **Color coding** by status: green for `em produção`, yellow for
   `em desenvolvimento`, gray for `planejada`. Use Auis brand colors
   when available; otherwise FigJam defaults.

If Figma MCP is **not** connected, stop here. Output a structured Markdown
spec (see "Markdown fallback" below) and tell the user how to populate the
FigJam manually. Don't claim the flow exists when it doesn't.

### 8. Write back-reference comments

For each screen card with status `em produção` or `em desenvolvimento`, find
the corresponding `page.tsx` and prepend:

```tsx
// Flow: https://figma.com/board/[id]/Auis-Flow-[Product]-[Feature]
```

Rules:

- Place it as the first non-import line.
- Skip if an identical line already exists.
- If a `// Flow:` line exists pointing somewhere else, update it instead of
  duplicating.
- Don't add the comment to `planejada` screens — the file doesn't exist yet.
  When `auis-page` later creates the file, it should include the comment.

### 9. Update the macro flow if it exists

If `Auis Flow — [Product] — Macro` exists in the same Figma folder, add
a card linking to this new feature flow. If it doesn't exist and the product
already has 3+ feature flows, propose creating one. A macro flow is a single
board with one card per feature flow plus arrows showing the cross-feature
journeys (e.g., from "Onboarding" to "Integration").

### 10. Validate

Walk the result and confirm:

- every card has name, route, file path, status
- every edge has a trigger
- every diamond has a condition
- every screen has at least one state on its sticky (even if just `success`)
- file name follows the canonical pattern
- back-references in code point at this FigJam, not a stale one

## Markdown fallback (when Figma MCP isn't available)

Output the flow as a Markdown spec the user can paste into Figma manually:

```md
# Auis Flow — [Product] — [Feature]

## Description
[2–4 sentences]

## Screens

### [Screen 1 name]
- Rota: `/path`
- Arquivo: `app/.../page.tsx`
- Status: planejada / em desenvolvimento / em produção
- Estados: loading, empty, error, success

### [Screen 2 name]
...

## Transitions

- [Screen 1] → [Screen 2]: clica em "Conectar"
- [Screen 2] → [Screen 3]: submete o form com sucesso

## Decisions

- `primeiro acesso?` — sim → [Screen A], não → [Screen B]
```

## Output to return

```md
Auis flow complete.

Feature: [feature]
File: Auis Flow — [Product] — [Feature]
URL: [figjam url, or "not created — Figma MCP unavailable"]

Screens:
- [screen] — [route] — [status]

Decisions:
- [condition] — [yes branch] / [no branch]

States listed:
- [screen] — [states]

Back-references written:
- [file path] — added / updated / already present / skipped (planejada)

Next steps:
- Implement planejada screens via `auis-page`
- Add new components via `auis-component` if any state needs UI not in the styleguide
- Run `auis-audit` after first round of implementations
```

## Notes

- The flow is the source of truth for navigation **intent**. The code is the
  source of truth for navigation **execution**. Don't conflate them.
- States live in the playground. Never redraw them in FigJam.
- One feature per FigJam unless it grows past ~15 screens.
- Ask before inventing a new product namespace. Re-use what's already in the
  Figma team.
- If Figma MCP isn't available, output the Markdown spec and stop. Don't
  pretend the FigJam exists.
- Keep card metadata stable. Renaming routes mid-flight is fine, but propagate
  the rename to the cards, the back-reference comments, and the navigation
  registry in one pass.
