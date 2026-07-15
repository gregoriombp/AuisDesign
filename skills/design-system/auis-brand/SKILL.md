---
name: auis-brand
description: >
  Establishes a product's brand identity — the app name, the logo/mark, and the
  one-line positioning — and wires them into the app. Reads the welcome intake
  written by the /auis/welcome form (app/auis/_data/brand.runtime.json plus the
  uploaded logo now in public/assets/brand/); when there is no intake it interviews
  for the name, the one-liner, and a logo path or a description to generate a simple
  wordmark from. Confirms and normalizes the name and tagline, verifies the logo file
  exists and is a sane image, records the identity into PRODUCT_CONTEXT.md, and points
  components/ui/AuLogo.tsx and the brand config at the user's mark instead of Auis's
  default. This is the ONLY skill that establishes brand — auis-foundation is the token
  counterpart, auis-voice is the voice counterpart, and this skill touches neither. Use
  when the user asks to "set up my brand", "set the app name and logo", "wire in my
  logo", "establish the brand identity", "I uploaded a logo in the welcome screen",
  "change the app name", "replace the Auis logo with mine", or "make it my product,
  not Auis".
---

# Auis — Brand Identity

Turn a name, a one-liner, and a mark into the product's brand — recorded in
`PRODUCT_CONTEXT.md` and wired into the app's chrome, so the running app reads
as **the user's product**, not as Auis.

This skill is the third sibling to the two other creators. `auis-foundation` is
the only skill that creates **tokens**; `auis-voice` is the only one that creates
**voice**; this is the only one that establishes **brand** — the name, the mark,
the one-line identity. It stays in that lane: it does **not** create tokens
(that is foundation) and does **not** write voice or vocabulary rules (that is
voice).

## Input

One of these — check which the user has; do not assume.

| Reference | What you do with it |
|---|---|
| **Welcome intake** (`app/auis/_data/brand.runtime.json`) | The strongest source. Written by the `/auis/welcome` form: `{ name, tagline, logo, configured }`, with the uploaded logo already sitting in `public/assets/brand/`. Read it and confirm, don't re-ask. |
| **A logo file + a name** the user hands over directly | Treat the file as the mark; place it under `public/assets/brand/` if it isn't already. |
| **Just a name and a description** (agent-run, no form) | Interview (step 3), then generate a simple wordmark if there is no supplied mark. |
| **Nothing** | Interview. Ask for the app name, the one-liner, and a logo path or a description of the mark. |

## Non-negotiables

- **Derive, don't invent.** The name and tagline come from the intake or from the
  user. Do not coin a product name or write positioning the user never gave you.
- **Verify the mark before wiring it.** Confirm the logo file actually exists under
  `public/`, and that it is a sane image (real SVG/PNG/etc., non-empty, plausible
  dimensions). A broken path that silently 404s is worse than no logo.
