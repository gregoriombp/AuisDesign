---
name: auis-ux-writing
description: Runs a fine-tooth-comb IN-PRODUCT UX writing pass over a route, several routes, or pasted links — reads the real strings from the page's files, audits each one against the Auis PRODUCT voice (it solves, it doesn't sell), proposes rewrites with rationale, waits for approval, and applies surgically (text only, never layout). The voice is inspired by ElevenLabs (efficiency, simplicity, clarity) and OpenAI (warm, concise, confident, never sycophantic), and is anchored in PRODUCT_CONTEXT.md. Use when the user says "/auis-ux-writing", "apply the ux writing", "review the copy on this page", "look at the text/microcopy of /route", "improve the ux writing", "review the labels/errors/empty states", "make this screen match the product tone", or pastes a route/link/text asking for an interface-writing review. This is NOT the marketing/site voice (that is `auis-brand-voice`) and it does NOT touch layout/structure (that is `ux-page-rework`).
argument-hint: "<route(s), link(s), or paste the text>"
---

# UX Writing — Auis (product)

A UX writing pass inside the product. The user points at one route, several, or pastes links/text; you read the real strings, audit them against the product voice, propose rewrites with a reason, and — once approved — apply **text only**. No layout, no props, no logic.

## What this skill IS (and what it is NOT)

- **It IS** an in-product microcopy review: labels, buttons, headings, placeholders, help text, empty states, errors, toasts, tooltips, confirmations, status.
- **It is NOT marketing.** Site/social/sales copy is `auis-brand-voice`. The repo's anchor rule: **the site sells, the product solves** (`PRODUCT_CONTEXT.md` → "Voice: site ≠ product"). This skill is the **product** voice. A sales slogan inside the UI is an antipattern.
- **It does NOT touch layout.** Reorganizing hierarchy, swapping a component, proposing two directions on branches — that is `ux-page-rework`. Here it is surgical: swap the string, keep everything else.
- **It is NOT the generic `ux-copy`.** That one is generic and product-blind. This one is Auis: it follows `PRODUCT_CONTEXT.md`, knows the routes, and edits the real files.

---

## The voice (the spec)

A synthesis of three sources. The first two give the *principle*; the third rules the *result* — when they conflict, the Auis product voice wins.

### The 4 pillars (ElevenLabs)

1. **Efficiency** — maximum meaning in the fewest words. Respect the reader's time.
2. **Simplicity** — everyday words, not bureaucratic ones. "use" > "utilize", "do" > "perform", "by" > "by means of".
3. **Clarity** — no unverifiable value judgments. Nothing like "powerful", "revolutionary", "cutting-edge", "intelligent" as decoration. Let the reader draw the conclusion.
4. **Freshness** — get to the point. No warm-up ("At this time, it is important to note that…").

### The 3 rules (Orwell, via ElevenLabs)

1. Never use a long word where a short one will do.
2. If it is possible to cut a word out, cut it out.
3. Never use the passive where you can use the active.

### The OpenAI layer

- **Warm, concise, confident, never sycophantic.** Warmth in the intent, concision in the form.
- **Plain language**, even when technical.
- **Calm clarity** with a light trace of personality — but restrained; this is an enterprise product. Never cute, never fawning ("Great choice!", "You're amazing!").

### The Auis product tone (this one rules)

Straight from `PRODUCT_CONTEXT.md`. The product **solves** — every string helps the reader understand what something does, why it exists, and what happens on click.

- **Friendly imperative + clear objective:** "Set the main objective to start configuring the agent's behavior."
- **Explicit mechanics** (the product always says how it works underneath): "Every 5 minutes, the system checks all active conversations in the campaign and identifies leads that haven't replied."
- **Empty state that teaches, doesn't sell:** "Create your first conversation to test your agent."
- **Calm status:** "Saved as draft at 13:48".
- **Error that guides, doesn't judge:** "Command prompt is empty. The prompt is required to publish the agent."
- **Recommendation anchored in a reason:** "The checkpoint settings aren't optimized for the agent's objective."

> Before rewriting, **read 2-3 strings that already exist on the route.** The canonical corpus is in `PRODUCT_CONTEXT.md` (§ Canonical copy corpus). Copy the tone from there — don't invent a new one.

### Language & locale (follow the product, don't import English)

The principles above are language-independent. The **output language is not yours to pick**: read `PRODUCT_CONTEXT.md` → **§ Language & locale** for the product's copy language and its date, number/currency, and casing conventions, and write to that. Never import English/US formatting or idiom when the product's locale says otherwise.

