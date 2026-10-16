---
name: auis-critique
description: >
  Design-quality critique of one route, delivered as Review Mode pins instead
  of a throwaway report. Reads AGENTS.md, PRODUCT_CONTEXT.md and the route
  (code plus the rendered page), classifies the surface (Persuade, Operate,
  Read, Experience), then runs two independent passes: a heuristic design
  review scored 0-4 (hierarchy, primary task, DS consistency, character,
  loading/empty/error states) and deterministic checks (ds:check plus contrast,
  missing labels, skipped headings, small targets). Every P0-P2 finding becomes
  an open pin anchored to its element, signed by the agent; P3 and the
  scorecard go in the chat summary. Never edits code: the user triages in the
  inbox and auis-review-bridge-solve fixes. Use for "/auis-critique", "critique
  this page", "review the design of /x", "design QA", "accessibility check on
  this route", "what's wrong with this screen", or "pin the problems on /x".
---

# Auis Critique — design review that lands as pins

A critique is only useful if someone acts on it. This skill finds the problems
on one route and files each one as a **persistent Review Mode pin** on the
element it is about, so the loop closes in the tools Auis already has:

```
auis-critique        →  pins (open)  →  user triages in the inbox
                                         ↓
auis-review-bridge-solve  →  in_review  →  user approves / rejects
```

You **find and file**. You do not fix, resolve, transition or delete anything.

