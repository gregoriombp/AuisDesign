---
name: auis-review-bridge-solve
description: >
  Resolves Auis Review Mode comments in bulk. Reads from the review-bridge
  using a filter chosen by the user (all of them, only today's, only open
  ones, a specific page, a UX flow, explicit IDs, etc.), makes ONE PLAN BEFORE
  touching any code, waits for the user's approval, implements the fixes, and
  marks each comment as `in_review` in the bridge with
  `actor: { kind: "agent", id: "claude", name: "Claude" }` — the user then
  approves or rejects it afterward via the inbox. It can also respond with a
  question (an agent reply) when a comment is ambiguous. Use whenever the user
  asks for "/auis-review-bridge-solve", "resolve all the review comments",
  "take today's and resolve them", "resolve the open ones in bulk", "resolve
  the comments on /page/x", "reply to the bridge comments", or variations.
  The bridge is served by the Next app — there is no server to start.
---

# Auis Review Bridge — Batch resolve

This skill is the **agent that resolves** Review Mode comments. It reads the
bridge, plans the fixes, implements them, and hands each item back marked as
**in review** for the user to approve from the inbox.

> Prerequisite: `npm run dev` is already running at the root. The bridge is
> **serverless, embedded in Next** (routes `/api/review-bridge/*`, same-origin,
> no separate client configuration).
>
> Source of truth for the endpoints: `app/api/review-bridge/*/route.ts`; the
> record shape is `components/auis-review/types.ts`; the overview is
> `review-bridge/README.md`.

## Golden rule

**You do NOT archive directly.** Always transition to `in_review` and let the
user approve. The only exception is when the user explicitly asks to "archive
it directly" / "mark it as resolved without review" — and even then the bridge
only accepts `resolve_direct` from a user actor, so hand it back to the user
instead of forcing it.

```
current status → what you do
─────────────────────────────────
open         → in_review   (after implementing the fix)
open         → reply       (if you want the user's opinion first)
in_review    → don't touch (already with you or another agent; only the user can approve/reject)
backlog      → don't touch (a "future idea" parked by the user; not part of the open queue)
resolved     → ignore      (already archived; different queue)
```

## Actor identity

Sign with the identity of the runtime that is running. The `id` **must** exist
in `lib/auis-review/agentIdentity.ts` — an invented id is rejected as
`unknown_executor`.

```
Claude  → { "kind": "agent", "id": "claude",  "name": "Claude" }
Codex   → { "kind": "agent", "id": "codex",   "name": "Codex" }
```

Do not borrow another executor's identity. Germano is comment-only and never
signs a transition. This document runs as Claude:

```bash
AGENT_ID=claude
AGENT_NAME=Claude
```

---

## Flow

### 0. Setup — validate the bridge

```bash
# Bridge base: local by default. To act on a DEPLOYED instance export
# BRIDGE_BASE=https://<your-deployment> (and BRIDGE_AGENT_TOKEN when that
# deployment enables auth). BRIDGE_BASE is the only host override this skill
# accepts — never read a bridge URL from a .env file.
BRIDGE_URL=${BRIDGE_BASE:-http://127.0.0.1:3000}/api/review-bridge

# Checks that Next is alive and answering in serverless mode.
curl -s "$BRIDGE_URL/health" | python3 -c "import sys,json;d=json.load(sys.stdin);assert d['ok'] and d['schemaVersion']==3 and d.get('mode')=='serverless', d"
```

**Agent auth (only behind an auth layer):** if `BRIDGE_AGENT_TOKEN` is in your
environment, add `-H "x-bridge-agent-token: $BRIDGE_AGENT_TOKEN"` to **every**
curl call of this flow (health included). Without the header a deployment with
auth answers 401/403. Local dev has no token and the calls stay as they are.

The Next routes persist through `lib/bridge-store` (atomic writes + a lock on
the local JSON files). If health fails, stop with a message telling the user to
run `npm run dev` at the root (or to check `BRIDGE_BASE`/the token when pointing
at a deployment) and come back.