- **Stay in your lane.** Name, mark, one-line identity — nothing else. No tokens
  (`globals.css` belongs to `auis-foundation`), no voice/vocabulary rules
  (`PRODUCT_CONTEXT.md`'s voice sections belong to `auis-voice`). You write only
  the brand-identity section.
- **Never clobber the user's product with Auis's defaults.** Auis's own wordmark
  (`public/assets/brand/auis-wordmark.svg`) and `AuLogo`'s built-in SVG are the
  *builder's* brand, not the product's. Once the user has a mark, the app must
  point at theirs.
- **Propose, then wait.** Show the normalized name, tagline, mark path, and the
  exact files you will touch. Get an explicit yes before writing.

## Workflow

### 1. Read the intake first

```bash
cat app/auis/_data/brand.runtime.json 2>/dev/null
ls -la public/assets/brand/
```

Three cases:

- **Intake present and `configured: true`** → you have `name`, `tagline`, and a
  `logo` path. Confirm the three values with the user, verify the logo, continue.
- **Intake present but partial** → fill only the gaps; treat what's there as truth.
- **No intake** (agent-run without the form) → interview (step 3).

### 2. Confirm and normalize

- **Name** — the display name of the app. Normalize casing and trim, but keep the
  user's spelling. Note whether it is a wordmark-style name (typeset) or has a
  separate symbol.
- **Tagline** — the one-line "what is your product". Keep it to a single line;
  this is identity positioning, not marketing copy. If the intake's tagline is
  actually two sentences, propose a one-line version and confirm.
- Neither is invented. If the user gave nothing, you interview — you do not guess.

### 3. If there's no intake, interview

Three questions. Keep it short.

1. What is the app called? (the display name)
2. In one line, what is your product? (positioning, not a slogan)
3. Do you have a logo file, or should I generate a simple wordmark from the name?
   (If a file: ask for the path. If generate: confirm it's a plain typeset wordmark,
   not an illustrated mark — that is a designer's job, not this skill's.)

### 4. Verify the mark

- Confirm the file exists under `public/` (the `logo` path in the intake is
  public-relative, e.g. `/assets/brand/<file>`).
- Check it is a real image: non-empty, a recognized format (SVG/PNG/JPG/WebP),
  plausible dimensions. For SVG, confirm it parses and has a `viewBox` or explicit
  size.
- If there is no supplied mark and the user chose "generate", create a simple
  typeset wordmark from the name and save it under `public/assets/brand/`. Keep it
  minimal — this is a placeholder identity, not a logo design.
- If the file is missing or broken, **stop and say so** — do not wire a dead path.

### 5. Record the identity into PRODUCT_CONTEXT.md

Fill the **brand identity** section near the top of `PRODUCT_CONTEXT.md`:

- the app name,
- the one-line positioning,
- where the logo lives (the public-relative path).

Also fill the **What the product is** section if the intake's tagline gives you
enough to write the 2–4 sentence summary — but keep it factual and derived. If it
doesn't, leave that section's placeholder for `auis-voice`, which owns the deeper
voice work, and say so.

> You write the **brand-identity** facts only. Language/locale, voice, protected
> vocabulary, and the copy corpus are `auis-voice`'s sections — never touch them.

### 6. Wire the mark into the app

Point the app's brand config and `components/ui/AuLogo.tsx` at the user's mark
instead of Auis's default:

- Today `AuLogo.tsx` hardcodes `AU_LOGO_ASSET = "/assets/brand/auis-wordmark.svg"`
  and ships Auis's own inline SVG — that is the *builder's* brand.
- Replace the default asset path / brand config so the product's chrome renders
  the user's mark (the `logo` path from the intake).

> **You do not author `.tsx`/`.css` yourself in this repo** — describe the exact
> change (which constant, which config field, the new value) and let the agent or
> the user apply it. Keep the change surgical: the mark path and, if present, the
> app name string. Do not restyle components or touch tokens.

### 7. Validate

- The `logo` path resolves to a real file under `public/`.
- `PRODUCT_CONTEXT.md`'s brand-identity section is filled with the name, one-liner,
  and logo path — and nothing outside that section changed.
- The app's brand config / `AuLogo` no longer points at `auis-wordmark.svg`.
- Run the app and confirm the mark renders in the chrome, if visual fidelity matters.

## Output to return

```
Brand established → PRODUCT_CONTEXT.md + app chrome

Source     <welcome intake / handed-over file / interview>
Name       <app name>
Tagline    <one-line positioning>
Mark       <public-relative logo path>  (verified: yes/generated)
Wired      <AuLogo / brand config change described or applied>

Left alone Tokens → auis-foundation · Voice → auis-voice
Next       Run auis-foundation for tokens, auis-voice for voice — or auis-setup
           to sequence all three.
```

## Notes

- **Brand ≠ tokens ≠ voice.** Three creators, three lanes. If a request drifts into
  colors or type, hand it to `auis-foundation`; if it drifts into tone or wording,
  hand it to `auis-voice`. This skill owns name, mark, and one-line identity only.
- **The intake is disposable.** `brand.runtime.json` records the user's *intent*
  from the welcome form; your job is to materialize it into `PRODUCT_CONTEXT.md`
  and the app. Once materialized, `PRODUCT_CONTEXT.md` is the source of truth.
- **Don't design a logo.** Generating a plain wordmark from the name is in scope;
  illustrating a mark is not. Say so and let the user bring a real asset.
- Related: `auis-foundation` (tokens) · `auis-voice` (voice) · `auis-setup`
  (orchestrates all three first-run).
