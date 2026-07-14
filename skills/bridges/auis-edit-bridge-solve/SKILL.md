---
name: auis-edit-bridge-solve
description: >
  Materializes Auis Live Edit Mode overlays into real code. The page
  editor stores non-destructive edit "ops" (text, style token, variant/size,
  icon, icon optical axes, token-value edits, custom/off-palette colors,
  hide/remove, move/reorder-siblings) per route in page-editor/data via
  the serverless /api/page-edits route; this skill reads them with a filter
  chosen by the user (a whole route, only open ones, a specific id, everything),
  makes ONE PLAN BEFORE touching any code, waits for approval, rewrites the real
  TSX (text→string literal, variant→prop, style→token class/prop, icon→icon
  prop, hide→remove/condition, move→reorder JSX siblings), and marks each op
  `in_review` in the bridge with
  `actor: { kind: "agent", id: "claude", name: "Claude" }` — the user then
  approves or rejects it from the edit inbox, which clears the overlay so the
  materialized code becomes the source of truth (committed
  like any other change). Use whenever the user asks for
  "/auis-edit-bridge-solve", "materialize the edits", "turn the overlay into
  code", "apply the edits from page X to the code", "promote the live editor's
  edits", "resolve the page-edits", or variations. Do NOT use it to author
  edits (that is the in-browser Edit Mode) nor for Review Mode comments (that
  is `auis-review-bridge-solve`).
---

# Auis Edit Bridge — Materialize overlays into code

This skill is the **agent that materializes** Live Edit Mode edits. The
in-browser editor records edits as a non-destructive *overlay* (one JSON per
route in `page-editor/data/`); here you read that overlay, plan the equivalent
code edit, rewrite the real TSX, and hand each op back marked as **in review**
for the user to approve from the page's inbox.

> Prerequisite: `npm run dev` running at the root (page-edits is serverless,
> part of Next — same origin, no token, no separate process).
>
> Contract/payloads: `app/api/page-edits/_store.ts` (types `PageEditOp`,
> `PageEditPayload`). Live apply engine: `lib/auis-edit/applier.ts`.

## Golden rule

**You do NOT apply (archive) directly.** Always transition to `in_review` and
let the user approve from the inbox. Approving moves the op to the archive and
**clears the overlay** — from then on the materialized code IS the truth (and
goes through the normal commit flow). **No exceptions:** even if the user
says "apply it directly", you mark it `in_review` and they approve from the inbox
(it is 1 click) — you never use `transition: "apply"`/`"discard"`.

```
current status → what you do
─────────────────────────────────
open       → in_review  (after rewriting the equivalent TSX)
in_review  → don't touch  (already with you/another agent; only the user approves/rejects)
applied/discarded → ignore (already in the archive)
```

## Actor identity

On EVERY call that writes to the bridge:

```json
{ "kind": "agent", "id": "claude", "name": "Claude" }
```

---

## Flow

### 0. Setup — find the base URL and validate

```bash
# page-edits runs alongside Next. Default dev port: 3000.
BASE=${EDIT_BASE:-http://127.0.0.1:3000}
# validates that the route responds (it needs ?route=…)
curl -s "$BASE/api/page-edits?route=%2F" >/dev/null || echo "Start 'npm run dev' at the root and come back."
```

You can also read the files straight from disk (you do not need the dev server to
READ): `page-editor/data/<encoded-route>.json` (+ `.archive.json`), where the key is
`encodeURIComponent(pathname)` — e.g. `/integrations` → `%2Fintegrations.json`.
To TRANSITION (`in_review`) use the API's `PUT` (that needs the dev server).

**Formats (they are not raw arrays/fields — they are wrapped):**
- `GET /api/page-edits?route=…` → `{ "ops": [ … ] }` (read `.ops`).
- `POST` → `{ "op": { … } }`; `PUT /api/page-edits/:id` → `{ "op": { …, "resolution": { "summary" } } }` (read `.op.resolution.summary`).
- File on disk → `{ "schemaVersion", "route", "ops": [ … ] }` (read `.ops`). The
  file AND the `page-editor/data/` directory may **not exist** until the first
  edit is saved — absence = "no ops", not an error.

### 1. Parse the filter

| What the user said | Filter |
|---|---|
| "materialize page /X" | `open` ops on route `/X` |
| "all the edits" / "everything" | scan every file in `page-editor/data/*.json` (status `open`) |
| "only the open ones" | `status=open` (default) |
| "op `<id>`" | the op with that id on its route |
| "the ones in review" | `status=in_review` → do NOT touch; abort explaining that these are already in the user's queue |

```bash
# List the open ops of a route
ROUTE="/integrations"
ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$ROUTE")
curl -s "$BASE/api/page-edits?route=$ENC&status=open" | python3 -m json.tool
```