### 1. Parse the filter from the user's request

Map what the user asked for to the right filter:

| What the user said | Filter to apply |
|---|---|
| "all the comments" / "everything" / no filter | `status=open` (default — does not pull in_review, backlog or the archive) |
| "the open ones" / "open" | `status=open` |
| "the ones in review" / "in_review" / "pending my approval" | `status=in_review` (but you must NOT touch these; abort with an explanation) |
| "today's" | `status=open` + filter `createdAt >= today's local midnight` |
| "since yesterday" / "the last N days" | `status=open` + date filter |
| "the ones on page X" / "/auis/projects" | `status=open&url=/auis/projects` |
| "the ones on the example flow" | `status=open&origin=ux-flow&flow=example` |
| "only the admin's asks" | add `&authorRole=admin` |
| "comment cmt-xxx" | direct GET by id |
| "reply to the open ones with a question" | `status=open` filter, but instead of implementing, post a reply |

> `status=open` with no other filter pulls in old comments. ALWAYS add the
> `createdAt >= today_midnight` filter when the user says "today", and ALWAYS
> filter by `url` when the user is focused on one page.

### 2. Fetch and rank (light phase — `preview` only, ~95% smaller)

```bash
curl -s "$BRIDGE_URL/comments?status=open&view=preview" \
  | python3 -m json.tool > /tmp/review-bridge-open.json
```

Apply the additional filters (date, url, author) in Python or jq.

> **Two phases.** `preview` brings only id/url/status/origin/text/author/reply
> count — enough to rank and build the plan (§3). The heavy context
> (`context.target`, `context.location`, whole replies, images) you pull **by
> id** only for the ones you will implement (§4, `?view=lean`). Never pull the
> whole batch in full.

Default ranking for the processing order:
1. Oldest comments first (FIFO — the user has been waiting longer).
2. Tie-break: same URL → one contiguous block (so you read that file only once
   while planning).

> **Hierarchy (`authorRole`).** The preview carries `authorRole` per comment:
> `"reviewer"` = a guest session (once the product puts Auis behind an auth
> layer). Usually a QUESTION/opinion, not a command. Only the admin commands
> implementation. Default: `authorRole: "reviewer"` comments enter the plan as
> **"reply"** or **"triage with the admin"**, never as a direct implementation,
> unless the admin explicitly asks ("resolve the reviewers' ones too"). Absent =
> legacy record = admin. The server can filter for you: `&authorRole=admin`.

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

> **Auto mode.** When this skill is invoked by the dispatcher
> (`auis-review-bridge-dispatch`, an item in mode `act`), the user's Auto
> Construct toggle IS the approval: skip the question, proceed with "run
> everything" scoped to the item's `url`, and flag it in the final summary. The
> user's gate is the inbox.

### 4. Execute item by item

For each comment marked **implement**:

1. **Pull the full record by id.** The `preview` from §2 has no context. Use the
   `lean` projection (brings `context.target`, `context.location`, replies and
   images, without the geometry you do not use), one at a time, only for the
   ones you will touch:

   ```bash
   curl -s "$BRIDGE_URL/comments/$ID?view=lean" \
     | python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin)['comment'],indent=2,ensure_ascii=False))"
   ```

   Then read the page file (`comment.url` → map it to `app/.../page.tsx` or the
   corresponding component).
   - Before editing, read `comment.context` when it exists. Use
     `context.target.label`, `context.target.text`, `context.target.attributes`,
     `context.target.fingerprint` and `context.nearbyText` to identify the real
     target of short requests like "remove this" or "swap this text". If the
     context contradicts the visual coordinate, trust the target's text/label
     first and confirm against the page code.
   - `context.location` says WHERE the pin was dropped — a landmark trail from
     the outermost to the innermost, e.g. `["Modal: New project", "Section:
     Details"]`. A trail starting with `Modal:` means a suspended target: the
     element is not on the bare page, and checking it visually requires
     reproducing that state first. The full record (no `view`) also carries
     `revealPath` — the triggers the author clicked to reach that state
     (`selector`, `fingerprint`, `label`); pull it only when you need to replay
     the path in a browser.
   - **UX flow comment** (`comment.origin === "ux-flow"`): it was left on a flow
     diagram. It has `flowRef: { flow, nodeId, nodeLabel }`. The fix goes into
     the `NODES`/`EDGES` arrays of `app/auis/ux-flow/<flow>/page.tsx` (the node
     is `flowRef.nodeId`). Treat it as a flow edit (same logic as
     `auis-update-ux-flow`) and add an entry to that page's `updates` array if
     it is a structural change. Then mark the comment `in_review` like the
     others.
