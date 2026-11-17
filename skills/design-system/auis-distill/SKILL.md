---
name: auis-distill
description: >
  Strips one route or section down to its essence: redundant elements,
  repeated information, decorative noise, boxes nested in boxes, competing
  actions. Writes a cut plan, then applies the cuts with the existing Au*
  components and tokens, checked in every State Mode state of the screen. Use
  for "/auis-distill", "simplify this screen", "it's cluttered", "too much
  going on", "strip it down".
argument-hint: "<route or section>"
---

# Auis Distill — remove what does not earn its place

Simplifying is not removing functionality. It is removing what stands between
the person and the task: unnecessary complexity. Every element of an interface
has to justify being there.

This skill **applies** the change. To only point at problems, use
`auis-critique`.

## Scope

- One route or one named section, at the product's desktop viewport
  (1440×900 by default; also the mobile layout if the product has one).
- Every state of the screen. Open `/auis/states` (or the screen's entry in
  `lib/auis-states/registry.ts`) and visit the URL of each state and
  interaction it lists. A cut that works in the default state and breaks the
  empty or error state is not done. If the route is not in State Mode, visit
  only the requested route.

## 1. Find where the complexity comes from

Open the screen in each state and read the route's code (`page.tsx`, its
local `_components/`, the feature folder it imports). Look for:

- **Too many elements:** competing buttons, repeated information.
- **Variation without reason:** different type recipes, tones and sizes for
  the same role.
- **Everything visible at once:** nothing waits until the person needs it.
- **Visual noise:** borders, shadows and backgrounds that do not serve the
  hierarchy; a bordered box inside another.
- **Unclear hierarchy:** you cannot tell what matters most.
- **Too many actions:** options and paths the task does not ask for.

Then the essence:

- What is **the** primary task of the screen? There should be one.
- What is necessary and what is only nice to have?
- What can go, wait until later, or merge with something else?

If the primary task is not clear from the code and the screen, do not guess:
ask (AskUserQuestion) and wait for the answer.

## 2. Cut plan

Before editing, write in a few lines:

- **Purpose:** the one thing the screen has to solve.
- **Essential:** what stays visible.
- **Later:** what moves behind disclosure.
- **Merges:** what combines.
- **Cuts:** what goes, with the reason.

Expect to say no to good ideas.

## 3. Cut

### Information

- Remove secondary actions and information that already appear elsewhere on
  the screen.
- **One** primary action; few secondary ones; the rest tertiary or in a menu
  (`AuDropdownMenu`).
- Progressive disclosure with what the product already has: `AuTabs`,
  `AuSegmented`, `AuSheet` for detail, `AuDropdownMenu` for overflow. Auis
  ships no accordion or tooltip primitive; if the product's own components
  (`docs/component-map.md`, Layer B) have one, use it, otherwise report the
  missing component (`auis-new-component`) instead of hand-rolling one. A
  tooltip never hides the only way to an action.

### Visual

- **One card level per section.** Inside an `AuCard` or a modal body, separate
  items with a divider or space, never another bordered box.
- Border, shadow and background only when they serve hierarchy or function.
- Type by recipe (`display-*`, `body-*`, `au-eyebrow`), not by raw utility.
  Fewer different recipes on the same screen, not less weight.
- Color: the system's status tones and neutrals. Color without a function goes.
- Spacing on the token scale; arbitrary gaps go.

### Layout

- A linear flow when a complex grid carries no meaning.
- Consistent alignment within the section.
- The product's navigation stays; it is not the clutter to cut.

### Interaction

- Fewer choices, smart defaults, one obvious next step.
- Inline editing instead of a modal only when the flow stays clear.
- One step fewer in the flow, if nothing is lost.
- Do not invent a new control to make up for a cut: a button or shortcut with
  no origin in the request or the code stays out.

### Text

- Cut filler, not meaning: a title that repeats the intro, prose that explains
  the screen, an explanation said twice.
- The final wording of material text (a decision, a consequence, an error, a
  permission, a recovery) belongs to `auis-ux-writing`. Here you mark what goes
  or gets shorter; it chooses the words.

### Code

- Remove what the cut orphaned: an unused local component, a dead class.
- Flatten the component tree where the cut allows.
- Do not change the variants or the API of an `Au*`: that is a structural
  design-system refactor with its own scope (`auis-new-component`).

## What not to do

- Remove necessary functionality, decision information, an accessible name, a
  label, a warning, a permission or a recovery path.
- Make it so simple it becomes obscure: mystery is not minimalism.
- Erase the hierarchy: some things need to stand out.
- Simplify a complex domain beyond the real complexity of the task.
- Create or change a token (only `auis-foundation-update`, with explicit
  scope).
- Clean up debt outside the requested route.

## 4. Verify

- The primary task got faster and more obvious in every state of the screen.
- Everything that was necessary is still reachable.
- The hierarchy got clearer, not flat.
- Proportional validation: `npm run lint`, `npm run typecheck`, `npm test`
  when the area has tests, `npm run ds:check -- <changed files>`.
- Before and after screenshots of the running app (Playwright MCP), in light
  and dark.

## 5. Report

List what went, what moved behind disclosure and what merged, each with its
reason. If something removed might be missed, say where it is still reachable,
or that it no longer is. For a second reading, suggest `auis-critique` on the
route; if the section now looks timid, `auis-bolder`.