> Prerequisites: the app's dev server is running (`npm run dev`), and a browser
> you can drive (Playwright MCP, or the app's preview browser). Without a
> browser you can still run the code-only parts; say so, and pin nothing you
> did not see rendered.

## Files in this skill

| File | What it is |
|---|---|
| `critique-probe.js` | One function to pass to the browser's evaluate tool. Installs `window.__auisCritique.capture(target)` (the pin anchor + context for any element, mirroring `kit/core/src/elementAnchor.ts` and `elementContext.ts`) and returns the deterministic a11y findings, each already captured. |
| `post-pins.py` | Reads a `findings.json`, skips what was already pinned, and creates one pin per P0-P2 finding through `PUT /api/review-bridge/comments/:id`. Stdlib only. |

Both sit next to this file in the skills tree (`.claude/skills/auis-critique/`
or `.agents/skills/auis-critique/`). Read the probe with your file tool and pass
its full text as the evaluate function.

## Golden rules

1. **Two passes, combined last.** Score the design review (§3) *before* you
   look at the deterministic results (§4). The checks are evidence, not the
   verdict; a page can pass every check and still fail its main task.
2. **Pin only what you saw.** Every pin points at a rendered element in a
   reproducible state. A guess about a state you could not reach goes in the
   summary as "not verified", never as a pin.
3. **Quality over count.** At most 10 pins per route (the poster enforces it).
   Two problems on one element are one pin. A whole-page problem is one pin on
   the element that best stands for it, plus a `ux-page-rework` suggestion in
   the summary.
4. **No code edits, no transitions.** Pins are born `open`. The fix is
   `auis-review-bridge-solve`'s job after the user triages.
5. **Never touch `review-bridge/data/*.json`.** Only the same-origin API.
6. **No emoji, no `@handles`** in pin text. Agent-authored comments never fire
   the mention trigger, and resolution goes through triage.

---

## 0. Setup — which app, which queue

```bash
BRIDGE_BASE=${BRIDGE_BASE:-http://127.0.0.1:3000}
curl -s "$BRIDGE_BASE/api/review-bridge/health"
# expect {"ok":true,...,"mode":"serverless","schemaVersion":3}
```

**Make sure the server on that port is THIS app.** Another checkout or another
host app can hold :3000, and its bridge answers the same health check; pins
filed there land in somebody else's queue. If the dev server came up on another
port (Next moves to 3001+ when 3000 is taken), export
`BRIDGE_BASE=http://127.0.0.1:<port>`. Before the first write, tell the user
which queue you are writing to.

A non-loopback `BRIDGE_BASE` that the user did not ask for: stop and ask. When
`BRIDGE_AGENT_TOKEN` is set, `post-pins.py` sends it.

Sign as the runtime that is running: `AGENT_ID=claude` (default), `codex` or
`grok`. Any other id is rejected by the bridge.

## 1. Read the context

1. `AGENTS.md` — the DS rules you will judge consistency against (`Au*`
   components, tokens only, `Icon` for glyphs, overlays through `AuModal` /
   `AuSheet`, no emoji).
2. `docs/component-map.md` — which `Au*` exists for what, so a "use X instead"
   suggestion names something real.
3. `PRODUCT_CONTEXT.md` — product, audience, language, voice. It ships as a
   template. **If its voice sections are still HTML comments, say so and do
   not judge copy against a voice that does not exist**; judge only clarity.
4. The route's code: `app/<route>/page.tsx`, the local components it imports,
   and, for a State Mode screen, its entry in `lib/auis-states/registry.ts`
   (the `?state=` axes and `?ge=` interactions you can reach).
5. The rendered page, in the browser, at a desktop viewport (1440×900 unless
   the product says otherwise). Screenshot the default state.

## 2. Classify the surface

What did the visitor come to do? The mode changes what "good" means.

| Mode | Typical routes | The page succeeds when |
|---|---|---|
| **Persuade** | landing, pricing, signup | the value is clear in one screen and one action is obviously next |
| **Operate** | dashboards, settings, tools, lists, editors | the frequent task is fast, state is legible, mistakes are recoverable |
| **Read** | docs, help, changelogs, styleguide pages | the reader finds the answer and can scan, navigate and return |
| **Experience** | portfolio, gallery, showcase | the work is the hero and the chrome stays out of its way |

Pick one and state it with a one-line reason. A mixed page takes the mode of
its primary task.

## 3. Pass A — design review (scored, before any checks)

Walk the page like its user. Open what can be opened: tabs, menus, the
overlays, every State Mode variant (`?state=empty|loading|error|...`), hover
and focus on the main controls. Then score each heuristic **0-4**, or **n/a**
when it does not apply to this mode.

| Heuristic | Ask | Weight by mode |
|---|---|---|
| **Hierarchy** | Is there one clear focal point? Does size/weight/position follow importance? | all |
| **Primary task** | Can the main job be found and finished without hunting? Is the main action visually primary and the rest secondary? | Operate, Persuade: high |
| **DS consistency** | Real `Au*` components, tokens, `Icon`, `AuModal`/`AuSheet` for overlays; no one-off look-alikes; spacing on the scale | all |
| **Character vs generic** | Does it look like this product, or like a template? Is the density and tone right for the mode? | Persuade, Experience: high; Operate: medium |
| **States** | Loading, empty, error, permission/read-only, disabled: do they exist, explain themselves, and offer a way forward? | Operate: high; Read: low |
| **Clarity of copy** | Labels say what happens; errors say what to do; no jargon or filler | all |
| **Navigation & wayfinding** | Where am I, how do I go back, what is selected? | Read, Operate: high |

Scale: **4** nothing to fix · **3** minor polish · **2** real friction, has a
workaround · **1** serious problem for most users · **0** broken or missing.

Write the scorecard down now. Every score of 2 or less needs at least one
finding behind it.

## 4. Pass B — deterministic checks

### 4a. DS hygiene

```bash
npm run ds:check
```

It scans the whole repo. Keep only lines whose file is the route's
`page.tsx` or a local component that page imports. For each one kept, find the
element that line renders (read the JSX, then locate it on screen) so the
finding can be anchored. A ds:check line you cannot tie to a rendered element
goes in the summary with its `file:line`, not in a pin. `note`-level results
(arbitrary sizes) are P3 unless they visibly break the layout.

### 4b. Accessibility probe

Run `critique-probe.js` through the browser's evaluate tool on **each state
you reviewed** (navigate to the state URL first; the probe captures whatever
is on screen). It reports:

| Rule | Standard | Default severity |
|---|---|---|
| `contrast` | WCAG 1.4.3: 4.5:1 text, 3:1 large text | P1 (P2 for placeholder or decorative text) |
| `missing-label` | form field without a label; placeholder does not count | P1 |
| `missing-name` | button/link/control with no accessible name (icon-only without `aria-label`) | P1 |
| `img-alt` | image without `alt` | P1, P3 if decorative |
| `heading-skip` | heading level jumps (h2 → h4) | P2 |
| `target-size` | interactive target under 24×24 px (WCAG 2.5.8); inline links in prose are exempt | P2 |

It also returns the heading outline (`headings`): no `h1`, or several, is worth
a P2/P3 depending on mode.

Move the pointer off the content before running it: a hovered row or button
has its hover background, and the probe would measure that instead of the
resting state.

Treat the probe as evidence that still needs your eyes:
- `contrast` with `uncertain: true` sits on a gradient or image; check the
  screenshot before filing it.
- A finding inside a disabled control, a skeleton, or a purely decorative
  element is not a failure.
- One root cause, many hits (every caption in a table using the same muted
  token): **one** pin on the first instance, naming the token and the count.

## 5. Combine, rate, decide

Merge both passes into one list. Each finding gets a severity:

| | Means | Pinned? |
|---|---|---|
| **P0** | Blocks the task: the main action is missing, broken, unreachable, or invisible | yes |
| **P1** | Serious difficulty for many users, or an accessibility failure (WCAG A/AA) | yes |
| **P2** | Real friction that has a workaround; DS inconsistency a user can see | yes |
| **P3** | Polish: alignment, a softer word, a nicer empty-state illustration | summary only |

Then for every P0-P2 write:

- **title**: short, specific, about the element ("Search field has no label",
  not "Accessibility issue").
- **problem**: what is wrong, as seen.
- **why**: who it hurts and how.
- **fix**: the concrete change, naming the real `Au*` component, prop or token
  (`AuInput` with `label=`, `text-fg-secondary` instead of `text-fg-muted`). If
  the right fix needs a token that does not exist, say so: only
  `auis-foundation-update` may add one.
- **evidence**: the measurement or the `file:line`.

## 6. Capture each pinned finding's anchor

The probe already captured its own findings
(`window.__auisCritique.findings[i].capture`). For a design-review finding,
capture the element yourself, **with the page in the state the problem is
in** (variant URL loaded, overlay open):

```js
() => window.__auisCritique.capture({ text: "New item", tag: "button" })
// or a CSS selector:  window.__auisCritique.capture("main h1")
// optional pin offset inside the box: capture(target, 0.1, 0.5)
```

After any navigation, re-run the probe first: `window.__auisCritique` lives on
the page. The capture carries:

- `url` with its query, so a State Mode pin opens on the right variant
  (`/auis/states/example?state=empty`). An element inside an overlay keeps the
  `?ge=` interaction that opens it;
- `anchor.el` (selector + fingerprint) so the pin follows reflow;
- `context.location`, the landmark trail (`["Modal: New item", "Form"]`) the
  solver uses to find the element in code;
- `context.target` (tag, text, attributes, rect) and `nearbyText`.

If a capture returns `{ error }`, the element is not on screen in this state;
reproduce the state or move the finding to the summary.

**Findings inside an overlay** (modal, sheet, menu) also need a `revealPath`:
the trigger that opens it, so Review Mode can replay the click before drawing
the pin. Capture the trigger with the overlay **closed** (its selector is
taken from the page as it is), then open the overlay and capture the element:

```js
() => window.__auisCritique.ref({ text: "New item", tag: "button" })
// → { selector, fingerprint, label }   put it in the finding as "revealPath": [ ... ]
```

Up to 6 steps, outermost trigger first. A State Mode `?ge=` URL already
replays the interaction for the State driver; the `revealPath` is what Review
Mode itself uses, so send both.

## 7. File the pins

Write the findings to a scratch file (not the repo), e.g.
`$TMPDIR/auis-critique-findings.json`, in the shape documented at the top of
`post-pins.py`, with each finding's `capture` pasted in. Then:

```bash
SKILL_DIR=.claude/skills/auis-critique   # .agents/skills/auis-critique under Codex
BRIDGE_BASE=http://127.0.0.1:<port> AGENT_ID=claude \
  python3 "$SKILL_DIR/post-pins.py" "$TMPDIR/auis-critique-findings.json" --dry-run
# read the plan, then run it again without --dry-run
```

What the poster does, so you can reason about failures:

- checks `/health` and refuses a bridge that is not this schema;
- lists open, in-review and backlog comments and **skips any finding whose
  first line already exists on the same route path**, so re-running a
  critique does not double the inbox;
- creates each pin with `PUT /comments/<new id>`: a full `ReviewComment`
  (`schemaVersion: 3`, `status: "open"`, `origin: "page"`, `authorKind:
  "agent"`, `authorId`/`authorName` of the agent, the capture's url, viewport
  metrics, anchor and context) plus the `x-bridge-agent-id` header. The server
  signs it with the agent's identity and colour and forces `open`;
- formats the text as:

```
[critique P1 · a11y] Search field has no label
The search input on the toolbar only has a placeholder. Screen-reader users hear "edit text" with no purpose, and the hint disappears once someone types.
Fix: give the AuInput a visible label, or aria-label="Search items" if the layout cannot fit one.
Evidence: missing-label · app/auis/states/example/page.tsx:131
```

Creation carries no `actor` field. `actor` belongs to transitions, which this
skill never runs.

## 8. Verify, then report

Open the route with Review Mode on and confirm the pins sit on their elements
(at least the first one), and that they appear in the inbox at
`/auis/styleguide/review`. A pin that lands in the wrong place means the state
at capture time differs from the state its `url` reproduces: recapture.

Then report once, in chat:

```
Critique of /route (Operate, 1440×900, states: default, empty, error)

Scorecard
  Hierarchy 3 · Primary task 2 · DS consistency 4 · Character 3 · States 2 · Copy 3 · Navigation n/a

Pinned (N), open in the inbox:
  - P1 a11y · Search field has no label · cmt-...
  - P2 states · Error state offers no retry · cmt-...

Not pinned:
  - P3 · <polish items>
  - ds:check lines with no rendered element: file:line ...
  - Not verified: <states you could not reach>

Next: triage the pins at /auis/styleguide/review, then run
auis-review-bridge-solve on the ones you keep.
```

The scorecard and P3 list live in this message only. Do not write a report
file: the pins are the durable output.

## Constraints

- No `Edit`/`Write` on product code, tokens, or the registry.
- No `transition` of any kind, no `DELETE`, no editing an existing comment.
- No reading or writing `review-bridge/data/*.json`.
- No pins on Auis's own chrome (`[data-auis-ui]`, Review/Edit/State Mode
  overlays, the dot); the probe already ignores it.
- Do not critique against `PRODUCT_CONTEXT.md` voice rules that are not filled
  in.
- Use `auis-critique` rather than the generic `design:design-critique` or
  `design:accessibility-review`: those return a report; this files work into
  the queue.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Health passes but the route 404s | the server on that port is another app | find this app's port, set `BRIDGE_BASE` |
| `400 unknown_agent_author` | `AGENT_ID` not in `kit/core/src/agentIdentity.ts` | use `claude`, `codex` or `grok` |
| `403 agent_auth_required` | deployment with auth | export `BRIDGE_AGENT_TOKEN` |
| `400 invalid_comment` | a capture field is missing | recapture; the poster needs `url`, viewport metrics, `anchor`, `context` |
| Pin shows at the top-left or on the wrong element | captured in a different state than the `url` reproduces | load the exact variant URL, open the overlay, recapture |
| Probe returns hundreds of `contrast` hits | one token used everywhere | one pin naming the token, count in the evidence |
| `window.__auisCritique` is undefined | the page navigated since the probe ran | run the probe again |
