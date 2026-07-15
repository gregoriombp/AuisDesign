---
name: auis-setup
description: >
  The guided first-run orchestrator the welcome screen points at. It does NOT create
  tokens, voice, or brand itself — it SEQUENCES the three creator skills, in order,
  checking in with the user between each: auis-brand (name, logo, identity), then
  auis-foundation (tokens), then auis-voice (voice + locale). It reads the welcome
  intake (app/auis/_data/brand.runtime.json); if it's absent it tells the user to
  fill /auis/welcome first, or proceeds by interview. After all three creators run it
  flips setup to done and points the user at auis-component / auis-page to start
  building screens. It orchestrates and delegates — it never duplicates what the
  creator skills do. Use for "/auis-setup", "set up my project", "first-run setup",
  "I just filled the welcome form", "bootstrap my design system", "get started",
  "walk me through setup", or "I cloned Auis, now what".
---

# Auis — First-Run Setup (Orchestrator)

Bootstrap a freshly cloned Auis into **the user's** product by running the three
creator skills in order, with a check-in between each. This skill is a
**sequencer** — it owns the order and the hand-offs, nothing else. It never
creates tokens, voice, or brand itself; each of those has exactly one authoring
skill, and this skill calls them.

> **The three creators, and their lanes — do not duplicate them here:**
> - `auis-brand` — the ONLY skill that establishes brand (name, mark, one-liner).
> - `auis-foundation` — the ONLY skill that creates tokens (`globals.css`).
> - `auis-voice` — the ONLY skill that creates voice (`PRODUCT_CONTEXT.md`'s voice
>   sections).

## Input

- **The welcome intake** — `app/auis/_data/brand.runtime.json`, written by the
  `/auis/welcome` form: `{ name, tagline, logo, configured }`, with the uploaded
  logo already in `public/assets/brand/`. This is the normal entry point.
- **Nothing** — the user ran the command without filling the form. Point them at
  `/auis/welcome` first, or proceed by interview (each creator skill can interview
  on its own).

## Non-negotiables

- **Orchestrate, never duplicate.** Do not extract tokens, do not write voice, do
  not wire the logo yourself. Delegate each to its creator skill. If you find
  yourself editing `globals.css` or `PRODUCT_CONTEXT.md` directly, stop — you are
  doing a creator's job.
- **Order matters.** Brand → foundation → voice. Identity first (so name and mark
  exist), then the visual system (which can use the logo as a colour reference),
  then the voice (seeded by the tagline). Do not reorder.
- **Check in between steps.** After each creator finishes, summarize what it did
  and confirm before starting the next. The user may want to stop after brand, or
  redo foundation. A first run is a conversation, not a batch job.
- **Read the intake, don't re-ask.** If `brand.runtime.json` has the name, tagline,
  and logo, pass them through — the creator skills confirm, they don't re-interview.

## Workflow

### 0. Read the intake

```bash
cat app/auis/_data/brand.runtime.json 2>/dev/null
```

- **Present** → note `name`, `tagline`, `logo`, `configured`. Continue.
- **Absent** → tell the user: *"Fill in `/auis/welcome` first — the project name,
  a one-line description, and your logo — then re-run `/auis-setup`. Or say
  'interview me' and we'll do it here."* Proceed by interview only if they ask.

Give the user the plan up front: three steps, one skill each, a check-in between.

### 1. Brand → run `auis-brand`

Delegate to `auis-brand` to establish the name, the logo/mark, and the one-line
identity, using the uploaded logo from the intake. It confirms/normalizes the name
and tagline, verifies the logo, records the brand-identity section in
`PRODUCT_CONTEXT.md`, and wires `AuLogo`/brand config at the user's mark.

When it returns, summarize (name, tagline, mark) and check in before continuing.

### 2. Foundation → run `auis-foundation`

Delegate to `auis-foundation` to create the design tokens. It can use the uploaded
logo as a **colour reference**, but `auis-foundation` remains the token authority —
you pass it the logo path, you do not extract colours yourself. If the user has a
richer visual reference (a screenshot, a Figma), hand that to foundation instead.

When it returns, summarize (primary colour, font, feel) and check in.

### 3. Voice → run `auis-voice`

Delegate to `auis-voice` to establish the product voice and locale, **seeded by the
one-line tagline** from the intake. Voice will still ask for a real reference or
interview — the tagline frames it, it does not replace the evidence `auis-voice`
needs. You do not write any voice sections yourself.

When it returns, summarize (language/locale, voice) and check in.

### 4. Flip setup to done, hand off

After all three creators have run and the user is satisfied:

- Mark setup complete so the hub's "Welcome / set up your brand" card disappears.
  The completion signal is the intake's `configured` flag (and the fact that
  `PRODUCT_CONTEXT.md`'s brand/voice sections and the tokens are now filled). Flip
  it via the same `/api/*` route the welcome form uses — do not invent a new store.
- Point the user at what's next: `auis-component` to add components to the
  styleguide, `auis-page` to build screens.

> As with the creator skills, **you do not author `.ts`/`.tsx`/`.css`** — describe
> the flip (which flag, which route) and let the agent or the user apply it.

## Output to return

```
First-run setup complete.

Step 1  Brand       → auis-brand      <name · tagline · mark>
Step 2  Foundation  → auis-foundation <primary · font · feel>
Step 3  Voice       → auis-voice      <language/locale · voice>

Setup     configured → true (welcome card dismissed)
Next      auis-component (add components) · auis-page (build screens)
```

## Notes

- **This skill is glue.** Its whole value is the order and the check-ins. Every
  concrete artifact — the wired logo, the tokens, the voice file — is produced by a
  creator skill, credited to that skill.
- **A partial run is fine.** If the user stops after brand, that's a valid state:
  the identity exists, foundation and voice are still todo. Don't flip `configured`
  until the user is actually done.
- **Don't re-bootstrap a set-up project.** If tokens, voice, and brand are already
  filled, say so and offer the update paths (`auis-foundation-update`, re-running a
  single creator) instead of running the whole sequence again.
- Related: `auis-brand` (identity) · `auis-foundation` (tokens) · `auis-voice`
  (voice) · `auis-component` (build components once setup is done).
