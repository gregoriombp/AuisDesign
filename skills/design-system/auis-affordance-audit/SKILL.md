---
name: auis-affordance-audit
description: >
  Walks one route as a first-time user, hovering everything, and files a Review
  Mode pin for each static element that should explain or act: jargon with no
  explanation, a status you cannot change or learn why, an entity name with no
  link, something that looks clickable and does nothing. Read-only: it never
  edits code, and it proposes no control the product does not already have.
  Use for "/auis-affordance-audit", "hover over everything", "this page feels
  static", "what does this mean", "why can't I click this".
argument-hint: "<route>"
---

# Auis Affordance Audit — what sits still and should not

A screen can pass a design critique and still leave the person without an
answer: they hover over "Pro plan" and nothing happens; they see "Active" and
cannot tell whether they can turn it off; they read "Latency 1720 ms" and do
not know what it measures. This skill hunts those dead spots. Every element
that carries meaning has to **explain** (a tooltip or an inline hint),
**act** (a link, a menu, a toggle) or **say why it does not act**.

```
auis-affordance-audit     →  pins (open) + questions for the user
auis-review-bridge-solve  →  in_review   →  the user approves or rejects in the inbox
```

You **find, ask and file**. You do not fix code and you do not transition
anything.

> Prerequisites: the same as `auis-critique` (its §0): the app's dev server
> running, the bridge checked through `/api/review-bridge/health`, and a
> browser you can drive (Playwright MCP, or the app's preview browser).
> Without a browser there is no audit: this skill is about what happens on
> screen.

Out of scope: the scored design critique and accessibility (`auis-critique`),
the wording of the copy (`auis-ux-writing`), the whole design system
(`auis-design-system-audit`).

## Golden rules

1. **First-time eyes, before anything else.** The blind pass (§2) comes before
   reading code, `PRODUCT_CONTEXT.md`, module docs or agent memory. You have
   never seen this product. What you did not understand in that pass is the
   finding; the code only comes in afterwards, to classify it.
2. **Actions need evidence.** Never propose a control the product does not
   have. Before suggesting "a menu to deactivate", find the real operation in
   the code or the data (the function, the route, the state that changes).
   Without evidence, the finding becomes a **question** for the user, not a
   pin with an invented button.
3. **Pin only what you saw.** Every pin points at a rendered element in a
   reproducible state. At most 10 per route; a repeated pattern (every stage
   chip, every metric on a card) is one pin on its first occurrence, with the
   count.
4. **No code edits and no transitions.** Pins are born `open`.
5. **No emoji and no `@handles`** in pin text.

## What is not a finding

- Everything `auis-critique` already excludes: the Auis chrome itself,
  styleguide showcases, demo pages with sample data.
- Text that explains itself: a title, a paragraph, a field label, a value with
  an obvious unit ("5 messages"). A tooltip that repeats the label is noise,
  not a fix.
- An element that already answers: it has a tooltip, a `title`, a link, a menu
  or a focus state with an action.

---

## 1. Setup

Follow §0 of `auis-critique`: `BRIDGE_BASE`, the `/health` check, making sure
the server on that port is this app, and `AGENT_ID`. Tell the user which queue
the pins will land in.

## 2. Blind pass: what does this page want from me?

Open the route at the product's desktop viewport (1440×900 by default), in its
default state. Without reading anything in the repository:

1. **Write the goal hypothesis** in one sentence ("follow an order and step in
   when it stalls"). If not even that comes from the screen, that is already
   the first finding (P1, category `task`).
2. **Inventory what carries meaning.** Badge, chip, status pill, a lone icon,
   an entity name (a person, an account, a channel, a stage), a metric, an
   acronym, truncated text, a counter, a relative date. The snippet below
   lists the static candidates in `main` and side panels: short, visible
   elements outside any control, with no `title` and no `aria-describedby`.

   ```js
   (() => {
     const CHROME = "[data-auis-ui],[data-auis-review],[data-auis-edit],[data-auis-states],[data-auis-dot],[data-auis-portal]"
     const ACTS = "a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=switch],[role=tab],[role=menuitem],[role=combobox],[tabindex]:not([tabindex='-1'])"
     const seen = new Set(), out = []
     for (const el of document.querySelectorAll("main *, aside *, [role=complementary] *")) {
       if (el.closest(CHROME) || el.closest(ACTS) || el.querySelector(ACTS)) continue
       const text = (el.textContent || "").trim().replace(/\s+/g, " ")
       if (!text || text.length > 40 || el.children.length > 2) continue
       const r = el.getBoundingClientRect()
       if (!r.width || !r.height) continue
       if (el.title || el.getAttribute("aria-describedby") || seen.has(text)) continue
       seen.add(text)
       out.push({ tag: el.tagName.toLowerCase(), text, cursor: getComputedStyle(el).cursor })
     }
     return out.slice(0, 120)
   })()
   ```

   It is a starting point, not a verdict: drop what explains itself and add
   what your eye caught and the snippet did not.
3. **Hover over each candidate, for real.** With the Playwright MCP, find the
   element in the snapshot and hover its ref; in a preview browser, move the
   pointer. For each one, note:
   - what you **understood** of it unaided (nothing, a guess, certainty);
   - what **happened** on hover (nothing, a hand cursor, a tooltip, a
     highlight);
   - what you **expected** to happen.
4. **Click what looks clickable** (hand cursor, hover highlight, chevron,
   underline) and note whether it went anywhere. Looking clickable and not
   acting is a finding.
5. Repeat in the other states that matter: tabs, panels, overlays and the
   route's State Mode variants (`lib/auis-states/registry.ts` gives the axes;
   opening the registry does not break rule 1, it only says which states
   exist).

Close the pass with the raw list: element, what I understood, what happened,
what I expected.

## 3. Classify each point with four questions

Now read the context: the route's code and the components it imports, the
sample data, `PRODUCT_CONTEXT.md` for the vocabulary, and the module docs
`AGENTS.md` points to. For each point on the raw list:

| Question | Example | Expected output |
|---|---|---|
| **What does this mean?** A term, an acronym, a product name, a metric with no unit or period | "Pro plan", "Latency 1720 ms" | an explanation on hover or inline; a term the product itself never defines goes to `auis-ux-writing` |
| **Is this a state I can change?** A status, a mode, a stage, a visual toggle | "Active" on an item | if the operation exists: the control (menu, toggle) or a link to where it lives; if it does not exist here: an explanation of why and where it changes |
| **Is this an entity that exists elsewhere?** A person, an account, a channel, a policy | "Owner: Ana Costa" | a link to the entity when its route exists |
| **Does it look like an action and not act?** Hand cursor, chevron, lone icon, card with hover | an icon with no label; a chip that highlights and opens nothing | give it the real action, or remove the look of an action |

To answer "does the operation exist?", search the code, not your memory: the
routes in `app/`, the feature's `lib/` and store, the fields of its types.
Cite the `file:line` that proves it. Three outcomes:

- **It exists and only the path is missing** → a pin with the fix (the real
  `Au*`, the real route, the real function). If the fix needs a component the
  product does not have (Auis ships no tooltip primitive), say so in the fix
  and point at `auis-new-component`.
- **It does not exist, and the absence is deliberate** (a module doc or
  `AGENTS.md` says so) → a pin asking for the explanation on screen, not for
  the control.
- **You cannot tell** → a question for the user in the report. No pin.

## 4. Severity

| | Means | Pinned? |
|---|---|---|
| **P1** | A core element of the task nobody understands, or that looks like it acts and does not; a state the person needs to change and cannot find where | yes |
| **P2** | A term or metric with no explanation; an entity with no link to its own page; a state with no reason why it cannot change | yes |
| **P3** | Polish: a hint that would help a beginner, a convenience shortcut | report only |

Pin category: `task` when an action or link is missing, `copy` when meaning is
missing, `states` when the missing piece is why a state cannot change.

## 5. File the pins

Use the tools of `auis-critique`, by path, without copying them:

- `.claude/skills/auis-critique/critique-probe.js` (`.agents/skills/...` under
  Codex) installs `window.__auisCritique.capture(target)` and `ref(trigger)`
  (its §6). Run the probe on the page, ignore its accessibility findings (they
  belong to `auis-critique`), and capture each finding's element with the
  screen in the state of the problem.
- `.claude/skills/auis-critique/post-pins.py` creates the pins from a findings
  file outside the repository (`$TMPDIR/auis-affordance-findings.json`), in
  the shape documented at the top of the script. Run it with `--dry-run`
  first.

Each finding carries:

- **title**: the element and what it lacks ("Pro plan has no explanation or
  link").
- **problem**: what you understood and what happened on hover, from the blind
  pass.
- **why**: the question the person is left without an answer to.
- **fix**: the concrete answer (§3), with the real `Au*`, route or function.
- **evidence**: the `file:line` that proves the operation exists, or the doc
  that says the absence is deliberate.

Material text for the hint or the reason (a consequence, a permission) belongs
to `auis-ux-writing`: the pin states the intent, and the solver loads that
skill when applying it.

## 6. Report

One message in the chat:

```
Affordance of /route (1440×900, states: default, panel open)
Queue: http://127.0.0.1:<port>/api/review-bridge

Goal the screen conveyed: <the sentence from the blind pass>
Goal according to the code/docs: <same, or where it diverges>

Pins (N), open in the inbox:
  - P1 task · "Active" can't be changed or explained · cmt-...
  - P2 copy · "Pro plan" has no explanation or link · cmt-...

Questions for you (no pin, a product decision is missing):
  - Can an item be paused from this screen, or only from its settings?

Outside the pins:
  - P3 · <polish>
  - Not verified: <states you could not reach>

Next step: auis-review-bridge-solve scoped to /route.
```

## Constraints

- The same as `auis-critique`: no `Edit`/`Write` on product code, no
  transitions, no `DELETE`, never read or write `review-bridge/data/*.json`,
  no pins on the Auis chrome.
- No control, shortcut or action without evidence in the code or a request
  from the user.
