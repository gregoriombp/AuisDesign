---
name: auis-flow-bridge-solve
description: >
  Materializes UX flow edit suggestions filed from the flow editor ("Suggest
  edit" on /auis/ux-flow/<slug>) into the canonical page code. Pulls them from
  the same-origin /api/flow-suggestions route with a filter chosen by the user
  (all open ones, one flow, today's, a specific id), makes ONE PLAN before
  touching any code, waits for the user's approval, edits the flow's
  `NODES`/`EDGES` in app/auis/ux-flow/<slug>/page.tsx, validates, and PUTs each
  suggestion to `in_review` with a materialization receipt so the user can
  apply or reopen it from /auis/review-bridge (Flow suggestions). Use for
  "/auis-flow-bridge-solve", "evaluate suggestion X of flow Y", "apply the open
  suggestions for <flow>", "take today's suggestions and resolve them", "what
  is in the flow bridge", or variations. There is no server to start: `npm run
  dev` already serves the route.
---

# Auis Flow Bridge — Batch-resolve suggestions

This skill is the **agent that materializes** the UX flow edit suggestions.
It reads them from the flow-suggestions route, plans the changes to the
canonical code of the flow page, implements them, and hands each suggestion
back as `in_review` — with a receipt — for the user to apply from the Review
Bridge.

> Prerequisite: the Next dev server (`npm run dev`, `http://127.0.0.1:3000`)
> is up — that is where the same-origin route `app/api/flow-suggestions/`
> lives. **There is no separate server, no port to open and no token to
> configure.**
>
> Persistence: `flow-bridge/data/suggestions.json` (+ `suggestions.archive.json`),
> written only by the route. **Never read or edit those files directly** —
> the route validates the base revision and stamps the receipt; touching the
> JSON by hand breaks that guarantee. Always go through the API.

## Golden rule

**You do NOT archive.** Always transition to `in_review` and let the user
apply (or reopen) from the moderation UI at `/auis/review-bridge` → "Flow
suggestions" (or from the suggestions badge on the flow page). The only
exception is when the user explicitly asks to "apply and archive it directly"
— see the note under Step 4.

```
current status      → what you do
────────────────────────────────────────────────────────────────
open                → in_review   (after editing the flow's page.tsx + receipt)
open (unclear)      → skip + ask in the chat (the route has no reply)
in_review           → do not touch (already with you or another agent; only the user applies / reopens)
applied / discarded → ignore (archived; not returned by the listing)
```

Lifecycle enforced by `app/api/flow-suggestions/_store.ts`:

```
open ──in_review──► in_review ──apply──► applied   (→ archive)
 │                      │      ──discard─► discarded (→ archive)
 │                      └──reject──► open  (receipt dropped)
 └──discard──► discarded (→ archive)
```

## Actor identity

The actor stamped on a transition is derived **on the server from the
session** (`flowActorForSession` in `_integrity.ts`) — an `actor` field in the
request body is ignored, so do not send one.

- Local dev server without an auth layer (the default): every caller is the
  local admin; the receipt is stamped `{ kind: "user", id: "local-admin", name: "Local admin" }`.
- With `BRIDGE_AGENT_TOKEN` set in `.env.local` and the request carrying it
  in the `x-bridge-agent-token` header, the session is an agent and the stamp
  is `{ kind: "agent", id: "claude", name: "Claude" }`. Send that header only
  when the variable is set — it is what identifies the work as Claude's in the
  moderation UI.

---

## Flow

### 0. Setup — check the route

```bash
BASE=http://127.0.0.1:3000
curl -s "$BASE/api/flow-suggestions?status=open" | python3 -m json.tool | head -40
```

A JSON object with a `suggestions` array means the route is up. `ECONNREFUSED`
means the dev server is down — ask the user to run `npm run dev` at the root
and stop; never simulate a transition by editing files.

### 1. Parse the filter from the user's request

| What the user said | Filter |
|---|---|
| "everything" / no filter | `status=open` (default — does not pull `in_review`; archived records are not listed) |
| "the open ones" / "open" | `status=open` |
| "the ones in review" / "in_review" | `status=in_review` (but do NOT touch them — only list) |
| "today's" | `status=open` + filter `createdAt >= today's local midnight` |
| "the ones on flow example" | `status=open&flow=example` |
| "evaluate suggestion `abc12345` of flow `example`" (the text the flow page copies) | `flow=example`, then pick the id from the listing |
| "suggestion `abc12345`" / "id `abc12345`" | full listing, filter by id (the route has no GET by id) |

### 2. Fetch and prioritize

```bash
curl -s "$BASE/api/flow-suggestions?status=open" \
  | python3 -m json.tool > "$TMPDIR/flow-suggestions-open.json"
```

The listing is newest-first. Work **oldest first** (FIFO). Tie-break: same
`flow` in one contiguous block (you read that flow's `page.tsx` once).

Each record (`schemaVersion: 2`) carries: `id`, `flow`, `description`,
`createdAt`, `authorName`, `status`, the proposal `nodes` / `edges`, and the
base it was made against — `baseRevision` (`flow:<slug>@<hash12>`),
`baseHash` and `baseSnapshot { nodes, edges }`. Nodes are cleaned
`{ id, type, position, data }`, edges `{ id, source, target, sourceHandle?,
targetHandle?, label? }` — no style props.

### 3. Plan — ALWAYS before touching any code

For each suggestion in scope, build one block:

```
- abc12345 · flow:example · "first 60 chars of the description..."
  base: flow:example@1a2b3c4d5e6f · matches the current page: yes / NO (stale)
  diff vs canonical: <N nodes added, M edges added, K nodes edited, R removed>
  proposal: <what you are going to apply in page.tsx, in 1 line>
  files: app/auis/ux-flow/example/page.tsx
  confidence: high | medium | low
  action: apply | skip (reason)
```

How to fill it in:

- **Base check.** Legacy records without `baseRevision` / `baseHash` (schema 1)
  are read-only: skip them and ask the user to recreate the proposal in the
  editor. For the others, compare `baseSnapshot` with the page's current
  `NODES` / `EDGES` (same ids, types, positions and `data`; edges by
  id/source/target/handles/label — ignore edge style spreads). If the page
  moved on since the proposal was filed, the base is **stale**: do not merge
  blindly — flag it and ask for a fresh proposal on top of the current flow
  (or, with the user's explicit go-ahead, re-derive the intent by hand and say
  so in the receipt summary).
- **Diff.** Compare the proposal's `nodes` / `edges` with the page's arrays:
  new ids = added nodes; missing ids = removed; same id with different `data`
  = edited; same id with a different `position` only = repositioned (rarely
  worth coding — the layout is mathematical in `Y` and columns, and the
  editor's "Arrange" button may have moved everything).
- Nodes created in the editor arrive with generated ids (`n-…`) and
  placeholder data ("New screen", `href: "#"`); edges drawn in the editor
  carry the editor's blue dashed style. Both get normalized when
  materialized (Step 4).

Present the consolidated plan to the user. **Wait for explicit approval**
(AskUserQuestion with "apply everything", "only the high-confidence ones",
"cancel"). In auto mode, proceed with "apply everything" and flag it in the
final summary.

### 4. Execute item by item

For each suggestion marked **apply**:

1. Confirm the record has `schemaVersion: 2`, `baseRevision`, `baseHash` and
   `baseSnapshot`, and that the base still matches the page (Step 3).
2. Read the flow's page (`app/auis/ux-flow/<flow>/page.tsx`) and its
   conventions (`auis-create-ux-flow` Steps 2–4). A compiled view
   (`*-golden-eye`) keeps `BASE_NODES` / `EDGES` with `scenarios` membership —
   apply the same care to that array.
3. Update the `NODES` and `EDGES` arrays:
   - **Node added**: create a new entry with `type`, `data`, `position`. Give
     it a readable kebab-case id instead of the generated `n-…` one (and
     update the edges that reference it). If the position looks chaotic
     (dropped at random by the editor), move it onto a coherent column
     (`COL` / `COL_D`) and row of the `Y` table.
   - **Node edited**: change only the `data` fields that changed (step, title,
     note, href / question).
   - **Node removed**: take it out of the array (and remove orphan edges).
   - **New edge**: write it with `edgeBase`, `branchEdge` (decision exits, with
     `sourceHandle` and a label) or `crossEdge` (touching a `crossflow` node) —
     never keep the editor's raw edge markup.
   - **Edge removed**: take it out of the array.
   - Every new `href` must be a route that exists in the repo; otherwise
     write `#` and flag it in the summary.
   - Keep `NODES` / `EDGES` exported and the entry screen first.
4. If the suggestion changed existing nodes that the page documents in its
   `screens = [...]` array, **update that array too** when the change is about
   purpose or title (keeps the document consistent with the diagram).
5. When the change is structural per the `auis-update-ux-flow` table (new or
   removed node, new branch, rework), **prepend an `updates` entry** dated
   today whose summary is the suggestion's intent in one sentence. Copy or
   style-only changes get no entry.
6. Run a focused lint and the typecheck. Only if both pass, send the
   suggestion to review with the mandatory receipt:

```bash
npx eslint app/auis/ux-flow/<flow>/page.tsx
npm run typecheck
```

```bash
ID=abc12345
curl -s -X PUT "$BASE/api/flow-suggestions/$ID" \
  -H "Content-Type: application/json" \
  -d '{
    "transition": "in_review",
    "receipt": {
      "baseRevision": "<copy exactly from the suggestion>",
      "baseHash": "<copy exactly from the suggestion>",
      "files": ["app/auis/ux-flow/<flow>/page.tsx"],
      "validations": ["npx eslint app/auis/ux-flow/<flow>/page.tsx", "npm run typecheck"],
      "summary": "Materialized the structural change in the canonical flow page."
    }
  }' | python3 -m json.tool
```

(Add `-H "x-bridge-agent-token: $BRIDGE_AGENT_TOKEN"` only when that variable
is set — see "Actor identity".)

**Receipt contract** (`parseFlowMaterializationReceipt` in
`app/api/flow-suggestions/_integrity.ts`): `baseRevision`, `baseHash` and
`summary` are non-empty strings; `files` and `validations` are non-empty
string arrays. Anything else in the receipt is dropped. The server stamps
`actor`, `at` and `proposalHash` (hash of the proposal's nodes/edges) on the
stored `materializationReceipt`, and sets `resolution.summary` to
`In review by <name> on DD/MM/YYYY at HH:MM:SS.` Check the response: a
suggestion that is not `open` comes back unchanged (200, no write), so verify
`suggestion.status === "in_review"`.

> **"Apply and archive directly"** — only on the user's explicit request, and
> only after the `in_review` transition above succeeded: PUT
> `{ "transition": "apply" }` **without** the agent header (apply, discard and
> reject are admin-only; an agent session gets 403). The server re-checks that
> the proposal is `in_review`, carries a receipt and has not changed since
> materialization (`proposalHash`), then moves the record to the archive as
> `applied`. Say in the summary that the user asked for the direct apply.

### 5. Final summary

```
Applied — N (in review, waiting for the user to apply):
   - abc12345 · example · one line on what was done
   ...

Skipped — K:
   - abc12345 · checkout · reason (stale base / legacy / unclear / …)

Next: open /auis/review-bridge → "Flow suggestions" and press Apply (archives)
or Reopen (sends it back to open); the amber "N suggestions" badge on
/auis/ux-flow/<flow> offers the same Approve / Reject.
```

---

## "apply vs skip" decisions

| Signal | Decision |
|---|---|
| Clear description + diff consistent with the flow | apply |
| Logical diff but odd position (dropped at random by the editor) | apply, but reposition to a consistent column / Y row |
| Vague description ("improvements") + large diff | skip, ask the user to clarify |
| Base snapshot no longer matches the page (stale) | skip, ask for a fresh proposal on the current flow |
| Legacy record (no `baseRevision` / `baseHash`) | skip, ask the user to recreate it in the editor |
| Suggestion adds a node with an `href` pointing at a route that does not exist | apply but write `"#"` and flag it in the summary |
| Suggestion only moves nodes around (position-only diff) | skip unless the description asks for a new layout; nothing structural to materialize |

## Constraints

- Do not use `transition: "apply"` or `transition: "discard"` on your own —
  only the human applies or discards from the moderation UI (exception: the
  explicit request above).
- Do not delete suggestions (`DELETE /api/flow-suggestions/:id`).
- Do not touch suggestions with `status: "in_review"` (already in the user's
  queue).
- Do not materialize suggestions without `baseRevision` / `baseHash`; they are
  read-only legacy records and must be recreated in the editor.
- Do not invent, omit, or copy between suggestions the receipt's base fields —
  each receipt names the exact base of its own proposal and lists only the
  validations you actually ran.
- Do not read or edit `flow-bridge/data/*.json` directly — the API is the only
  entry point.
- Do not introduce new color / spacing / etc. tokens — always use the ones
  already defined in `globals.css`; keep `Au*` components, `Icon` for icons,
  no emoji, English text.
- Do not reorganize components or imports in `page.tsx` that the suggestion
  did not change (keeps the diff clean).
- Always run the typecheck at the end of the batch. If it fails, do NOT send
  the suggestion to review — fix it first.
- If the connection drops mid-batch, resume from the next pending id.

## Useful filters

### Today's suggestions, open

```bash
TODAY_MS=$(python3 -c "import datetime;t=datetime.datetime.now().replace(hour=0,minute=0,second=0,microsecond=0);print(int(t.timestamp()*1000))")
curl -s "$BASE/api/flow-suggestions?status=open" \
  | TODAY_MS=$TODAY_MS python3 -c "
import sys, json, os
d = json.load(sys.stdin)
today_ms = int(os.environ['TODAY_MS'])
today = [s for s in d['suggestions'] if s['createdAt'] >= today_ms]
print(json.dumps({'count': len(today), 'ids': [s['id'] for s in today]}, indent=2))
"
```

### Everything open on a flow

```bash
curl -s "$BASE/api/flow-suggestions?status=open&flow=example"
```

### A specific suggestion

```bash
# The route has no GET by id — take it from the listing and filter.
curl -s "$BASE/api/flow-suggestions" \
  | python3 -c "import sys,json;print(json.dumps([s for s in json.load(sys.stdin)['suggestions'] if s['id']=='abc12345'], indent=2))"
```

### The base a suggestion was made against

```bash
curl -s "$BASE/api/flow-suggestions?flow=example" \
  | python3 -c "
import sys, json
for s in json.load(sys.stdin)['suggestions']:
    if s['id'] != 'abc12345': continue
    print(s.get('baseRevision'), s.get('baseHash'))
    for n in s.get('baseSnapshot', {}).get('nodes', []):
        print(' ', n['id'], n['type'], n['position'], n['data'].get('title'))
"
```

### Suggestions left pending for the user to review (post-run)

```bash
curl -s "$BASE/api/flow-suggestions?status=in_review" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for s in d['suggestions']:
    summary = s.get('resolution', {}).get('summary', '?')
    print(s['id'], '·', s['flow'], '·', summary)
"
```

## Troubleshooting

| Symptom | Cause | Workaround |
|---|---|---|
| route does not respond / `ECONNREFUSED 127.0.0.1:3000` | dev server (`npm run dev`) is down | start the dev server; never simulate the receipt by editing JSON |
| `400 Invalid transition.` | `transition` missing or wrong in the body | use only `in_review` \| `apply` \| `discard` \| `reject` |
| `400 Invalid receipt. …` | receipt missing a field, or `files` / `validations` empty | send all five fields, non-empty |
| `403` on `in_review` | reviewer session (only behind an auth layer) | run locally or send the agent header |
| `403` on `apply` / `discard` / `reject` | these are admin-only; the request carried the agent header | drop the header — and only apply on the user's explicit request |
| `404 Suggestion not found.` | already archived or deleted | skip it in the batch |
| `409 A materialization receipt is required …` | PUT `in_review` without `receipt` | attach the receipt |
| `409 Legacy suggestion without a base revision …` | schema 1 record | skip; ask the user to recreate it in the editor |
| `409 The receipt's base revision does not match the proposal …` | copied the wrong `baseRevision` / `baseHash` | copy both exactly from that suggestion |
| `409 The canonical base snapshot does not match …` | the stored base is internally inconsistent | do not apply; recreate the proposal |
| `409 … changed after materialization …` on `apply` | the proposal was edited after the receipt | reopen (`reject`) and materialize again |
| 200 but `status` still `open` after `in_review` | wrong id, or the record was not `open` | re-fetch the listing and check the id and status |
| 0 suggestions returned | filter too restrictive | drop `flow=` and look at the full listing first |
| Diff too complicated for one batch | abort the batch, slice it by flow, ask for confirmation | "I'll apply only flow X's first, ok?" |
