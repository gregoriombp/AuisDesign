---
name: auis-flow-bridge-solve
description: >
  Reads and applies UX flow edit suggestions stored in the flow-bridge
  (`/auis/styleguide/ux-flows/<flow>`). Pulls from the bridge using a
  filter chosen by the user (all of them, only one flow, only open ones, a
  specific ID, etc.), makes ONE PLAN BEFORE touching any code, waits for the
  user's approval, edits the canonical `NODES`/`EDGES` of the flow's page,
  and marks each suggestion as `in_review` in the bridge with
  `actor: { kind: "agent", id: "claude", name: "Claude" }` — the user then
  approves (apply) or rejects it from the page's inbox. Use whenever the
  user asks for "/auis-flow-bridge-solve", "evaluate suggestion X of flow Y",
  "apply the open suggestions for login-auth", "take today's suggestions and
  resolve them", "look at what's in the flow-bridge", or variations. Do not
  use it to start the server — for that, see `auis-flow-bridge`.
---

# Auis Flow Bridge — Batch-resolve suggestions

This skill is the **agent that applies** the UX flow edit suggestions.
It reads the flow-bridge, plans the changes to the canonical code of the
flow's page, implements them, and hands each suggestion back as `in_review`
for the user to approve from the page's inbox.

> Prerequisite: the Next dev server (`npm run dev`) is up — that is where the
> same-origin `/api/flow-suggestions` route lives. **There is no separate
> server and no token** (the serverless cutover is done).
>
> Persistence: `flow-bridge/data/suggestions.json` (+ `.archive.json`).

## Golden rule

**You do NOT archive directly.** Always transition to `in_review` and let
the user approve (apply) from the inbox. The only exception is when the user
explicitly asks to "apply and archive it directly".

```
current status → what you do
─────────────────────────────────
open         → in_review  (after editing the flow's page.tsx)
open         → reply       (the current skill has no reply — fall back to skip + ask in the chat)
in_review    → don't touch  (already with you or another agent; only the user can approve/reject)
applied/discarded → ignore (already archived; different queue)
```

## Actor identity

On ALL calls that write to the bridge:

```json
{ "kind": "agent", "id": "claude", "name": "Claude" }
```

If it is another model running in parallel, use a different stable id
(`claude-haiku`, `cursor`, etc.).

---

## Flow

### 0. Setup — read the suggestions

There is no token and no separate server. Read the repo file directly (more
robust) or via the same-origin route if the dev server is up:

```bash
# Option A (preferred): read the file directly with the Read tool
#   flow-bridge/data/suggestions.json   (open + in_review)
#   flow-bridge/data/suggestions.archive.json   (applied/discarded)

# Option B: via the route (dev server up) — no token
curl -s "http://localhost:3000/api/flow-suggestions?status=open" | python3 -m json.tool
```

To **mark `in_review`** at the end you need the dev server up (the route performs
the transition). If it is down, edit the JSON directly (change `status` to
`"in_review"` and add `resolution`) — same effect.

### 1. Parse the filter from the user's request

| What the user said | Filter |
|---|---|
| "everything" / no filter | `status=open` (default — does not pull in_review or archive) |
| "the open ones" / "open" | `status=open` |
| "the ones in review" / "in_review" | `status=in_review` (but do NOT touch them — just list) |
| "today's" | `status=open` + filter `createdAt >= today's local midnight` |
| "the ones on flow login-auth" | `status=open&flow=login-auth` |
| "suggestion `abc12345`" / "id `abc12345`" | direct GET by id |

### 2. Fetch and prioritize

```bash
curl -s "http://localhost:3000/api/flow-suggestions?status=open" \
  | python3 -m json.tool > /tmp/flow-suggestions-open.json
# (or read flow-bridge/data/suggestions.json directly and filter status == "open")
```