- **Copy language:** whatever `PRODUCT_CONTEXT.md` declares. This skill follows the product's language — it does not impose one.
- **Date, number, currency:** the formats declared in § Language & locale. A source you're borrowing a principle from (ElevenLabs, OpenAI) may use US formats — take the principle, not the format.
- **Casing:** as declared in § Language & locale (typically sentence case for buttons, labels, and headings; no decorative ALL CAPS).
- **Active voice, present tense:** "The agent sends the follow-up" > "The follow-up will be sent by the agent". "Every 5 min the system checks" > "the conversations will be checked".
- **Talk to "you", not to "the user".**
- **Cut the bureaucracy, keep the precision.** The product is technical-but-digestible: "Configure", "Set", "Select" stay (they are clear imperatives). The target is bureaucratic filler, not the technical term.

Quick swaps (bureaucratic → clear):

| Bureaucratic | Clear |
|---|---|
| utilize | use |
| perform / execute | do |
| by means of | by / via |
| in order to / for the purpose of | to |
| at the moment when | when |
| possesses | has |
| it is necessary that you | you need to / just |
| perform the configuration of | configure |
| proceed with | follow / do |

> The table illustrates the *principle* in English. Apply the same principle in the product's own language — every language has its own bureaucratic register to cut.

### Antipatterns (reject on sight)

- Marketing slogan in the UI (a tagline like "You set the objective, we build it" does not belong in a label).
- Adjective without data: "powerful", "complete", "robust", "intelligent" (as decoration), "next-generation".
- "Transform", "revolutionize", "supercharge".
- "Coming soon" as feature content (Coming Soon is a page, not label copy).
- Textual placeholder ("Imagine there's an X here").
- Passive and future tense where the present works ("will be displayed" → "appears").
- Flattery ("Good choice!", "Perfect!") and gratuitous exclamation marks.
- Decorative Title Case and ALL CAPS (follow the casing declared in § Language & locale).
- A tooltip that repeats what the label already says.
- `font-mono` as decoration (mono only for real code shown in a block).
- Inventing a term outside the protected vocabulary (see below).

### Protected vocabulary — do NOT rewrite

The product's fixed terms are declared in `PRODUCT_CONTEXT.md` → **§ Protected vocabulary** (plus the Figma source of truth, when the product has one). Treat every term listed there as protected: never translate it, never "improve" it, never swap it for a synonym you find nicer. When the site and the product use different words for the same thing, the **product** term wins inside the UI — the marketing term belongs to `auis-brand-voice`. If the word you want isn't on that list, you're inventing product vocabulary: flag it as a product decision instead of shipping it.

---

## Copy patterns by element type

| Element | Structure | Good example |
|---|---|---|
| **Button / CTA** | verb + object; say the outcome | "Publish agent" (not "Submit", not "OK") |
| **Empty state** | what it is + why it's empty + how to start | "Create your first conversation to test your agent." |
| **Error** | what happened + why + how to fix it | "No variables found. Add at least one for the agent to work." |
| **Help text** | what it does + how it works underneath | "Sets the sending window (e.g. 08:00–22:00). Messages outside it are rescheduled to the next allowed slot." |
| **Status** | factual and calm | "Saved as draft at 13:48" · "8 of 9 triggers active" |
| **Confirmation** | clear action + consequence; buttons carry the verb | "Delete 3 checkpoints? This can't be undone." → "Delete" / "Cancel" |
| **Toast** | outcome in one line | "Agent published." (not "Success!") |
| **Tooltip** | only what the label doesn't say | (on `@`) "Inserts a system variable" |
| **Field label** | short noun | "Agent objective" (not "Enter your agent's objective here") |

---

## Workflow

### Phase 0 — Context (before anything else)

1. **User memory:** `~/.claude/projects/<repo-encoded>/memory/MEMORY.md` — already-validated tone conventions.
2. **Repo rules:** `AGENTS.md` (hard rules) and, in `PRODUCT_CONTEXT.md`, **§ Language & locale**, **§ Voice: site ≠ product**, and **§ Protected vocabulary**.
3. **git status.** If the working tree is dirty, ask (commit/stash/ignore). If ignoring: **never** `git add .` / `-A` — always file by file.
4. **Dev server:** if something is running on `:3000`, leave it alone (hot reload picks it up). Don't kill it (Next 16 blocks a 2nd instance; the server is shared on the LAN).

### Phase 1 — Resolve the targets

Input arrives in three shapes. Classify each item:

- **Route / internal link** (`/agent-studio`, `localhost:3000/...`, the LAN IP, `?step=`) → **TARGET**. Map it to the file: `app/<route>/page.tsx` + local `_components/`. If the route has tabs/sub-routes, read the tabs file and list the children.
- **External link** (elevenlabs.io, openai.com, any site) → voice **REFERENCE**, never a target. Absorb the principle, declare that it's inference, and **edit nothing from there**.
- **Figma** (`figma.com/...`) → the product's **canonical copy source**. Use the Figma MCP to read the official text (Agent Studio / Memory Base have canonical copy there) and align the route to it.
- **Loose pasted text** (no route) → review it in chat and hand it back; only edit a file if the user points at one.

**List the files you're going to touch, with the role of each, and confirm** before moving on. If you inferred wrong, the user corrects you here.

