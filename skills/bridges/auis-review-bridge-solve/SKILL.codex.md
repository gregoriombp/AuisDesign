---
name: auis-review-bridge-solve
description: >
  Resolves Auis Review Mode comments in bulk. Reads from the local
  review-bridge using a filter chosen by the user (all of them, only
  today's, only open ones, a specific page, explicit IDs, etc.), makes ONE
  PLAN BEFORE touching any code, waits for the user's approval, implements
  the fixes, and marks each comment as `in_review` in the bridge with
  `actor: { kind: "agent", id: "claude", name: "Claude" }` — the user then
  approves or rejects it afterward via the inbox. It can also respond with a
  question (an agent reply) when a comment is ambiguous. Use whenever the
  user asks for "/auis-review-bridge-solve", "resolve all the review
  comments", "take today's and resolve them", "resolve the open ones in
  bulk", "resolve the comments on /page/x", "reply to the bridge comments",
  or variations. Do NOT use it to start the server — for that, see
  `auis-review-bridge`.
---

# Auis Review Bridge — Batch resolve

This skill is the **agent that resolves** Review Mode comments. It reads
the local bridge, plans the fixes, implements them, and hands each item
back marked as **in review** for the user to approve from the inbox.

> Prerequisite: `npm run dev` is already running at the root. That command
> brings up Next and the local review-bridge together.
>
> Architecture, endpoints and full payloads: `review-bridge/README.md`.

## Golden rule

**You do NOT archive directly.** Always transition to `in_review` and let
the user approve. The only exception is when the user explicitly asks to
"archive it directly" / "mark it as resolved without review".

```
current status → what you do
─────────────────────────────────
open         → in_review  (after implementing the fix)
open         → reply       (if you want the user's opinion first)
in_review    → don't touch  (already with you or another agent; only the user can approve/reject)
resolved     → ignore      (already archived; different queue)
```

## Actor identity

On ALL calls that write to the bridge, use:

```json
{ "kind": "agent", "id": "claude", "name": "Claude" }
```

If it is a different agent (Haiku, Sonnet running in parallel, etc.), use
a different stable id (`claude-haiku`, `cursor`, etc.) and a readable `name`.

---

## Flow

### 0. Setup — read env and validate the bridge

```bash
# Bridge token (server)
TOKEN=$(grep AUIS_REVIEW_TOKEN review-bridge/.env | cut -d= -f2-)

# Bridge URL — prefer whatever the frontend uses
BRIDGE_URL=${BRIDGE_URL:-http://127.0.0.1:3000/api/review-bridge}

# Checks that the server is alive
curl -s "$BRIDGE_URL/health" | python3 -c "import sys,json;d=json.load(sys.stdin);assert d['ok'] and d['schemaVersion']==3, d"
```

If it fails, stop with a message telling the user to run `npm run dev` at the root and come back.

### 1. Parse the filter from the user's request

Map what the user asked for to the right filter:

| What the user said | Filter to apply |
|---|---|
| "all the comments" / "everything" / no filter | `status=open` (default — does not pull in_review or archive) |
| "the open ones" / "open" | `status=open` |
| "the ones in review" / "in_review" / "pending my approval" | `status=in_review` (but you must NOT touch these; abort with an explanation) |
| "today's" | `status=open` + filter `createdAt >= today's local midnight` |
| "since yesterday" / "the last N days" | `status=open` + date filter |
| "the ones on page X" / "/perfil" | `status=open&url=/perfil` |
| "comment cmt-xxx" | direct GET by id |
| "reply to the open ones with a question" | `status=open` filter, but instead of implementing, post a reply |

Relevant memory:
> Memory `feedback_review_bridge_filter` — `status === "open"` pulls old
> comments when there is no additional filter. ALWAYS filter by
> `createdAt >= today_midnight` when the user says "today". And ALWAYS
> filter by `url` when the user is focused on one page.

### 2. Fetch and rank

```bash
curl -s -H "X-Review-Token: $TOKEN" "$BRIDGE_URL/comments?status=open" \
  | python3 -m json.tool > /tmp/review-bridge-open.json
```

Apply the additional filters (date, url, author) in Python or jq.

Default ranking for the processing order:
1. Oldest comments first (FIFO — the user has been waiting longer).
2. Tie-break: same URL → one contiguous block (so you read that file only
   once while planning).

### 3. Plan — ALWAYS before touching any code

For each comment in scope, build one line:

```
- cmt-xxx · /page/url · "first 60 chars of the text..."
  proposal: <what you are going to change, in 1 line>
  files: <file:line> (optional, if you already found it)
  confidence: high | medium | low
  action: implement | reply with a question | skip (reason)
```

Present the consolidated plan to the user with:
- Total comments in scope
- How many "implement", "reply", "skip"
- Detailed list (up to 30; if it goes past 30, use AskUserQuestion to confirm
  whether to proceed or slice it)

**Wait for explicit approval** before executing (AskUserQuestion with the
options "run everything", "run only the high-confidence ones", "cancel").
In auto mode, proceed with "run everything" but flag it in the final summary.

### 4. Execute item by item

For each comment marked **implement**:

1. Read the page file (`comment.url` → map it to `app/.../page.tsx`
   or the corresponding component). The anchor has `viewportWidth/Height` and
   `scrollY` — use it only for context, not for pixel-perfect precision.
   - Before editing, read `comment.context` when it exists. Use
     `context.target.label`, `context.target.text`, `context.target.attributes`,
     `context.target.fingerprint` and `context.nearbyText` to identify the real
     target of short requests like "remove this" or "swap this text". If the
     context contradicts the visual coordinate, trust the target's text/label
     first and confirm against the page code.
   - **UX flow comment** (`comment.origin === "ux-flow"`): it was left on the
     diagram of a styleguide flow. It has `flowRef: { flow, nodeId,
     nodeLabel }` — the fix goes into the `NODES`/`EDGES` arrays of
     `app/auis/styleguide/ux-flows/<flow>/page.tsx` (the node is `flowRef.nodeId`).
     Treat it as a flow edit (same logic as `auis-update-ux-flow`)
     and add a changelog entry if it is a structural change. Then mark the comment
     `in_review` like the others.
2. Implement the fix in the code with Edit/Write.
3. Mark the comment as `in_review`:

```bash
curl -s -X PUT "$BRIDGE_URL/comments/$ID" \
  -H "X-Review-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transition": "in_review",
    "actor": { "kind": "agent", "id": "claude", "name": "Claude" }
  }' | python3 -m json.tool
```

The response must include `resolution.summary` in the format:

```
Resolved by Claude on DD/MM/YYYY at HH:MM:SS.
```

Note the id+summary to put in the final summary.

For the ones marked **reply with a question**:

```bash
curl -s -X POST "$BRIDGE_URL/comments/$ID/replies" \
  -H "X-Review-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "authorKind": "agent",
    "authorId": "claude",
    "authorName": "Claude",
    "authorColorToken": "var(--au-purple-600)",
    "text": "<your concise question, ending in ?>"
  }'
```

Do not mark these as `in_review` — they stay `open` waiting for the user
to reply in the thread.

### 5. Final summary

Report to the user in a single message (do not trickle it out):

```
✅ N implemented (in review in the inbox):
   - cmt-... · /url · 1 line on what was done
   ...

💬 M replied (waiting for you in the thread):
   - cmt-... · /url · "question?"
   ...

⏭️ K skipped:
   - cmt-... · /url · reason

▶ Check the inbox at /auis/styleguide/review to approve/reject
  the implemented ones. Approving moves them to the archive; rejecting sends them back to "open".
```

Mention the amber badge with the count that appeared in the toolbar.

---

## "implement vs reply vs skip" decisions

| Signal in the comment text | Decision |
|---|---|
| "change X to Y" / "it should be Y" / clear instructions | implement |
| "this looks odd" / "I don't like it" / no direction | reply with a question asking for direction |
| "broken" / "bug" / points at a concrete problem in the UI | implement (investigate and fix) |
| direct question to the agent ("@claude, which...") | reply |
| screenshot attached + no text | reply with "what do you want to change in this annotation?" |
| comment referring to backend/data | skip (memory: this repo is UI/UX, devs handle the backend) |
| reference to a mobile feature | skip (memory: the product has no mobile) |

## Constraints

- ❌ Do not use `transition: "approve"` or `transition: "resolve_direct"` —
  only the human user approves/archives directly.
- ❌ Do not delete comments (`DELETE /comments/:id`).
- ❌ Do not touch comments with `status: "in_review"` (they are already in the user's queue).
- ❌ Do not touch archived comments (`/comments/archive`) unless
  the user explicitly asks.
- ❌ Do not reply in the thread if the reply is "OK" / has no content. A reply is for
  asking a legitimate question.
- ❌ Do not hit the endpoints without a token — you will get a 401 back.
- ✅ Always take the server timezone for the `summary` (the bridge does this
  on its own — do not recompute it on the client).
- ✅ If the connection drops mid-batch, resume from the next pending id
  (the already-persisted `in_review` status protects against repeats).

## Useful filters — ready-made recipes

### Today, status open

```bash
TODAY_MS=$(python3 -c "import datetime;t=datetime.datetime.now().replace(hour=0,minute=0,second=0,microsecond=0);print(int(t.timestamp()*1000))")
curl -s -H "X-Review-Token: $TOKEN" "$BRIDGE_URL/comments?status=open" \
  | python3 -c "
import sys, json, os
d = json.load(sys.stdin)
today_ms = int(os.environ['TODAY_MS'])
hoje = [c for c in d['comments'] if c['createdAt'] >= today_ms]
print(json.dumps({'count': len(hoje), 'ids': [c['id'] for c in hoje]}, indent=2))
" TODAY_MS=$TODAY_MS
```

### Everything open on a specific URL

```bash
URL_ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "/settings/perfil")
curl -s -H "X-Review-Token: $TOKEN" "$BRIDGE_URL/comments?status=open&url=$URL_ENC"
```

### Specific IDs

```bash
for ID in cmt-aaa cmt-bbb cmt-ccc; do
  curl -s -H "X-Review-Token: $TOKEN" "$BRIDGE_URL/comments/$ID" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);c=d['comment'];print(c['id'], '-', c['status'], '-', c['text'][:80])"
done
```

### Check what was left for you to review (post-run)

```bash
curl -s -H "X-Review-Token: $TOKEN" "$BRIDGE_URL/comments?status=in_review" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for c in d['comments']:
    s = c.get('resolution', {}).get('summary', '?')
    print(c['id'], '·', c['url'], '·', s)
"
```

## Troubleshooting

| Symptom | Cause | Workaround |
|---|---|---|
| `401` | wrong token | re-read `review-bridge/.env` (the line may have an extra space) |
| `404` on a transition | comment was already archived/deleted | skip it in the batch |
| `400 invalid_actor` | you forgot to send `actor` in the body | always include `{kind,id,name}` |
| 0 comments returned when there should be some | the filter only took `status=open`, but what you want may be in `in_review` or the archive | review the filter |
| Long batch, connection dropped | it keeps what you already marked; re-running with `status=open` will skip the ones that became `in_review` | OK by design |
| Comment comes back as `open` even after I marked it in_review | the user rejected it — you do not need to repeat, wait for them to adjust the request | OK |
