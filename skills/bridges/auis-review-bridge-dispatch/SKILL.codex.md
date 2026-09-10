---
name: auis-review-bridge-dispatch
description: >
  Runs one pass of the Auis Review Bridge dispatcher — the motor that turns
  agent mentions in Review Mode comments into action. Reads
  /api/review-bridge/dispatch-queue (already gated by the per-agent Live
  Response / Auto Construct toggles in the floating dot), replies as Claude or
  Codex in respond mode, runs the cited or inferred skill and moves the item
  to in_review in act mode, and spawns the real Germano subagent for @germano
  items. One invocation = one pass; run it under /loop for cadence. Use for
  "/auis-review-bridge-dispatch", "turn on the agents' motor", "process the
  mention queue", "run the dispatch loop", "make agents answer review
  mentions", or a recurring dispatch loop. It does not author comments and
  there is no server to start.
---

# Auis Review Bridge — Dispatcher (the `/loop` motor)

This skill is **the motor** that turns the mentions (`@agent`, `/skill`) in Review
Mode comments into action. The bridge is a passive store; **this skill is what
watches and dispatches**. One invocation = **one pass** over the queue. The
cadence comes from `/loop` (e.g. `/loop 30s /auis-review-bridge-dispatch`, or with
no interval so you pace yourself). Do not loop internally — do one pass and
return.

> **Germano is a real agent.** He is NOT the executor pretending. When an item is
> `@germano`, you **spawn the `germano` agent** (defined for Codex in
> `.codex/agents/germano.toml`) with the
> item in the prompt — he runs in his own context, in his own voice, and returns
> a summary. `@claude` and `@codex` items keep distinct identities on every
> write, even when the same runtime executes both.

> Prerequisite: `npm run dev` running at the root. The bridge is **serverless,
> embedded in Next** (routes `/api/review-bridge/*`, same-origin; no token in
> local dev). Source of truth: `app/api/review-bridge/*/route.ts` — the queue
> itself is `app/api/review-bridge/dispatch-queue/route.ts`.

## The single lock (already applied by the endpoint)

One lock only: **the toggle in the floating dot (AuisDot) IS the permission** —
there is no directive to type in the comment. The user turns each agent on from
the dot (Live Response / Auto Construct — labelled *Auto Design* for the
executors and *Auto Review* for Germano). The queue (`/dispatch-queue`) already
resolves this — you do **not** re-decide the gate:

```
Auto Construct ON                              → mode "act"      (executes and sends for review)
Auto Construct OFF, Live Response ON           → mode "respond"  (only talks, never touches code)
agent turned off in the dot                    → not queued
pin authored by an agent (e.g. Germano)        → not queued (no self-loop)
mention typed by a reviewer, not by the admin  → not queued (agents obey only the admin)
comment the agent already answered after the
admin's latest message                         → not queued (idempotent)
```

## Actor identity (on EVERY write to the bridge)

The `id` must exist in `lib/auis-review/agentIdentity.ts` — anything else is
rejected as `unknown_executor`. There are exactly three agents:

```json
Claude  → { "kind": "agent", "id": "claude",  "name": "Claude" }
Codex   → { "kind": "agent", "id": "codex",   "name": "Codex" }
Germano → { "kind": "agent", "id": "germano", "name": "Germano Faccio" }
```

---

## Flow

### 0. Validate the bridge

```bash
# Base: the local dev server on port 3000 by default. To dispatch against a
# DEPLOYED instance, export BRIDGE_BASE=https://<your-deployment> (and
# BRIDGE_AGENT_TOKEN when that deployment enables auth). BRIDGE_BASE is the
# only host override accepted — never read a bridge URL from a .env file.
BRIDGE_URL=${BRIDGE_BASE:-http://127.0.0.1:3000}/api/review-bridge
curl -s "$BRIDGE_URL/health" >/dev/null || { echo "bridge offline — run 'npm run dev' at the root"; exit 0; }
```

`/health` answers `{ ok, service: "auis-review-bridge", mode: "serverless",
schemaVersion: 3, tokenRequired }`.

**Agent auth (only behind an auth layer):** when `BRIDGE_AGENT_TOKEN` is set in
your environment, add `-H "x-bridge-agent-token: $BRIDGE_AGENT_TOKEN"` to
**every** curl call of this flow (health, queue, replies, transitions) — without
it a deployment with auth answers 401/403. Local dev needs no token.

### 1. Pull the queue

```bash
curl -s "$BRIDGE_URL/dispatch-queue" | python3 -m json.tool > /tmp/dispatch-queue.json
# optional, focus on one page:  "$BRIDGE_URL/dispatch-queue?url=/auis/projects"
```

Each item: `{ commentId, url, agentId, agentName, mode, text, skills[], createdAt }`
(plus `flowRef` when the comment was left on a UX flow diagram). `skills[]`
carries `{ slug, label, acts }` for each `/skill` the user cited that this agent
may run. The `settings` object at the end says which toggles are on (use it to
report).

### 2. Empty queue

If `items` is `[]`, **close the pass** with one short line: nothing actionable +
which agents/capabilities are on (from `settings`). Do not write anything to the
bridge. `/loop` calls again on the next tick.

### 3. Dispatch item by item (FIFO order comes ready)

Route by `agentId` × `mode`:

| Agent | `respond` | `act` (Auto Construct ON) |
|---|---|---|
| **claude** | Reads the comment (+ `context` when present) and **replies in the thread** with a useful, short answer in the product's voice — answers the question, gives the info, or asks for clarification. **Does not touch code.** | See "Executor · act" below. |
| **codex** | Same reply contract as Claude, but every write uses the Codex actor. **Does not touch code** in `respond`. | Same execution and approval contract as Claude, with the Codex actor. |
| **germano** | **Spawns the `germano` subagent** (see "Germano · subagent" below). You do not write in his voice — he replies himself. | **Spawns the `germano` subagent** (same path, mode `act`). |