Modes:
- **Audit** ("look at the ux writing of X") → deliver the diagnosis and **ask** whether to apply.
- **Apply** ("apply the ux writing to X") → go through to Phase 4, always passing the Phase 3 gate.

### Phase 2 — Extract the strings

Pull **only the text the user sees**: headings, labels, placeholders, button text, help/description, empty states, error messages, toasts, tooltips, visible `aria-label`.

Don't touch: variable names, object keys, `console.log`, comments, imports, and **mock data that is real content** (agent names, companies, metrics from `PRODUCT_CONTEXT.md`) — unless it's clearly UI copy.

If the strings are centralized (an i18n/constants file), edit **there**; if they're inline in the JSX, edit them inline.

### Phase 3 — Audit + propose (GATE)

For each problematic string, build the table. **Don't list what's already good** — churning good copy is busywork (and the user hates over-spec). Mark severity as text, **no emoji**:

```
Page: /agent-studio  ·  file: app/agent-studio/_components/Header.tsx

| Where | Current | Problem | Proposed | Sev |
|---|---|---|---|---|
| Header button | "Submit" | vague verb, doesn't say the outcome | "Publish agent" | Fix |
| Objective help | "Utilize this field to perform the definition of the objective" | bureaucratic + passive | "Set the agent's objective." | Fix |
| @ tooltip | "Click to insert a variable here" | repeats the obvious | "Inserts a system variable" | Polish |
```

Close with **"Left as is (already on tone):"** + 2-3 examples, to show you didn't go rewriting everything.

**STOP.** Wait for approval. The user can approve everything, only the "Fix" items, cut some, or redirect. If something depends on a product decision (a new term, a flow change), **don't decide alone** — mark it "needs a decision" and move on without it.

### Phase 4 — Apply (surgical)

1. **Edit string by string** in the `.tsx`. Text only. Don't touch structure, props, classes, or logic.
2. **Preserve interpolation:** `{{lead_name}}`, `${var}`, template literals, `<strong>`, pluralization. The text changes around the variable; the variable stays.
3. **Don't create a token or a component.** If the new copy needs space/wrapping the component doesn't give, **report it** — don't force `text-[..]` and don't refactor the component (that's another skill).
4. **Validate before closing:**
   - `npx tsc --noEmit` clean.
   - For each route touched, if the dev server is up: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000<route>` → expect 200/3xx. (Visual verification, if asked for, is via the Playwright MCP pointing at the LAN IP.)
5. **Selective staging:** `git add <file>` for each file touched. **No commit, no push** unless the user asks (then the style is `copy(<route>): ...`).

### Phase 5 — Report

- What changed, grouped by route/file.
- The principles applied (1 line: "cut the passive voice and the bureaucratic filler, activated the CTA verbs").
- What got flagged but not changed (needs a product decision, or canonical copy that came from Figma).
- What was **not** touched (layout, tokens, components) — to make the scope clear.

---

## Repo rules (inherited — always apply)

- **Tokens are sacred.** This skill neither creates nor touches a token. `text-[#hex]`, `p-[Npx]`, etc. are forbidden.
- **Components before code.** Don't create a component to accommodate copy; report the squeeze.
- **Desktop-only.** Don't write copy about "swipe", "tap", "on your phone".
- **No emoji** in UI, docs, or agent output, unless explicitly asked for or already present in a source asset.
- **Material Symbols** is the default icon; `font-mono` only for real code.
- **The product's language** follows the existing corpus. Don't drift into another language and don't swap a term the repo already uses for a synonym you prefer — check `PRODUCT_CONTEXT.md` → § Language & locale and the strings already on the route first.

## Edge cases

- **Working tree dirtied by another agent** → `git add` per file, never `-A`.
- **Format-on-save linter** may rewrite mid-flight → re-read the file before the next Edit.
- **String repeated in N places** (same label across several files) → change it everywhere so you don't create an inconsistency; list them all in the report.
- **Copy that came from Figma** (Agent Studio / Memory Base) is canonical → align the route to Figma, not the other way around; if they diverge, ask.
- **Mobbin/Dribbble** as a reference → WebFetch fails (paywall). Ask for a screenshot or use declared inference. But the reference here is **voice/principle**, not visual.
- **Route is a redirect** (`page.tsx` that only calls `redirect()`) → work on the sub-routes, not on the redirect.

## Voice references (declared, not copied)

The inspiration informs the **principle**, not the text — just like "reference informs structure, not style" everywhere else in the repo.

- **ElevenLabs** — efficiency, simplicity, clarity, the 3 rules, sentence case, no empty value judgments. ([guidelines](https://11labs-guides-dev.a17.dev/))
- **OpenAI** — warm, concise, confident, never sycophantic; plain language; calm clarity with restrained personality.
- **Stripe** — precise, technical-but-human, never shouts (already a reference for `auis-brand-voice`).
- **Rules the result:** the Auis product voice in `PRODUCT_CONTEXT.md` — **it solves, it doesn't sell**.
