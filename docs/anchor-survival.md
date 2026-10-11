# Anchor survival in apps Auis did not author

Wave 0 of [`review-bridge-packages-plan.md`](review-bridge-packages-plan.md). The
question: do review pins stay attached to their element in apps Auis did not
author? The answer gates wave 2. Measured on 2026-10-10.

## Verdict

**Wave 2 can start.** 125 of 130 checks passed: the pin came back on its
element after the page was perturbed. Every failure has the same cause, and it
is not specific to the host. Resizing across breakpoints, client-side
navigation, reloads, state-driven view switches, SVG and a Vue app all came
through intact (100 of 100). The five failures all happened on data changes in
lists whose rows repeat the same label. The same anchors fail the same way on
Auis's own screens, so this is an anchoring issue to fix separately, not a
reason to hold the portability work. See [Follow-ups](#follow-ups).

## Method

The [`scripts/anchor-survival.mjs`](../scripts/anchor-survival.mjs) script
injects the anchoring code into each page. It lifts `lib/auis-review/elementAnchor.ts`
verbatim, with types stripped and imports dropped. It drops five pins per page
the way the canvas does, calling `captureElementAnchor()` at a click point in
the middle of each target. A fresh browser context per scenario starts from the
same baseline. The script then perturbs the page and re-resolves every anchor.

A pin **survives** when it resolves to the same element that an independent
locator finds: by role, by text, by attributes, or by its row. It also survives
when its element is no longer displayed and the pin hides with it.

The canvas uses the loose resolution, which falls back to the selector's
element. The reveal trail uses the strict resolution, which returns nothing
when the selector and the text fingerprint disagree. The tables show the loose
result, and the notes give the strict result wherever it differs.

| App | Stack | Why it is here |
|---|---|---|
| Destiny Matrix `/chart`, `/saved`, `/` | Next 16 App Router, React 19, Tailwind v4, no shadcn or Radix, an SVG chart | the validation host |
| Vite SPA (`ux-remodel-app`, production build) | Vite 8, React 19, Tailwind v4, views kept in state with no router | a Vite SPA |
| vuejs.org guide | VitePress: Vue 3 and its client-side router | a non-React app |

The script wrote nothing to the host repositories. The Destiny Matrix dev
server ran from its checkout, which stayed clean. The saved-maps list was seeded
in the test browser's `localStorage`, so its "Salvar mapa" button, which also
writes to disk, was never pressed. The Vite build was copied to a scratch
folder and served from there.

Legend: **ok** means the pin is on its element through the selector. **ok
(text)** means the selector pointed elsewhere and the text fingerprint found the
element. **hidden** means the element is not displayed at that size or in that
state, and the pin hides with it. **gone** means the element left the DOM and
the pin hides. The failures are in bold: **wrong** means the pin is drawn on
another element, **drawn elsewhere** means the element is gone and the pin is
drawn on whatever took its place, and **lost** means the element is on screen
but the pin is not drawn.

### Destiny Matrix `/chart`

| Pin | Resize 1024×768 | Resize 390×844 | Away ("Novo mapa") and back | Reload | Click a reading tab |
|---|---|---|---|---|---|
| Person's name (h1) | ok | ok | ok | ok | ok |
| Destiny number (top right) | ok | ok | ok | ok | ok |
| Octagram centre number (SVG `<text>`) | ok | ok | ok | ok | ok |
| "Salvar mapa" button | ok | ok | ok | ok | ok |
| Quote under "Linha do amor" | ok | ok | ok | ok | ok |

### Destiny Matrix `/saved` (a list)

| Pin | Resize 390×844 | Away and back | Reload | A newer map is saved (new first row) | The middle row is removed |
|---|---|---|---|---|---|
| Page title (h1) | ok | ok | ok | ok | ok |
| Second row's name (Bruno) | ok | ok | ok | ok (text) | **drawn elsewhere** ¹ |
| Third row's "Abrir" link (Carla) | ok | ok | ok | **wrong** ² | **lost** ³ |
| First row's "Remover" button (Ana) | ok | ok | ok | **wrong** ² | ok |
| First row's date (Ana) | ok | ok | ok | ok (text) | ok |

1. Bruno's row is gone, and the pin is drawn on the next row's name (Carla).
   The strict resolution hides it.
2. The pin moves one row down, 82 px. The nth-of-type path now points at the
   row below. That row's label reads "Abrir" or "Remover" too, so the
   fingerprint confirms the wrong element and nothing looks off.
3. Carla moves up a row, so the path no longer resolves. Two rows carry an
   identical "Abrir", and the ancestry tie-break cannot choose between them.
   It gives up, so the pin is not drawn. The strict resolution does the same.

### Destiny Matrix `/` (a form)

| Pin | Resize 900×800 | Resize 390×844 | Away ("Salvos") and back | Reload | Submit empty: an error is inserted |
|---|---|---|---|---|---|
| Headline's italic line | ok | ok | ok | ok | ok |
| Name input | ok | ok | ok | ok | ok |
| Pull quote (hidden below `lg`) | hidden | hidden | ok | ok | ok |
| "Consultor" feature text (hidden below `lg`) | hidden | hidden | ok | ok | ok |
| Form submit button | ok | ok | ok | ok | ok |

### Vite SPA

| Pin | Resize 700×800 | Resize 390×844 | Switch view and back (no URL) | Reload | Open the wizard | Open the wizard and cancel |
|---|---|---|---|---|---|---|
| Page title (h1) | ok | ok | ok | ok | gone | ok |
| "Nova Base" button | ok | ok | ok | ok | **drawn elsewhere** ⁴ | ok |
| Panel heading (h3) | ok | ok | ok | ok | gone | ok |
| "Abrir Fluxo Unificado" button | ok | ok | ok | ok | gone | ok |
| Sidebar "Produtos" (hidden below `md`) | hidden | hidden | ok | ok | ok | ok |

4. The wizard replaces the hub. Its "Cancelar" button lands on the node path
   that "Nova Base" had, so the loose resolution draws the pin on it. The strict
   resolution hides it.

### vuejs.org (Vue 3)

| Pin | Resize 900×800 | Resize 390×844 | Client-side nav and back | Reload | Switch the API preference (same URL) |
|---|---|---|---|---|---|
| Page title (h1) | ok | ok | ok | ok | ok |
| Section heading | ok | ok | ok | ok | ok |
| Paragraph shown only for the Composition API | ok | ok | ok | ok | hidden |
| Sidebar link | ok | ok | ok | ok | ok |
| "Next" pager link | ok | ok | ok | ok | ok |

## What the numbers say

- **Layout and lifecycle are not a problem.** The `body > … nth-of-type` path
  holds across these cases:
  - breakpoints
  - client-side routers (Next, VitePress)
  - reloads
  - views kept in React state
  - SVG

  Nothing in it depends on the host's framework, CSS or router. A pin on an
  element that a breakpoint hides goes away with it and comes back when it
  shows again.
- **Repeated labels in data-driven lists are the weak spot.** The fingerprint is
  the element's own text. "Abrir" or "Remover" on every row is not unique, so it
  cannot catch a path that slid one row. A row inserted above moves the pin
  silently to the neighbour. A row removed either loses the pin, or (loose
  mode) draws a pin from the removed row on the next one. Labels that are
  unique, like names and dates, recovered through the fingerprint.
- **Loose or strict.** In this run the loose fallback never rescued a pin, and
  twice it drew one where strict hid it. But the run had no case for which
  loose exists: an element that stays the same while its own text changes, such
  as a counter or a status label. Do not switch the canvas to strict on this
  evidence alone.
- **Not measured.**
  - elements inside a shadow root: `cssPath` stops at the shadow boundary, and
    `auis doctor` already flags `attachShadow`
  - iframes
  - canvas-drawn UIs
  - virtualized lists, which recycle rows and would likely behave like the
    list case above

## Follow-ups

- **Anchoring: a row context in the fingerprint.** When an element's own text
  is not unique in the document at capture, add the text of its nearest
  ancestor that is unique, such as the row. `resolveElement` can then use that
  context to confirm the selector's element and to break ties between identical
  candidates. That fixes notes 2 and 3, and probably note 1. Keep the change
  additive: `fingerprint` is optional on stored anchors, so old comments keep
  resolving the way they do now. Not part of wave 2.
- **`auis doctor`.** `review.anchoring` says "supported" when the source has no
  `attachShadow`. This sheet backs that up, with one caveat to add to its
  explanation: repeated controls in lists that change. That belongs with
  wave 3, which reworks `doctor` and `init`.

## Re-running

Start the apps on the ports in the script (Destiny Matrix on 3301, the Vite
build served on 4174), then run:

```bash
node scripts/anchor-survival.mjs --out anchor-results.json
```

It needs Playwright: `playwright-core` driving the installed Chrome, or
`PLAYWRIGHT_MODULE` pointing at any Playwright package. If you add hosts, add
them to `APPS` in the script and to the tables above.