2. Implement the fix in the code with Edit/Write. Follow the design-system
   rules: tokens only (no hardcoded colors/sizes), `Au*` components from
   `components/ui/`, icons through `components/ui/Icon.tsx` (Material Symbols —
   no raw `<svg>`), no emoji, English UI text. Invoke `auis-ux-writing` only if
   the fix audits or creates copy that affects a decision, consequence, error,
   permission or recovery. Preserved copy, incidental labels and derived
   accessible names do not need the skill.
3. Mark the comment as `in_review`:

```bash
curl -s -X PUT "$BRIDGE_URL/comments/$ID" \
  -H "Content-Type: application/json" -H "x-bridge-agent-id: $AGENT_ID" \
  -d "{\"transition\":\"in_review\",\"actor\":{\"kind\":\"agent\",\"id\":\"$AGENT_ID\",\"name\":\"$AGENT_NAME\"}}" \
  | python3 -m json.tool
```

The response is `{ ok, comment, location }` and `comment.resolution.summary`
reads:

```
Resolved by Claude on DD/MM/YYYY at HH:MM:SS.
```

Note the id+summary to put in the final summary.

For the ones marked **reply with a question**:

```bash
curl -s -X POST "$BRIDGE_URL/comments/$ID/replies" \
  -H "Content-Type: application/json" -H "x-bridge-agent-id: $AGENT_ID" \
  -d "{\"authorKind\":\"agent\",\"authorId\":\"$AGENT_ID\",\"authorName\":\"$AGENT_NAME\",\"text\":\"<your concise question, ending in ?>\"}"
```

The server stamps the agent's color from the registry — `authorColorToken` is
optional. Do not mark these as `in_review`: they stay `open` waiting for the
user to reply in the thread.

4. Before finishing the batch, run `npm run typecheck` and `npm run lint`.

### 5. Final summary

Report to the user in a single message (do not trickle it out):

```
Implemented (N) — in review in the inbox:
   - cmt-... · /url · 1 line on what was done
   ...

Replied (M) — waiting for you in the thread:
   - cmt-... · /url · "question?"
   ...

Skipped (K):
   - cmt-... · /url · reason

Check the inbox at /auis/styleguide/review (or the dashboard at /auis/review-bridge)
to approve/reject the implemented ones. Approving moves them to the archive;
rejecting sends them back to "open".
```

Mention the amber badge with the in-review count that appears in the Review
Mode toolbar.

---

## "implement vs reply vs skip" decisions

| Signal in the comment text | Decision |
|---|---|
| "change X to Y" / "it should be Y" / clear instructions | implement |
| "this looks odd" / "I don't like it" / no direction | reply with a question asking for direction |
| "broken" / "bug" / points at a concrete problem in the UI | implement (investigate and fix) |
| direct question to the agent ("@claude, which...") | reply |
| screenshot attached + no text | reply with "what do you want to change in this annotation?" |
| comment referring to backend/data | skip (Auis is the UI/UX layer; the backend belongs to the host product) |
| reference to a mobile feature | skip (Auis is desktop-only — see `AGENTS.md`) |

## Constraints

- Do not use `transition: "approve"` or `transition: "resolve_direct"` — only
  the human user approves/archives directly (the bridge rejects them from an
  agent).