Default order: oldest first (FIFO). Tie-break: same `flow` in one contiguous
block (you read that flow's `page.tsx` only once).

### 3. Plan — ALWAYS before touching any code

For each suggestion in scope, build one line:

```
- abc12345 · flow:login-auth · "first 60 chars of the description..."
  diff vs canonical: <N nodes added, M edges, K nodes edited>
  proposal: <what you are going to apply in page.tsx, in 1 line>
  files: app/auis/styleguide/ux-flows/login-auth/page.tsx
  confidence: high | medium | low
  action: apply | skip (reason)
```

> To compute the diff: compare the suggestion's `nodes` and `edges` with the
> `NODES`/`EDGES` exported by the flow's `page.tsx`. New IDs = added
> nodes. Missing IDs = removed. Same id with different `data` =
> edited. Same id with different `position` = repositioned (rarely
> needs to be coded — the layout is mathematical in `Y` and columns).

Present the consolidated plan to the user. **Wait for explicit approval**
(AskUserQuestion with "apply everything", "only the high-confidence ones",
"cancel"). In auto mode, proceed with "apply everything" and flag it in the
final summary.

### 4. Execute item by item

For each suggestion marked **apply**:

1. Read the flow's `page.tsx` (`/app/auis/styleguide/ux-flows/<flow>/page.tsx`).
2. Update the `NODES` and `EDGES` arrays:
   - **Node added**: create a new entry with `type`, `data`, `position`. If
     the position looks chaotic (random from the palette), adjust it to land in a
     column consistent with `COL`/`COL_D` or in the nearest lane.
   - **Node edited**: change only the `data` fields that changed (step, title,
     note, href / question).
   - **Node removed**: take it out of the array (and remove orphan edges).
   - **New edge**: create it with `edgeBase` or `branchEdge` (always prefer these
     two — do not write raw edge markup).
   - **Edge removed**: take it out of the array.
3. If the suggestion also changed existing nodes that have a
   `screens = [...]` section documenting them in the same file, **also update
   that array** if the change is about purpose/title (keeps the document
   consistent with the diagram).
4. Mark the suggestion as `in_review` in the bridge:

```bash
curl -s -X PUT "http://localhost:3000/api/flow-suggestions/$ID" \
  -H "Content-Type: application/json" \
  -d '{
    "transition": "in_review",
    "actor": { "kind": "agent", "id": "claude", "name": "Claude" }
  }' | python3 -m json.tool
```

The response includes `resolution.summary` in the format:
`In review by Claude on DD/MM/YYYY at HH:MM:SS.`

### 5. Final summary

```
✅ N applied (in review in each flow's inbox):
   - abc12345 · login-auth · 1 line on what was done
   ...

⏭️ K skipped:
   - abc12345 · primeiro-acesso · reason

▶ Open /auis/styleguide/ux-flows/<flow> and click the amber badge
  ("N suggestions") to approve (apply) or reject (goes back to open).
```

---

## "apply vs skip" decisions

| Signal | Decision |
|---|---|
| Clear description + diff consistent with the flow | apply |
| Logical diff but odd position (random from the palette) | apply, but reposition to a consistent column/Y |
| Vague description ("improvements") + large diff | skip, ask the user to clarify |
| Suggestion changes jargon to a forbidden term (mobile, internal backend) | skip (memory: the product has no mobile; this repo is UI/UX) |
| Suggestion adds a node with an `href` pointing at a route that does not exist | apply but replace it with `"#"` and flag it in the summary |

## Constraints

- ❌ Do not use `transition: "apply"` or `transition: "discard"` — only the
  human user approves/discards from the page's inbox.
- ❌ Do not delete suggestions directly (`DELETE /api/flow-suggestions/:id`).
- ❌ Do not touch suggestions with `status: "in_review"` (they are already in the user's queue).
- ❌ Do not touch archived suggestions (`flow-bridge/data/suggestions.archive.json`)
  unless the user explicitly asks.
- ❌ Do not introduce new color / spacing / etc. tokens — always use the
  ones already defined in `globals.css`.
- ❌ Do not reorganize components/imports in `page.tsx` that the suggestion
  did not change (keeps the diff clean).
- ✅ Always run `tsc --noEmit` at the end of the batch (filter by the flow's
  file). If there is an error, do NOT mark `in_review` — fix it first.
- ✅ If the connection drops mid-batch, resume from the next pending id.

## Useful filters

### Today's suggestions, open

```bash
TODAY_MS=$(python3 -c "import datetime;t=datetime.datetime.now().replace(hour=0,minute=0,second=0,microsecond=0);print(int(t.timestamp()*1000))")
curl -s "http://localhost:3000/api/flow-suggestions?status=open" \
  | TODAY_MS=$TODAY_MS python3 -c "
import sys, json, os
d = json.load(sys.stdin)
today_ms = int(os.environ['TODAY_MS'])
hoje = [s for s in d['suggestions'] if s['createdAt'] >= today_ms]
print(json.dumps({'count': len(hoje), 'ids': [s['id'] for s in hoje]}, indent=2))
"
```

### Everything open on a flow

```bash
curl -s "http://localhost:3000/api/flow-suggestions?status=open&flow=login-auth"
```

### A specific suggestion

```bash
# The route has no GET by id; take it from the listing and filter, or read the JSON directly.
curl -s "http://localhost:3000/api/flow-suggestions" \
  | python3 -c "import sys,json;print([s for s in json.load(sys.stdin)['suggestions'] if s['id']=='abc12345'])"
```

### Suggestions left pending for you to review (post-run)

```bash
curl -s "http://localhost:3000/api/flow-suggestions?status=in_review" \
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
| route does not respond / `ECONNREFUSED` | dev server (`npm run dev`) is down | start the dev server, or edit `flow-bridge/data/suggestions.json` directly |
| `404` on a transition | suggestion already archived/deleted | skip it in the batch |
| `400 Invalid transition` | `transition` missing/wrong in the body | use only `in_review` \| `apply` \| `discard` \| `reject` |
| 0 suggestions returned | filter too restrictive | drop `flow=` and look at the full listing first |
| Diff too complicated for one batch | abort the batch, slice it by flow, ask for confirmation | "I'll apply only flow X's first, ok?" |
