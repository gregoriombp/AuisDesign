---
name: auis-voice
description: >
  Bootstraps a product's voice by filling in PRODUCT_CONTEXT.md — the file every
  Auis writing skill reads. Derives the copy language and locale, the site-vs-product
  voice, the protected vocabulary, and the canonical copy corpus from a reference:
  the user's existing product (URL, screenshots, a running app), the real strings
  already in the repo, a brand or tone-of-voice document, or an interview when there
  is nothing else. Proposes before writing and never invents a voice the evidence
  does not support. This is the ONLY skill allowed to author PRODUCT_CONTEXT.md's
  voice sections — auis-ux-writing and auis-brand-voice consume them. Use when the
  user asks to "set up the product voice", "define the tone of voice", "fill in
  PRODUCT_CONTEXT", "bootstrap the copy guidelines", "what should our microcopy
  sound like", "create the writing guidelines", "extract the voice from our
  product/site", or tries to run a writing skill and finds PRODUCT_CONTEXT.md empty.
---

# Auis — Product Voice Foundation

Turn a reference into a filled `PRODUCT_CONTEXT.md`: the language the product
speaks, the voice it speaks in, the words it must never rewrite, and the real
strings that prove it.

This skill is to writing what `auis-foundation` is to design. Foundation is the
only skill that creates **tokens**; this is the only one that creates **voice**.
`auis-ux-writing` (in-product microcopy) and `auis-brand-voice` (site/marketing)
both read what you write here — until it exists, they produce generic copy.

## Input

Any one of these. Ask which the user has; do not assume.

| Reference | What you do with it |
|---|---|
| **An existing product** (URL, screenshots, a running app) | Read its real strings. This is the strongest source — the voice already exists, you are transcribing it, not inventing it. |
| **Strings already in this repo** | If the user has built pages, harvest them. Same principle: describe what is there. |
| **A brand / tone-of-voice doc** | Parse it into the file's sections. Flag anything it asserts that the real strings contradict. |
| **Reference products they admire** | Weakest source — it gives you aspiration, not identity. Use it only to *frame* an interview, never to fill the file on its own. |
| **Nothing** | Interview. See step 4. |

## Non-negotiables

- **Derive, never invent.** Every line you write must trace to something you read
  or something the user told you. A voice you made up will be confidently wrong,
  and every writing skill downstream will inherit it.
- **The corpus must be real strings.** `## Canonical copy corpus` exists so other
  skills can copy a tone instead of guessing one. Paste strings that actually exist.
  If you have none, leave it empty and say so — an empty section is honest; an
  invented one is a trap.
- **Never impose a language.** Auis is product-agnostic. Read the locale off the
  evidence, or ask. Do not default to English because the repo's docs are English.
- **Never clobber a filled file.** If `PRODUCT_CONTEXT.md` already has content,
  diff against it and propose changes — do not overwrite. The user may have hand-tuned it.
- **Propose, then wait.** Show the full draft and get an explicit yes before writing.
  This file steers every string in the product; it is not a silent edit.
- **Voice ≠ tokens.** You do not touch `globals.css`, components, or routes. If the
  user wants the design system bootstrapped, that is `auis-foundation`.

## Workflow

### 1. Read the current state first

```bash
cat PRODUCT_CONTEXT.md
```

Three cases:

- **Untouched template** (HTML-comment placeholders intact) → full bootstrap, continue.
- **Partially filled** → treat the filled sections as truth. Fill only the gaps,
  and say which sections you are leaving alone.
- **Filled** → stop and ask. Offer to audit it against the product's real strings
  instead (that is often what the user actually wants).

### 2. Get the reference

Ask, plainly: *"What should I read to learn your product's voice — an existing
product, a site, a tone-of-voice doc, or should we talk it through?"*

If they point at a URL or a running app, read it. If they point at screenshots,
read those. If they say "it's in the repo", go to step 3.

### 3. Harvest the real strings

Whatever the source, get to actual copy. If there is anything shipping in this repo:

```bash
# user-facing strings in the app: labels, buttons, headings, empty states, errors
git grep -rnE '>[A-Z][^<>{}]{3,60}<' -- "app/**/*.tsx" "components/**/*.tsx" | head -60
git grep -rnE '(placeholder|title|aria-label|label)="[^"]{3,60}"' -- "app/**/*.tsx" | head -40
```

