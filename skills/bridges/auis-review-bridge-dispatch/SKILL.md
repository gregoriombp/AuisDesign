---
name: auis-review-bridge-dispatch
description: >
  The /loop dispatcher for the Auis Review Bridge — the "motor" that turns
  comments into live agent commands. One pass = read the dispatch queue
  (`/api/review-bridge/dispatch-queue`): OPEN, user-authored comments that
  @mention an agent the user ENABLED in the floating Auis dot, already gated
  by the double-lock (Live Response = reply only; Auto Construct + `#now` = act).
  For each item it routes by agent and mode: @Claude respond → replies in-thread;
  @Claude act (with #now) → runs the referenced `/skill` (or infers solve /
  ux-writing / edit-bridge-solve), implements, marks the comment `in_review` for
  the user's inbox, and replies a summary; @Germano respond → posts a UI/UX read;
  @Germano act (with #now) → runs his explore/audit skills and replies the
  findings. Meant to run under `/loop` (e.g. "/loop 30s /auis-review-bridge-dispatch"
  or self-paced) so the bridge feels live — it only acts on agents the user turned
  on in the dot, and `#now` is required for any code change. Use when the user
  says "/auis-review-bridge-dispatch", "turn on the agents' motor", "run the
  bridge dispatcher", "make the agents answer the @ in review", "process the
  mention queue", "start the dispatch loop", or sets up a loop over the review
  bridge mentions. Does NOT author comments (that is the in-browser Review Mode)
  and does NOT start the server (that is `auis-review-bridge`).
---

# Auis Review Bridge — Dispatcher (the `/loop` motor)

This skill is **the motor** that turns the mentions (`@agent`, `/skill`, `#now`) in
Review Mode comments into action. The bridge is a passive store; **this skill
is the one that watches and dispatches**. One invocation = **one pass** over the queue. The
cadence comes from `/loop` (e.g. `/loop 30s /auis-review-bridge-dispatch`, or with no
interval so you pace yourself). Do not loop internally — do one pass and
return.

> Prerequisite: `npm run dev` running at the root. The bridge is **serverless, embedded
> in Next** (routes `/api/review-bridge/*`, same-origin, no token). Source of
> truth: `app/api/review-bridge/*/route.ts`.

## The double lock (already applied by the endpoint)

The user controls each agent from the **floating button** (Live Response / Auto Construct). The
queue (`/dispatch-queue`) already resolves this — you do **not** re-decide the gate:

```
Live Response ON, no #now (or Auto OFF)   → mode "respond"  (only talks, never touches code)
Auto Construct ON  +  #now in the comment → mode "act"      (executes and sends for review)
agent turned off in the floating button   → does not enter the queue
pin authored by an agent (e.g. Germano)   → does not enter the queue (no self-loop)
comment the agent already replied to      → does not enter the queue (idempotent)
```

## Actor identity (on EVERY write to the bridge)

```json
Claude  → { "kind": "agent", "id": "claude",  "name": "Claude" }
Germano → { "kind": "agent", "id": "germano", "name": "Germano Faccio" }
```

---

## Flow

### 0. Validate the bridge

```bash
# Port of YOUR dev server (3000 by default; 3001 in Germano's setup). Do NOT read
# BRIDGE_URL from the env (an old .env.local points at the dead Express on :9878).
BRIDGE_URL=http://127.0.0.1:3000/api/review-bridge
curl -s "$BRIDGE_URL/health" >/dev/null || { echo "bridge offline — run 'npm run dev' at the root"; exit 0; }
```

### 1. Pull the queue

```bash
curl -s "$BRIDGE_URL/dispatch-queue" | python3 -m json.tool > /tmp/dispatch-queue.json
# optional, focus on one page:  "$BRIDGE_URL/dispatch-queue?url=/perfil"
```

Each item: `{ commentId, url, agentId, agentName, mode, text, skills[], createdAt }`.
The `settings` object at the end says which toggles are on (use it to report).

### 2. Empty queue

If `items` is `[]`, **close the pass** with one short line: nothing actionable +
which agents/capabilities are on (from `settings`). Do not write anything to the
bridge. `/loop` calls again on the next tick.

### 3. Dispatch item by item (FIFO order comes ready)

Route by `agentId` × `mode`:

| Agent | `respond` | `act` (has `#now`) |
|---|---|---|
| **claude** | Reads the comment (+ `context` when present) and **replies in the thread** with a useful, short answer, in the product's voice — answers the question, gives the info, or asks for clarification. **Does not touch code.** | See "Claude · act" below. |
| **germano** | **Replies** with a UI/UX read/opinion/diagnosis in **Germano's voice** (critical, premium — Vercel/Linear/Apple). Does not touch code, does not transition. | See "Germano · act" below. |

**Claude · act** (actually executes):
1. If the item carries a cited `skill` → invoke **that** skill, scoped to the page's
   `url`. If it does not, **infer** it from the intent of the text:
   - "resolve the comments / fix this" → `auis-review-bridge-solve` (on the `url`).
   - "fix the text / microcopy / UX writing" → `auis-ux-writing`.
   - "materialize the live edit edits" → `auis-edit-bridge-solve`.
   - **Too ambiguous** → do not act: **reply with a question** (reply, actor claude) and stop on that item.
2. The sub-skills run in **auto mode** here: the `#now` IS the "go ahead" — do not
   ask for approval in the middle of the loop. The user's final gate is the **inbox** (you mark
   `in_review`, they approve/reject).
3. Once the change is made: **mark the comment `in_review`** (actor claude) and **post
   a reply** with 1–2 lines on what changed (+ files touched).

**Germano · act** (full analysis):
1. Run his skill(s) as requested: `auis-review-bridge-germano-explore`
   (patrols the page and pins suggestions) and/or `auis-review-bridge-germano-audit`
   (second opinion on the `in_review` ones), scoped to the `url`.
2. Post a **reply** on the original comment with a summary of what he saw/pinned
   (actor germano). Germano **does not edit code and does not mark `in_review`** — his
   skills only comment/pin; so **do not transition** the original comment.

#### Write calls

```bash
# Reply (reply in the thread)
curl -s -X POST "$BRIDGE_URL/comments/$CID/replies" -H 'content-type: application/json' \
  -d '{"authorKind":"agent","authorId":"claude","authorName":"Claude","text":"..."}'

# Transition to review (only Claude, after implementing)
curl -s -X PUT "$BRIDGE_URL/comments/$CID" -H 'content-type: application/json' \
  -d '{"transition":"in_review","actor":{"kind":"agent","id":"claude","name":"Claude"}}'
```

### 4. Close the pass

Short summary: how many items, what each agent did (replied / executed+review /
analyzed), and what it skipped (and why). No `git`/PR here — that is the
user's flow (`/commit`).

## Safety rules

- **Never archive directly.** Claude always goes to `in_review`; the user approves.
- **Only acts with `#now`.** Without the directive, every @mention is `respond` (talks, does not touch code) — the queue guarantees this, but never "promote" a respond to an act on your own.
- **Do not invent an agent or a skill.** Only claude/germano and the skills in the registry. An unknown agent's item does not come through the queue; if something strange shows up, skip it and report.
- **One actor per write**, always the one of the agent that is acting (table above).