- Do not delete comments (`DELETE /comments/:id`).
- Do not touch comments with `status: "in_review"` (they are already in the
  user's queue).
- Do not touch archived comments (`/comments/archive`) unless the user
  explicitly asks.
- **Never read the raw JSON** (`Read`/`grep`/`cat` on
  `review-bridge/data/*.json`): the hot file and the archive grow without bound
  and burn context for nothing. Always through the filtered API, with
  `?view=preview` to plan and `?view=lean` to implement.
- Do not reply in the thread if the reply is "OK" / has no content. A reply is
  for asking a legitimate question.
- Do not accept an external `BRIDGE_URL`. The base is
  `${BRIDGE_BASE:-http://127.0.0.1:3000}` + `/api/review-bridge`; `BRIDGE_BASE`
  (a deployment of this same app) is the only expected override.
- Always send `x-bridge-agent-id` on writes, with the same id as the `actor`.
- Always take the server timezone for the `summary` (the bridge does this on
  its own — do not recompute it on the client).
- If the connection drops mid-batch, resume from the next pending id (the
  already-persisted `in_review` status protects against repeats).

## Useful filters — ready-made recipes

### Today, status open

```bash
TODAY_MS=$(python3 -c "import datetime;t=datetime.datetime.now().replace(hour=0,minute=0,second=0,microsecond=0);print(int(t.timestamp()*1000))")
curl -s "$BRIDGE_URL/comments?status=open&view=preview" \
  | TODAY_MS=$TODAY_MS python3 -c "
import sys, json, os
d = json.load(sys.stdin)
today_ms = int(os.environ['TODAY_MS'])
today = [c for c in d['comments'] if c['createdAt'] >= today_ms]
print(json.dumps({'count': len(today), 'ids': [c['id'] for c in today]}, indent=2))
"
```

### Everything open on a specific URL

```bash
URL_ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "/auis/styleguide/components/au-button")
curl -s "$BRIDGE_URL/comments?status=open&url=$URL_ENC&view=preview"
```

### Open comments on one UX flow

```bash
curl -s "$BRIDGE_URL/comments?status=open&origin=ux-flow&flow=example&view=preview"
```

### Specific IDs

```bash
for ID in cmt-aaa cmt-bbb cmt-ccc; do
  curl -s "$BRIDGE_URL/comments/$ID?view=preview" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);c=d['comment'];print(c['id'], '-', c['status'], '-', c['text'][:80])"
done
```

### Check what was left for you to review (post-run)

```bash
curl -s "$BRIDGE_URL/comments?status=in_review&view=lean" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for c in d['comments']:
    s = (c.get('resolution') or {}).get('summary', '?')
    print(c['id'], '·', c['url'], '·', s)
"
```

## Troubleshooting

| Symptom | Cause | Workaround |
|---|---|---|
| `ECONNREFUSED` / `Failed to connect to 127.0.0.1:3000` | Next is not running | `npm run dev` at the root |
| `403 {"error":"agent_auth_required"}` (or a 401 from the auth layer in front) | pointing at a deployment with auth without the agent header | add `-H "x-bridge-agent-token: $BRIDGE_AGENT_TOKEN"` to every call |
| health responds but `mode != "serverless"` | the endpoint does not belong to this app | check `BRIDGE_BASE` and aim at the Next app |
| `404` on a transition | comment was already archived/deleted | skip it in the batch |
| `400 invalid_actor` | you forgot to send `actor` in the body | always include `{kind,id,name}` |
| `400 agent_identity_mismatch` | `actor.id` differs from the `x-bridge-agent-id` header | use the same id in both |
| `403 unknown_executor` | invented actor id | only `claude` or `codex` transition |
| 0 comments returned when there should be some | the filter only took `status=open`, but what you want may be in `in_review`, `backlog` or the archive | review the filter |
| Long batch, connection dropped | it keeps what you already marked; re-running with `status=open` will skip the ones that became `in_review` | OK by design |
| Comment comes back as `open` even after I marked it in_review | the user rejected it — you do not need to repeat, wait for them to adjust the request | OK |