### 2. Map the route → page file

`pathname` → app router file. General rule: `/x/y` → `app/x/y/page.tsx`.
Routes with route groups (`(group)`) or layouts may diverge — confirm with a
search. If the route renders a domain component, the edit may belong there and
not in `page.tsx`.

### 3. Plan — ALWAYS before touching any code

For each op in scope, build one line. Use the op's fields to locate the
target in the code:

- `anchor.component` — name of the Au* (e.g. `AuButton`) when detected.
- `anchor.domText` — the element's `textContent` at capture time (great
  for a `grep` in the TSX).
- `payload` — what to change.

```
- <id> · /url · type=<text|style|variant|icon|hide|move>
  target: <component/element + domText>   (move: the PARENT container)
  proposal: <code edit in 1 line>
  file: <file:line> (if you already found it)
  confidence: high | medium | low
  flag: off-spec → override directly on the root of <offSpecComponent> (style only)
  action: materialize | skip (reason)
```

**Ambiguity risk (be honest):** the `anchor.selector` is an `nth-of-type` path
that resolves a DOM NODE, but TSX→DOM is many-to-one (`.map()`,
fragments, conditionals). You do NOT map selector→line mechanically: you map
by `component` + `domText` + surrounding text. If the target is rendered inside
a `.map()` (the edit would have to touch DATA, not literal JSX), lower the
confidence and propose skipping/asking.

Present the consolidated plan (total, how many to materialize/skip) and **wait
for approval** (AskUserQuestion: "materialize everything" / "only high confidence" /
"cancel"). In auto mode, proceed with "everything" and flag it in the summary.

### 4. Map op → TSX edit

| `payload.kind` | Edit in the code |
|---|---|
| `text` | Find the string literal (use `domText`/`prevText` in the page `grep`) and swap it for `payload.text`. Ambiguous if the text appears 2×: lower the confidence and confirm. |
| `icon` | Swap the icon prop — `iconLeft`/`iconRight`/`iconOnly`/`name` — from `prevName` to `payload.name`. The component is the span's parent (e.g. `<AuButton iconLeft="add" …>`). |
| `iconStyle` | Override of the optical axes → `<Icon>` props: `payload.weight`→`weight={N}`, `payload.fill`→`fill={0\|1}`, `payload.grade`→`grade={N}`, `payload.opticalSize`→`opticalSize={N}`. Emit **only** the axis/axes that differ from `Icon`'s per-size default (do not dump all 4). Target: the `<Icon>` parent of the `.material-symbols-rounded` span. |
| `variant` | Swap the axis prop on the `<Au… >`: `payload.axis="variant"` → `variant="<value>"`; `payload.axis="size"` → `size="<value>"`. Do NOT touch className (the class is derived from the prop). |
| `style` | **Read `payload.prop`** to know WHICH CSS property to tokenize, and `payload.token` (it already comes as `var(--token)`) for the value. Prefer the arbitrary Tailwind utility following the file's convention: `color`→`text-(--token)`, `background-color`→`bg-(--token)`, `border-color`→`border-(--token)` (+ make sure there is a border), `border-radius`→`rounded-(--token)`, `box-shadow`→`shadow-(--token)`, spacing (`padding`/`margin`/`gap`)→`p-(--token)`/`m-(--token)`/`gap-(--token)`; or `style={{ <prop> : "var(--token)" }}`. NEVER materialize a raw color/measurement. **If `payload.offSpec === true`** (override directly on the ROOT of the `offSpecComponent` component), flag it: ideally it should become a **variant** of the component, not a loose override — propose that or confirm before materializing it as a raw class/style. **If `payload.custom === true`** (raw color outside the palette — the "Cor custom" picker lets you break the token on purpose): do NOT inline the raw value; **promote it to a `--custom-*` token** (see §4b) and apply the class/var of that new token. |
| `token` | **GLOBAL edit of a token's value** (`anchor.selector === ":root"`): rewrites the value in `globals.css` **+ writes a backup first** (see §4b). `payload.token` = the token (e.g. `--accent-brand`), `payload.value` = the new color. Affects ALL instances — it does not touch any element/JSX. |
| `hide` mode `hide` | Hide it idiomatically: remove the node OR wrap it in a condition. When in doubt, ask. |
| `hide` mode `remove` | Remove the JSX subtree for good. |
| `move` | **Reorders SIBLINGS** in the JSX. `anchor` is the **PARENT container**; `payload.order` is the desired sequence of the children keyed by `"<tag>::<text-snippet>"`. In a list rendered by `.map()` → reorder the **data array** to match `order`. In literal JSX → reorder the **sibling elements**. Match each key by text+tag; siblings with no text (key `"<tag>::#<i>"`) are ambiguous → low confidence, confirm. NEVER move across different containers. |

