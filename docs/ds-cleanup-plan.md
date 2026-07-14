# Design system cleanup plan — state and backlog

> Living document. **The exact debt count is always `npm run ds:check`** — this
> file describes the strategy and the buckets (which don't change), not frozen
> file lists (which would go stale). Started 2026-06-13.

## 1. Why this exists (the original problem)

The repo owner (not a DS specialist) reported: AI agents create components from
scratch instead of reusing the atoms (`AuButton`, `Icon`, `AuInput`); lots of hardcode
(`#hex`, `w-[37px]`, raw `<svg>`, hardcoded icons); components that looked like
duplicates (cards, tables); confusing rules/skills with obsolete bits; and a fear of
having "installed a thousand libraries". **Goal:** organize the DS so that, when you ask
an agent for something, it finds the reference immediately — and stops polluting the repo.

## 2. What was done

### Stage 1 — Foundation (done)
- **Index for the AI:** [`docs/component-map.md`](./component-map.md) — "I need X → use Y →
  import → watch out", vocabulary of the real tokens, family disambiguation
  (cards/tables/modals), Fluid status, sanctioned primitives.
- **Rules hardened:** [`AGENTS.md`](../AGENTS.md) — atomic composition promoted (§3),
  pointer to the index, the "icon = `Icon`, never a raw `<svg>`" rule, Fluid status.
- **Atomic checklist restored** in the `auis-new-component`/`-new-page` skills
  (the `a95f7bf` refactor by "Codex" had compressed that part too far — the root cause of
  the "doesn't compose atomically" symptom).
- **Au-blind skills neutralized** (`design-system-*`, `setup-design-system-from-*`) —
  kept on disk as a record of the initial setup, with a neutralized `description` (they no
  longer trigger) and a banner in the body redirecting to the `auis-*` ones.
- **Guard-rail:** [`scripts/ds-check.mjs`](../scripts/ds-check.mjs) (`npm run ds:check`,
  warn-only) — catches hardcoded hex, arbitrary values, raw `<svg>`, a raw primitive that
  has an Au wrapper, and index drift.
- Stale cleanup: the dead `knowledge-os` route removed from `PRODUCT_CONTEXT.md`.

### Stage 2 — Typography (done and verified in the app)
- Finding: ~85% of the "hardcode" was a **type ramp with no token** (the product uses
  10/11/13/15px, which the Tailwind scale skips). `card.tsx`/`table.tsx`/`chart.tsx`
  **were not duplicates** — they are the shadcn base of the `tool-ui` subsystem (wired to the
  tokens by a compat layer). **Do not delete.**
- **New skill** [`auis-foundation-update`](../.claude/skills/auis-foundation-update/SKILL.md):
  incremental, additive token updates, no rebootstrap/clobber. Authorized in `AGENTS.md`
  alongside `foundation`.
- `text-2xs`(11px) and `text-3xs`(10px) added (pure font-size) and adopted for the
  product's 10/11px — **verified pixel-identical** in the app.
- `13/15/17/9px` (drift between steps) rationalized onto the standard steps
  (`text-sm`/`base`/`lg`/`text-3xs`) — **before/after with no breakage** (settings/profile +
  roles table).
- Result of Stage 2 (snapshot 2026-06-13): `ds:check` **479 → 322 warnings**. A historical
  marker — today's count is always `npm run ds:check`, not this number.

## 3. What's left (backlog) — run `npm run ds:check` for today's number

The mechanical wins are over; **everything from here on is case-by-case, with visual
verification.** In order of value:

| Bucket | ~Count | Approach |
|---|---|---|
| **raw `<svg>` — triage** | ~117 | Original complaint #1, but it is **not "everything becomes an `Icon`"**. Triage each one (see _Icon strategy_ below): normal icon → the library (`Icon`); custom animation/visual → its own component. |
| **Raw colors** (`text-gray-400`…) | ~64 | Map to the semantic token **by role** (secondary text → `text-fg-secondary`, border → `border-subtle`…). |
| **`text-[Npx]` "on-step"** (12/14/16/18/20/24/30) | ~64 | They do have a token, but migrating adds Tailwind's line-height → **verify visually** (or use the semantic `body-*` utilities). |
| **Spacing `p/gap-[18px]`** | ~16 | Snap to the grid (4px) or accept it as an exception. |
| `w/h-[..]` notes | ~302 | Low priority — width/height without a token is usually intentional. |

### Icon strategy (refines the `<svg>` bucket above)

The raw `<svg>`s in product code **are not all icons** — the plan is **not** to flatten
everything into `Icon`. Triage each one into two destinations:

- **Normal icon** (arrows, trash, check, chevron, etc.) → swap for the **library**
  (`Icon` / Material Symbols Rounded). Use the pass to **enrich coverage**:
  Material Symbols has far more glyphs than we use today — standardize on it instead of
  ad-hoc svgs. This is the bulk of the ~117.
- **Custom animation / visual** (the Agent Studio animation, Memory Base visuals, agent
  orbs, brand illustrations) → **these are not icons.** They keep SVG/Canvas/WebGL and,
  when reused, become a **dedicated `Au*` component** (several already are — `AuAgentCore`,
  `AuBrandIllustration`, `AuBeams`…, which is why `ds:check` already allowlists them). The task
  here is only to assess case-by-case whether some page-level `<svg>` still needs to be formalized as a component.

Rule: the **triage** decides the destination of each `<svg>`; **only the normal ones become
`Icon`**. The custom/animated ones are never "fixed" into an `Icon` — that would be a regression.

### Larger backlog (outside the "Foundation" scope, deliberately deferred)
- **Fluid "leva 2":** fold the Fluid motors into the `Au*` primitives (a single
  `AuToggle`/`AuSlider`…), removing the 8 duplicated `fluid/*` primitives. **Confirm the
  upstream license first.**
- **Perf:** `dynamic()`/lazy-load `three.js` (~1.2MB, currently eager in ~6 places).

## 4. How to resume efficiently (fresh session)

1. Read `AGENTS.md` + `docs/component-map.md`; run `npm run ds:check` to see the current debt.
2. Pick **one bucket** and attack it **page by page** (not everything at once).
3. The safe, already-proven pattern:
   - **New token?** Only via `auis-foundation-update` (additive; `@theme`+`:root`+dark
     kept in sync). A pure font-size conversion = zero change; changing a value in use = verify visually.
   - **Changed size/leading/color/icon?** Screenshot before/after (Playwright) on a dense
     page before committing.
4. Atomic commits + push to `origin/main` at the end of each bucket/page (the owner's preference).

## 5. Why this does NOT become AI slop nor go outdated

- **Slop:** the Foundation (index + rules + checklist + `ds:check` + tokens) is exactly what
  **prevents** slop in NEW work. New screens read the map, reuse `Au*`, use the tokens, and
  get caught by `ds:check`. **Build freely** — the backlog above is LEGACY debt, isolated in
  old screens; it does not contaminate new screens. Just run `ds:check` on whatever you touch.
- **Outdated:** this doc points at `ds:check` as the live source of the count and describes
  **buckets + approach** (durable), not file lists. The numbers change; the strategy doesn't.
