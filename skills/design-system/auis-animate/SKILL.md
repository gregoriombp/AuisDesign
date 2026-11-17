---
name: auis-animate
description: >
  Adds motion to one route or component only where it explains feedback, a
  state change, continuity, or one earned moment, using the existing duration
  and easing tokens, the Au* overlays that already animate, and a
  reduced-motion path for every animation. Applies the change. Use for
  "/auis-animate", "animate this", "add motion", "this needs a transition",
  "it feels static when it changes".
argument-hint: "<route or component>"
---

# Auis Animate — motion that explains

Motion is there to explain state, relationship and hierarchy, or to create one
authored moment the surface has earned. Decoration without purpose is
animation debt.

This skill **applies** the change. To only point at problems, use
`auis-critique`.

## Scope

- One route, section or component, at the product's desktop viewport
  (1440×900 by default; also the mobile layout if the product has one).
- Every state State Mode registers for the screen
  (`lib/auis-states/registry.ts`): the transition between states is often the
  target itself.
- Classify the surface as `auis-critique` does. On **Operate** screens motion
  serves feedback, state and continuity: routine transitions are fast and
  nobody waits for a loading choreography. An authored moment fits
  **Persuade** and **Experience** surfaces: welcome, onboarding, empty states,
  celebration.

## Already solved — do not redo

Read `AGENTS.md` → Stack & scope gotchas (motion and overlays):

- **The paint transition is global.** Interactive elements get color,
  background, border and shadow transitions from a `@layer base` rule in
  `app/globals.css`. Do not add `transition-colors` to every hover.
- **Overlays animate on their own.** Modal, sheet, dropdown, mention menu,
  toast and popover use the sanctioned primitive (`AuModal`, `AuSheet`,
  `AuDropdownMenu`, `AuMentionMenu`, `AuToast`, the `popover` primitive), with
  enter and exit motion through Radix `data-state`. A conditional mount with
  `fixed inset-0` loses its exit animation and is forbidden (`ds:check` flags
  it).
- **Sequential modals** change `stepKey` on `AuModal` so the body re-animates
  per step.
- **Indeterminate work** uses `AuSpinner`; progress uses `AuProgress`.
- **Enter and exit utilities** come from `tw-animate-css`. Never animate
  `transform` or `opacity` globally: those are reserved for enter animations.

## 1. Find the work

Look at the motion language the area already uses, its interaction states and
the cost. Motion only goes where it:

- acknowledges an action;
- makes a state change or a spatial relationship legible;
- preserves continuity through a navigation or a layout change;
- directs attention at a moment that matters.

Ask only when a material constraint cannot be deduced. Do not animate a static
area just because it exists.

## 2. Motion thesis

Write it before implementing:

- **Focal moment:** the sequence that deserves authorship, if any.
- **Continuity:** the state, layout or navigation changes that need explaining.
- **Feedback:** the controls and results that need confirmation.
- **Cost:** what may be expensive and how often it runs.

The focal moment comes from this product and this screen. A generic
fade-and-rise, a hover that lifts, parallax or reveal-on-scroll is not a
thesis.

## 3. Material by meaning

Transform and opacity are the reliable base, not the whole palette:

- **Continuity and relationship:** a shared element, FLIP, a deliberate
  spatial offset.
- **Focus and depth:** blur, backdrop or shadow, contained to the region.
- **Reveal and compose:** mask, `clip-path`, crop.
- **State and feedback:** the smallest change that makes cause and result
  unmistakable.

No stacking techniques for spectacle. One strong material idea at the focal
moment and quiet supporting states are enough. Stagger siblings only when a
list appears as a list, with a bounded total delay; never treat every
scrolled section as a list.

## 4. Time and curve: the tokens

Never write a loose duration or curve. The tokens live in `app/globals.css`,
in two channels with the same values:

| Use | className (`@theme`) | `var()` (inline, raw CSS) | Value |
|---|---|---|---|
| Immediate feedback | `duration-au-fast` | `--dur-fast` | 120ms |
| Routine state change | `duration-au-base` | `--dur-base` | 180ms |
| Layout, overlay, step change | `duration-au-slow` | `--dur-slow` | 280ms |

| Curve | className | `var()` | For |
|---|---|---|---|
| Standard exit | `ease-au-out` | `--ease-out` | almost everything |
| Confident arrival | `ease-fluid` | — | a focal entrance |
| Symmetric | — | `--ease-in-out` | a looping or back-and-forth motion |

- Exits are faster than entrances. Long feedback reads as latency.
- No bounce or elastic by reflex.
- An authored focal moment may run longer than 280ms. A duration or curve no
  token covers, and that will repeat, is a token gap: report it, do not create
  it (`auis-foundation-update`).

## 5. Implement in the right runtime

- **CSS** (transitions, keyframes, `tw-animate-css` utilities) for declarative
  state and short sequences. Feature keyframes live in `app/globals.css` next
  to the feature's block, with their `@media (prefers-reduced-motion: reduce)`
  beside them, like the neighbours.
- The template ships **no motion library**. If an interaction genuinely needs
  springs, interruption or layout animation that CSS cannot express, say so
  and ask before adding a dependency. If the product already has one, use it;
  never add a second.
- Content is visible in the default state: a script that fails never hides
  the screen.
- Do not animate layout-moving properties (`width`, `height`, `top`, `left`,
  margins) without reason. Use transform, FLIP or grid. Follow the local
  pattern where the code already does so deliberately.
- Blur, filter, shadow and canvas stay contained to a region. `will-change`
  only while the animation runs.

## 6. Accessibility and control

- Every animation has a `prefers-reduced-motion` path with an intentional
  alternative: `motion-reduce:` in the className, or the `@media` block in
  CSS.
- Reducing means less and softer, not everything off: remove the spatial
  movement and keep the opacity, color and state transition that carry
  meaning. Feedback that confirms an action stays legible.
- A non-essential loop stops when it leaves the screen or the tab is hidden.
- Keyboard: focus is never lost and never waits for an animation to finish.

## 7. Verify

- The focal moment is specific to this screen.
- Each supporting animation explains feedback, a state or a relationship.
- Interrupting and repeating work (double click, going back mid-transition).
- The reduced path removes movement without erasing feedback or state.
- Removing the animation would lose meaning, not only decoration.
- Proportional validation: `npm run lint`, `npm run typecheck`, `npm test`
  when the area has tests, `npm run ds:check -- <changed files>`.
- In the running app (Playwright MCP): run the interaction, screenshot the
  frames that matter, and check the reduced mode by emulating
  `prefers-reduced-motion`.

For a second reading, suggest `auis-critique` on the route.
