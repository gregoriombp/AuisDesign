---
name: auis-update-states
description: >
  Maps product screens into Auis State Mode: registers new screens, axes,
  states and `?ge=` interactions in `lib/auis-states/registry.ts` and keeps
  the `/auis/states` matrix honest after a page changes. Use after adding or
  removing a page state, modal, redirect, or a whole screen — when the user
  says "/auis-update-states", "register this screen in State Mode", "update
  the state matrix", "add a state to the registry", "map the screen states",
  or asks why a scenario is missing from `/auis/states`.
---

# Auis — Update State Mode

Keep the State Mode registry (`lib/auis-states/registry.ts`) faithful to the
product, so that developers see **every scenario of each screen** side by side
at `/auis/states` and flip states on the real screen from the floating dot
(AuisDot → Modes → "Enter State Mode", or `⌘⇧S`).

The golden rule (`AUIS.md` → "State Mode"): **the URL is the source of truth**
— the State Mode toolbar only writes and clears query params. The registry is
the map of those params.

## The registry contract

Types live in `lib/auis-states/types.ts`; the data in
`lib/auis-states/registry.ts` (`SCREEN_STATES`).

- One `ScreenStatesEntry` per screen: `pattern` (pathname; `[x]` matches one
  segment), `screenLabel`, `axes`, optional `interactions`, optional
  `previewPath`.
- An axis is one query param: `{ param, label, defaultValue, options }`.
  `defaultValue` means "no param in the URL" — selecting it deletes the param,
  so a clean URL is always the real default.
- `options` come from `axisFromRecord<Union>({ … })`, typed against the
  screen's own union: a union member without a label **fails
  `npm run typecheck`** — that is how the matrix stays honest. Each option is
  a plain label or `{ label, description }`.
- `interactions` are `?ge=` click recipes replayed by `FlowStateDriver`
  (`components/auis/FlowStateDriver.tsx`) without remounting the screen:
  `t:<text>` clicks the first clickable whose text matches, `c:<css>` clicks
  a selector, `w:<ms>` waits; steps are joined by `>>`.
- `matchScreenStates(pathname)` returns the **first** matching entry, so
  deeper patterns are listed first.
- `previewPath` is the concrete URL the matrix (and `npm run states:pdf`)
  opens when `pattern` has a dynamic segment or needs a query to render;
  without it the entry is skipped by the matrix.
- A shared axis is a plain constant reused by reference across entries
  (`EXAMPLE_PLAN_AXIS` in the registry).

The worked example is `/auis/states/example`: unions + parsers in
`app/auis/states/example/state.ts` (`ExampleScreenState`,
`ExampleScreenPlan`, `parseExampleState`, `parseExamplePlan`), the screen in
`app/auis/states/example/page.tsx` (Pattern B), and the first entry of
`SCREEN_STATES` (`?state=default|empty|loading|error|permission`,
`?plan=free|pro`, interactions `t:New item` and `t:Open details`).

---

## When to run

- A screen gained or lost a state (`?state=`, `?status=`, `?plan=`…), a
  navigable modal, or an error / empty / permission / loading scenario.
- A new screen was born, a route died, or it became a redirect.
- An interaction now deserves a URL (`?ge=` opens menus, sheets and popovers
  by the target's text: `ge: "t:<button text>"`).

## Steps

1. **Discover the delta.** Compare the screen's scenario union (its
   `state.ts`, `_components/types.ts` or equivalent) with the registry entry.
   `axisFromRecord<ScreenUnion>` makes a new member without a label **fail the
   compile** — run `npm run typecheck` to find the hole. A screen with no
   entry at all shows "This screen has no registered states yet" in the
   toolbar.
2. **New screen → choose the pattern** (`AUIS.md` → "State Mode"):
   - **Pattern A (server-thin):** the page maps `searchParams` to initial
     props and derives a `key` from the state params, remounting the client
     component on every change.
   - **Pattern B (client):** the page reads the params with
     `useScreenStateOverride(param, parse)` from
     `lib/auis-states/useScreenStateOverride.ts`, derives the scenario during
     render and wraps the screen in `Suspense`. Never copy the override into
     `useState`. `/auis/states/example` is the reference.
   - **Pattern A with a mirror:** the real flow writes its step into the URL
     (wizards). The `key` comes from `useMirroredScenario`
     (`lib/auis-states/useMirroredScenario.ts`), not from the server — see
     `docs/screen-url-mapping.md` for the pattern and the traps it already
     sprung (orphan pins, the router snapshot, the server key, a page
     rendered behind the screen).
   In all of them, the parser maps absent/unknown → default, exactly like the
   switcher assumes.
3. **Edit the registry.** Deeper entries first (the matcher returns the first
   one that matches). Shared axes are reused by reference. Add `previewPath`
   when the pattern has a dynamic segment (`[id]`) or needs a query to
   render. Declare `options` literally (not through `axisFromRecord`) only
   when keys such as `"1"`, `"2"` would be hoisted by `Object.entries`.
4. **Dead states leave the registry AND the union/parser** — a scenario with
   no navigable target is a lie in the matrix. A route that became a redirect
   loses its whole entry.
5. **Interactions (`interactions`)**: label what only exists suspended
   (menus, sheets, modals) with `ge: "t:<text>"` (chain `>>w:<ms>>>t:<next>`
   when a step needs a breather). Check that the target text exists on the
   screen — the driver shows "Could not reach the state" when it does not.
6. **Verify**: `npm run typecheck`; open `/auis/states` and check the card of
   the touched screen (`N axes · M states · K interactions`) and its matrix
   (iframes rendered with `?chrome=0`); open 2–3 deep links from the matrix
   and see the scenario mount — e.g. `/auis/states/example?state=empty`,
   `/auis/states/example?state=error&plan=pro`,
   `/auis/states/example?ge=t%3ANew%20item`. On a mirrored screen, also
   walk the flow with the toolbar open: it must report the live step, remount
   on every axis, and exiting the mode must return the screen to its default
   (the exit also drops `?ge=`). Optional: `npm run states:pdf` (needs the
   dev server and `playwright-core` with an installed Chrome) to print the
   whole matrix.

## Invariants

- Switcher labels are English and concrete ("Certificate expired", not
  "Error 2").
- `description` only when the label alone does not explain the scenario.
- No registered state may depend on simulated data outside the URL.
- The matrix does not replace the product: a transient state (a verification
  sequence, a toast) is not an axis — only what the URL reproduces.
- Entries under `/auis/*` are builder demos (badged "Demo") and do not count
  toward product coverage; product screens live outside `app/auis`.
- Never mount a second copy of `StatesModeProvider` or `FlowStateDriver` —
  the root layout already mounts them for every route.

## Output

Report: screens touched, states added/removed, new interactions, the pattern
chosen for any new screen, and the final count that `/auis/states` shows for
each screen (`axes · states · interactions`).