**Executor (Claude/Codex) · act** (actually executes):
1. If the item carries a cited skill in `skills[]` → invoke **that** skill, scoped
   to the page's `url`. If it does not, **infer** it from the intent of the text:
   - "resolve the comments / fix this" → `auis-review-bridge-solve` (on the `url`).
   - "fix the text / microcopy / UX writing" → `auis-ux-writing`.
   - "materialize the Live Edit edits" → `auis-edit-bridge-solve`.
   - **Too ambiguous** → do not act: **reply with a question** (the item's actor)
     and stop on that item.
2. The sub-skills run in **auto mode** here: the **Auto Construct toggle** IS the
   "go ahead" — do not ask for approval in the middle of the loop. The user's
   final gate is the **inbox** (you mark `in_review`; they approve/reject at
   `/auis/styleguide/review` or on the dashboard at `/auis/review-bridge`).
3. Once the change is made: **mark the comment `in_review`** (the item's actor)
   and **post a reply** with 1–2 lines on what changed (+ files touched). Run
   `npm run typecheck` and `npm run lint` when you edited code.

**Germano · subagent** (respond AND act — always through the real subagent):
1. Spawn the `germano` agent (the Codex agent defined in `.codex/agents/germano.toml`)
   passing the item in the prompt: `commentId`, `url`, `mode` (respond|act),
   `text` and the `context` (fetch it with `GET /comments/$CID?view=lean` — it
   includes the `location` trail). He runs in his **own context**, in his own
   voice — you do not write for him.
2. `mode: "respond"` → he posts a reply with his UI/UX read. `mode: "act"` → he
   runs his skills (`auis-review-bridge-germano-explore` /
   `auis-review-bridge-germano-audit`), pins suggestions and sums it up in a reply.
3. Germano **does not edit code and does not mark `in_review`** — he only
   comments/pins (the bridge enforces it: `germano_comment_only`). He writes to
   the bridge himself as `{ kind: "agent", id: "germano", name: "Germano Faccio" }`
   and returns a short summary — use that summary to close the pass. **Do not
   transition** the original comment.

#### Write calls

```bash
# Copy these values from the queue item. Never use the browser's identity.
AGENT_ID="$agentId"
AGENT_NAME="$agentName"

# Reply (answer in the thread)
curl -s -X POST "$BRIDGE_URL/comments/$CID/replies" \
  -H 'content-type: application/json' -H "x-bridge-agent-id: $AGENT_ID" \
  -d "{\"authorKind\":\"agent\",\"authorId\":\"$AGENT_ID\",\"authorName\":\"$AGENT_NAME\",\"text\":\"...\"}"

# Transition to review (Claude or Codex, after implementing)
curl -s -X PUT "$BRIDGE_URL/comments/$CID" \
  -H 'content-type: application/json' -H "x-bridge-agent-id: $AGENT_ID" \
  -d "{\"transition\":\"in_review\",\"actor\":{\"kind\":\"agent\",\"id\":\"$AGENT_ID\",\"name\":\"$AGENT_NAME\"}}"
```

The `x-bridge-agent-id` header is authoritative: the server canonicalizes the
author to that agent (name and color come from the registry), and a body
`actor.id` that differs from the header is rejected (`agent_identity_mismatch`).
With `BRIDGE_AGENT_TOKEN` set, add the `x-bridge-agent-token` header to both
calls.

### 4. Close the pass

Short summary: how many items, what each agent did (replied / executed+review /
analyzed), and what it skipped (and why). No `git`/PR here — that is the user's
flow (`/commit`).

## Safety rules

- **Never archive directly.** Claude and Codex always go to `in_review`; the user
  approves.
- **The toggle is the permission.** There is no directive in the comment text.
  `act` only when the agent has **Auto Construct on**; otherwise it is `respond`
  (talks, does not touch code) — the queue guarantees this. Never "promote" a
  respond to an act on your own.
- **Germano runs as a real subagent** (the `germano` agent in `.codex/agents/germano.toml`), never as the
  executor pretending to be him.
- **Do not invent an agent or a skill.** Only claude/codex/germano and the skills
  in `lib/auis-review/skills.ts`. An unknown agent's item never comes through the
  queue; if something strange shows up, skip it and report.
- **One actor per write**, always the one of the agent that is acting (table
  above).
- **Never read the raw JSON** (`review-bridge/data/*.json`). The queue already
  comes lean from `/dispatch-queue`; when you need an item's context, use
  `GET /comments/:id?view=lean` — never the whole file.

## Troubleshooting

| Symptom | Cause | Way out |
|---|---|---|
| `ECONNREFUSED 127.0.0.1:3000` | Next is not running | `npm run dev` at the root |
| `403 agent_auth_required` (or a 401 from the auth layer in front) | deployment with auth, no agent token | add `-H "x-bridge-agent-token: $BRIDGE_AGENT_TOKEN"` to every call |
| `400 agent_identity_mismatch` | body `actor.id` differs from `x-bridge-agent-id` | use the item's `agentId` in both |
| `403 germano_comment_only` | something tried to move an item to `in_review` as Germano | Germano never transitions; only the executors do |
| The same item comes back on every pass | the reply was posted as another actor, or the user re-mentioned the agent after your reply | reply with the item's own actor; a fresh admin mention legitimately re-opens the item |
