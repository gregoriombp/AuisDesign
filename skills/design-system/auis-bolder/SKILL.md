---
name: auis-bolder
description: >
  Raises one named section of a screen to the conviction the rest of the
  product already has, using only the existing recipes, tokens and Au*
  components. Applies the change and touches nothing outside the target. Use
  for "/auis-bolder", "make this bolder", "this section has no presence",
  "give this section more weight", "it looks too timid".
argument-hint: "<route> + <target section>"
---

# Auis Bolder — more conviction, same vocabulary

"Make it bolder" is a request to amplify, and it almost always applies to
something that already exists. The page around it, the design system and the
conventions are givens. The job is to bring one part up to the level of
conviction the rest already suggests, without rebuilding what the request did
not name. The reflex to add more effect is the opposite of bold: drop it first.

This skill **applies** the change. To only point at problems, use
`auis-critique`.

> Needed before editing: which section is the target and what must not change.
> If the request does not say, ask (AskUserQuestion) before you touch a file.

## Scope is the contract

"Leave the rest alone" is literal. Touch only the target. Do not restyle the
neighbours, do not take the page toward a new idea, and do not add a color,
font, radius, shadow or primitive the system does not have.

If the design system genuinely cannot express the direction, do not extend it
yourself: a new token belongs to `auis-foundation-update`, a new component to
`auis-new-component`. Ask, naming the exact addition and the work it would do,
and wait for the answer.

## Why the section looks weak

A section usually looks weak for reasons its neighbours have already solved.
Compare it with what the rest of the product does and it does not: the display
recipe at the right strength, the structural devices that carry meaning, the
density and the rhythm. The most reliable pass brings the target up to the
expressive level of its neighbours, in the system's own vocabulary.

Classify the surface first, with the same modes as `auis-critique`:

- **Operate** (dashboards, lists, settings, editors): bold means a clearer
  focal point and a more legible state, not a marketing moment.
- **Persuade** and **Experience** (landing, signup, onboarding, empty states,
  celebration): more expression fits.
- **Read** (docs, help, changelogs): bold is a stronger entry point and a
  clearer scan path.

## What the system already has to amplify

Read `AGENTS.md`, `docs/component-map.md` and the typography recipes in
`app/globals.css` before choosing:

- **Scale.** Hierarchy comes from size, recipe, color and space. The
  `display-*` recipes carry the weight a section deserves; `body-*` and
  `au-eyebrow` set the supporting levels. Use the weights the recipes already
  use; do not introduce one they do not.
- **A display typeface**, if your foundation defines one, only where the
  foundation says it belongs.
- **The brand moment**, if the foundation defines one (`--accent-brand`, a
  gradient utility). Never a new texture, shader or background image.
- **Strong selection.** An active or selected tile can go to `--bg-inverse`
  with `--fg-on-inverse`.
- **Composition from `Au*`.** `AuCard`, `AuStatCard`, `AuPill`, `AuButton`
  with its intents, `Icon` at a larger size from its scale. Never a raw
  `<svg>` or a one-off element where an `Au*` exists.

## The amplification

- **Amplify what the system already has.** Use its scale and devices at full
  strength in this section, not ones invented for it. The bold version looks
  more like the product, not less.
- **True content.** The existing text and data are part of the scope: keep
  them unless the request supplies replacements. If the direction needs real
  evidence that does not exist, ask for it.
- **Commit, then clear.** Half a move reads as noise. Make the decisive move in
  full and quiet what surrounds it so it can be read. If everything got louder,
  the section got flatter.
- **Its own rhythm.** The target is a peak in the scroll: a change in density
  or pace against what surrounds it, not more of the same.
- **Material copy** that changes weight (a decision title, a consequence) goes
  through `auis-ux-writing`.

## The skeleton test

Strip the text from the planned section and look at the bare structure. Does
the skeleton still say what the section is and why it matters, with hierarchy
and the system's devices alone? If it only works once the words come back, the
strength is in the text size, not in the design. A slot for an image or an
artifact names a job, a support and a piece of evidence; it is not a cue for a
decorative photo.

## Before you finish

- Nothing outside the target changed.
- No new color, font, token or primitive appeared without a request.
- The conventions the section carried, including what triggers an action, work
  the same in every state State Mode registers for the screen
  (`lib/auis-states/registry.ts`).
- The section is unmistakably the same product, only surer of itself.
- Proportional validation: `npm run lint`, `npm run typecheck`,
  `npm run ds:check -- <changed files>`.
- Before and after screenshots of the running app (Playwright MCP) at the
  product's desktop viewport (1440×900 by default), in light and dark.

If the problem was the opposite (excess, noise), the way out is to remove, not
amplify: `auis-distill`. For a second reading, suggest `auis-critique`.