Whenever possible, keep the result token-pure and within the Au* pattern
(AGENTS.md). If materializing would require escaping token/variant (e.g. a color
outside the palette — it should not happen, the picker only offers tokens), **skip and report it**.

### 4b. Custom tokens & backup (`token` and custom `style` ops)

Two ops touch a **global token** in `app/globals.css`. Tokens are sacred (AGENTS.md),
but here it is an EXPLICIT user edit, reviewed in the inbox — handle with care + backup.

**`style` with `custom: true` → new `--custom-*` token** (do not inline a raw color):
1. In `app/globals.css`, in a dedicated block inside `:root` — create it once, commented
   `/* Custom one-off tokens — Live Edit. Review/rename later. */` — add
   `--custom-N: <raw value>;` (N incremental; a semantic name if you can infer one).
   If there is a `.dark`, replicate it with the same value (or ask).
2. In the component, apply it like any `style` op, but pointing at the new token:
   `text-(--custom-N)` / `bg-(--custom-N)` / `border-(--custom-N)`. The page stays token-pure.

**`token` → rewrites the value + BACKUP (mandatory, it is what lets you revert):**
1. **Backup BEFORE touching anything.** Read the token's current value in `globals.css`
   and write a small file at
   `page-editor/token-backups/<token-without-dashes>-<YYYYMMDD-HHmm>.json`:
   ```json
   { "token": "--accent-brand", "old": "<old value>", "new": "<payload.value>", "route": "<route>", "at": "<ISO>" }
   ```
   To revert: restore `old` in `globals.css` and delete the backup file.
2. **Rewrite** the value in the primary `:root` definition. If there is a `.dark` channel
   for the same token, **warn** — the editor does not distinguish modes; by default touch
   only the light one and ask about the dark one.
3. A token edit does NOT touch any element/JSX — only `globals.css` + the backup.

### 5. Mark `in_review`

After rewriting the op's TSX:

```bash
ID="<op id>"; ROUTE="/integrations"
curl -s -X PUT "$BASE/api/page-edits/$ID" \
  -H "Content-Type: application/json" \
  -d "{\"route\":\"$ROUTE\",\"transition\":\"in_review\",\"actor\":{\"kind\":\"agent\",\"id\":\"claude\",\"name\":\"Claude\"}}" \
  | python3 -m json.tool
```

The response carries `resolution.summary` ("Em revisão por Claude em DD/MM/YYYY …").
Note the id+summary for the summary.

### 6. Final summary (one message)

```
✅ N materialized (in review in the inbox):
   - <id> · /url · 1 line on what became code
   ...
⏭️ K skipped:
   - <id> · /url · reason (e.g. inside a .map(), ambiguous target)

▶ Open Edit Mode on the page and the inbox (icon in the toolbar) to approve/reject.
  Approving clears the overlay (the code takes over); rejecting sends the op back to "open".
  Then follow the normal commit flow.
```

---

## Constraints

- ❌ Do not use `transition: "apply"` or `"discard"` — only the user approves/discards.
- ❌ Do not touch `in_review`/`applied`/`discarded` ops.
- ⚠️ A raw color value is now INTENTIONAL when it comes with `custom: true` ("Cor
  custom" picker) — **do not skip it**: promote it to a `--custom-*` (§4b). A raw
  color/radius/shadow/spacing value **without** the `custom` flag is still an editor bug:
  skip and report it.
- ✅ `token` (selector `:root`) rewrites the token in `globals.css` — always write the
  backup BEFORE (§4b). When in doubt about the dark channel, ask.
- ✅ `move` reorders ONLY siblings under the same parent — never across containers. In a
  `.map()`, reorder the data array; in literal JSX, reorder the elements. An order that does
  not match clearly (siblings with no text) → confirm first.
- ✅ `style` with `offSpec` is an override directly on a component's root — materialize it,
  but prefer/suggest turning it into a variant (do not let the component drift for no reason).
- ✅ Text/icon/variant edit inside a `.map()`: treat it as a DATA change
  (the list), not literal JSX — and only with high confidence; otherwise ask.
- ✅ If the dev server goes down mid-run, whatever already became `in_review` is protected;
  resume by fetching `status=open` again.

## Troubleshooting

| Symptom | Cause | Workaround |
|---|---|---|
| `400 route é obrigatório` | `route` was missing from the PUT body | always include `"route"` |
| `404 Op não encontrada` | op already approved/rejected/deleted | skip it in the batch |
| GET returns `[]` | wrong route/wrongly encoded, or the ops are in `in_review`/archive | check the `ENC` and the `status` |
| I cannot find the literal in the TSX | the text comes from data/`.map()` or from another component | follow `domText`+`component`; if it is data, edit the array |