Read 30–60 of them. You are looking for the product's actual habits, not its
aspirations:

- **Language and locale** — what language are they in? How are dates, numbers and
  currency formatted? Sentence case or Title Case on buttons?
- **Verb style** — imperative ("Create a workspace") or passive ("Workspace creation")?
- **Length** — terse or explanatory? Do errors say what to do next, or just what broke?
- **Recurring nouns** — the words that name the product's own concepts. These become
  the protected vocabulary: the terms other skills must never "improve" or translate.
- **Tells** — bureaucratic filler, marketing slogans inside the UI, apologetic
  hedging ("Sorry, something went wrong"). Note them; they are what the writing
  skills will later fix.

### 4. If there is no evidence, interview

Six questions. Keep it short — a long questionnaire gets abandoned half-answered.

1. What does the product do, for whom, and what is the promise? (→ § What the product is)
2. What language do your users read, and where are they? (→ § Language & locale)
3. Show me two products whose writing you admire, and one you don't. Why?
4. What does your product call its core objects? Which of those names are non-negotiable? (→ § Protected vocabulary)
5. When something breaks, should the product apologize, explain, or just fix it?
6. Is there a word or tone you never want to see in the UI?

### 5. Draft, and show your evidence

Fill every section of `PRODUCT_CONTEXT.md`. Beside each claim, cite what it came
from — a real string, a line from their doc, an answer they gave. Present it as:

```
§ Language & locale
  Copy language      Português (BR)          ← every string in app/ is PT-BR
  Date format        DD/MM/YYYY              ← "09/04/2026" in InvoiceRow.tsx:34
  Number / currency  1.234,56 · R$           ← "R$ 5.268,49" in notifications.ts:52
  Casing             Sentence case           ← "Publicar agente", not "Publicar Agente"

§ Protected vocabulary
  Workspace   the tenant a team works inside   ← 14 occurrences, never varied
  ...

§ Canonical copy corpus  (6 real strings)
  "Create your first conversation to test your agent."   ← EmptyState.tsx:22
  ...
```

Where the evidence is thin, **say so** rather than filling the gap. "I found no
error messages in the repo, so § Errors is unfilled — paste three and I'll add them"
is a better outcome than an invented rule.

### 6. Wait for approval, then write

Apply to `PRODUCT_CONTEXT.md` only after an explicit yes. Preserve the file's
section structure and headings — the writing skills navigate it by section name.

### 7. Validate

- Every section either has real content or is explicitly, visibly empty.
- No invented example strings anywhere.
- `## Language & locale` is filled — `auis-ux-writing` reads it to know what
  language to write in, and defaults to nothing useful without it.
- Tell the user what is now unblocked: `auis-ux-writing` for in-product copy,
  `auis-brand-voice` for site/marketing.

## Output to return

```
Voice bootstrapped → PRODUCT_CONTEXT.md

Source          <what you read: URL / N strings from the repo / interview / doc>
Language        <language + locale, and what proved it>
Voice           <2-3 lines: the product's actual habits, not adjectives>
Vocabulary      <N protected terms>
Corpus          <N real strings> (or: empty — no shipping copy yet)

Thin evidence   <sections you could not fill, and what would fill them>
Unblocked       auis-ux-writing · auis-brand-voice
```

## Notes

- **The product's voice is not the repo's voice.** Auis's own docs are English and
  written for engineers. The product you are describing may be Portuguese, Japanese,
  or deliberately playful. Never let one bleed into the other.
- **Vocabulary is the highest-leverage section.** Most bad AI copy comes from an
  agent "improving" a term the product had deliberately chosen. A filled
  `## Protected vocabulary` prevents that outright.
- **Come back when the product changes.** This is a living file. When the product
  gains a concept or drops one, re-run this skill on the diff rather than editing
  by hand — that keeps the corpus real.
- Related: `auis-foundation` (tokens) · `auis-ux-writing` (in-product copy, consumes
  this) · `auis-brand-voice` (site/marketing copy, consumes this).
