// Parity tests for the 16 Review Bridge endpoints, driven through a standard
// Request against an isolated data folder. Data, backups and cwd point at a
// temp dir before any route module loads, because the store resolves its paths
// when it loads. The same assertions must hold before and after the routes move
// behind @auis/server's handle(Request): only `handle` below changes.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createLegacyHandler } from "./legacy-handler";

const root = mkdtempSync(path.join(tmpdir(), "review-routes-"));
process.env.REVIEW_BRIDGE_BACKUP_DIR = path.join(root, "backups");
delete process.env.AUIS_MENTION_TRIGGER;
delete process.env.BRIDGE_AGENT_TOKEN;
process.chdir(root);

const imagesDir = path.join(root, "review-bridge", "data", "images");
mkdirSync(imagesDir, { recursive: true });
const IMAGE_NAME = `${"a".repeat(64)}.png`;
const IMAGE_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
writeFileSync(path.join(imagesDir, IMAGE_NAME), IMAGE_BYTES);

const handle = createLegacyHandler();
const BASE = "http://127.0.0.1:3000/api/review-bridge";

// The assertions read arbitrary JSON shapes; typing each response adds nothing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

async function call(
  method: string,
  route: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: Json }> {
  const res = await handle(
    new Request(`${BASE}/${route}`, {
      method,
      headers: body === undefined ? headers : { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

function comment(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    schemaVersion: 3,
    authorId: "alex",
    authorName: "Alex",
    authorColorToken: "var(--fg-primary)",
    createdAt: 1000,
    updatedAt: 1000,
    url: "/dashboard",
    viewportWidth: 1440,
    viewportHeight: 900,
    scrollY: 0,
    documentHeight: 900,
    anchor: { kind: "pin", position: { x: 10, y: 20 } },
    text: `text of ${id}`,
    status: "open",
    ...overrides,
  };
}

const AGENT = { "x-bridge-agent-id": "claude" };
const ADMIN_ACTOR = { kind: "user", id: "alex", name: "Alex" };
let userReplyId = "";

test("health answers the exact shape the skills and the runner check", async () => {
  const r = await call("GET", "health");
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, {
    ok: true,
    service: "auis-review-bridge",
    mode: "serverless",
    schemaVersion: 3,
    tokenRequired: false,
  });
});

test("session: without an auth layer every browser is an admin", async () => {
  const r = await call("GET", "session");
  assert.deepEqual(r.json, { role: "admin", email: null, shared: false, authEnabled: false });
});

test("version returns a signature string", async () => {
  const r = await call("GET", "version");
  assert.equal(r.status, 200);
  assert.equal(typeof r.json.signature, "string");
});

test("agent-settings: read, update and validate", async () => {
  const read = await call("GET", "agent-settings");
  assert.equal(read.status, 200);
  assert.deepEqual(Object.keys(read.json.settings).sort(), ["claude", "codex", "grok"]);
  assert.equal(read.json.runtime.claude.name, "Claude");
  assert.equal(read.json.triggerEnabled, false);

  const put = await call("PUT", "agent-settings", { agentId: "grok", settings: { enabled: true } });
  assert.equal(put.status, 200);
  assert.equal(put.json.settings.enabled, true);

  assert.equal((await call("PUT", "agent-settings", { agentId: "nobody" })).json.error, "unknown_agent");
  assert.equal((await call("PUT", "agent-settings", "{not json")).json.error, "invalid_body");
});

test("comments: create through PUT, and the validation errors", async () => {
  assert.deepEqual((await call("PUT", "comments/c1", comment("c1"))).json, { ok: true });
  assert.equal((await call("PUT", "comments/c2", comment("c2", { url: "/settings" }))).status, 200);
  const flow = comment("c3", { url: "/auis/ux-flow/checkout", origin: "ux-flow", flowRef: { flow: "checkout" } });
  assert.equal((await call("PUT", "comments/c3", flow)).status, 200);

  assert.equal((await call("PUT", "comments/other", comment("c9"))).json.error, "id_mismatch");
  assert.equal((await call("PUT", "comments/c9", { id: "c9" })).json.error, "invalid_comment");
  assert.equal(
    (await call("PUT", "comments/c9", comment("c9", { origin: "ux-flow" }))).json.error,
    "invalid_comment_target",
  );
  assert.equal(
    (await call("PUT", "comments/c9", comment("c9", { revealPath: "t:Delete" }))).json.error,
    "invalid_reveal_path",
  );
});

test("comments list: query filters and views", async () => {
  const ids = async (query: string) =>
    (await call("GET", `comments${query}`)).json.comments.map((c: { id: string }) => c.id).sort();
  assert.deepEqual(await ids(""), ["c1", "c2", "c3"]);
  assert.deepEqual(await ids("?url=%2Fdashboard"), ["c1"]);
  assert.deepEqual(await ids("?origin=ux-flow"), ["c3"]);
  assert.deepEqual(await ids("?flow=checkout"), ["c3"]);
  assert.deepEqual(await ids("?status=open"), ["c1", "c2", "c3"]);
  assert.deepEqual(await ids("?authorRole=admin"), ["c1", "c2", "c3"]);

  const lean = (await call("GET", "comments?view=lean")).json.comments[0];
  assert.equal("anchor" in lean, false);
  const full = (await call("GET", "comments")).json.comments[0];
  assert.equal("anchor" in full, true);
});

test("one comment: read it, and 404 for an unknown id", async () => {
  const r = await call("GET", "comments/c1");
  assert.equal(r.json.comment.id, "c1");
  assert.equal(r.json.location, "main");
  assert.equal(r.json.comment.authorKind, "user");
  assert.equal(r.json.comment.authorRole, "admin");
  assert.equal((await call("GET", "comments/nope")).status, 404);
});

test("replies: a user, an agent, the errors, and editing", async () => {
  const user = await call("POST", "comments/c1/replies", {
    authorKind: "user",
    authorId: "alex",
    authorName: "Alex",
    text: "  can you check?  ",
  });
  assert.equal(user.status, 200);
  assert.equal(user.json.reply.text, "can you check?");
  assert.equal(user.json.location, "main");
  userReplyId = user.json.reply.id;

  const agent = await call(
    "POST",
    "comments/c1/replies",
    { authorKind: "agent", authorId: "claude", authorName: "Claude", text: "done" },
    AGENT,
  );
  assert.equal(agent.json.reply.authorKind, "agent");
  assert.equal(agent.json.reply.authorId, "claude");

  assert.equal((await call("POST", "comments/c1/replies", { authorKind: "user", text: "" })).json.error, "invalid_reply");
  assert.equal(
    (await call("POST", "comments/c1/replies", { authorKind: "user", authorId: "a", authorName: "A", text: "x" }, { "x-bridge-agent-id": "nobody" })).json.error,
    "unknown_agent_author",
  );
  assert.equal(
    (await call("POST", "comments/missing/replies", { authorKind: "user", authorId: "a", authorName: "A", text: "x" })).status,
    404,
  );

  const edited = await call("PATCH", `comments/c1/replies/${encodeURIComponent(userReplyId)}`, { text: "edited reply" });
  assert.equal(edited.status, 200);
  assert.equal(edited.json.reply.text, "edited reply");
  assert.equal((await call("PATCH", `comments/c1/replies/${userReplyId}`, { text: " " })).json.error, "invalid_reply");
});

test("editing a comment from a stale copy keeps the stored replies", async () => {
  const stale = comment("c1", { text: "edited text", replies: [] });
  assert.equal((await call("PUT", "comments/c1", stale)).status, 200);
  const stored = (await call("GET", "comments/c1")).json.comment;
  assert.equal(stored.text, "edited text");
  assert.equal(stored.replies.length, 2);
});

test("transitions: in review, approve, reopen, archive directly", async () => {
  const inReview = await call(
    "PUT",
    "comments/c1",
    { transition: "in_review", actor: { kind: "agent", id: "claude", name: "Claude" } },
    AGENT,
  );
  assert.equal(inReview.json.comment.status, "in_review");

  const approved = await call("PUT", "comments/c1", { transition: "approve", actor: ADMIN_ACTOR });
  assert.equal(approved.json.location, "archive");
  const archive = (await call("GET", "comments/archive")).json;
  assert.ok(archive.comments.some((c: { id: string }) => c.id === "c1"));

  const reopened = await call("PUT", "comments/c1", { transition: "reopen_from_archive", actor: ADMIN_ACTOR });
  assert.equal(reopened.json.location, "main");
  assert.equal(reopened.json.comment.status, "open");

  const archived = await call("PUT", "comments/c2", { transition: "resolve_direct", actor: ADMIN_ACTOR });
  assert.equal(archived.json.location, "archive");
  assert.equal((await call("PUT", "comments/c1", { transition: "teleport", actor: ADMIN_ACTOR })).json.error, "unknown_transition");
  assert.equal((await call("PUT", "comments/nope", { transition: "approve", actor: ADMIN_ACTOR })).status, 404);
});

test("dispatch queue lists an admin's mention of an agent that is on", async () => {
  await call("PUT", "comments/c4", comment("c4", { text: "@Grok take a look" }));
  const r = await call("GET", "dispatch-queue");
  assert.equal(r.status, 200);
  const item = r.json.items.find((i: { commentId: string }) => i.commentId === "c4");
  assert.equal(item?.agentId, "grok");
  assert.equal(item?.mode, "respond");
});

test("export and import", async () => {
  const exported = (await call("GET", "export")).json;
  assert.ok(Array.isArray(exported.comments));
  assert.ok(exported.archivedComments.some((c: { id: string }) => c.id === "c2"));

  const imported = await call("POST", "import", { comments: [comment("c5"), comment("c1")] });
  assert.deepEqual(imported.json, { added: 1, skipped: 1 });
  assert.equal((await call("POST", "import", { nothing: true })).json.error, "invalid_payload");
});

test("identities, members and reviewers", async () => {
  const identity = { id: "rev-1", name: "Jamie Doe", colorToken: "var(--fg-primary)", createdAt: 1 };
  assert.deepEqual((await call("PUT", "identity/rev-1", identity)).json, { ok: true });
  assert.equal((await call("PUT", "identity/rev-2", identity)).json.error, "id_mismatch");
  assert.equal((await call("PUT", "identity/rev-1", { id: "rev-1" })).json.error, "invalid_identity");

  const members = (await call("GET", "members")).json;
  assert.ok(members.members.some((m: { id: string }) => m.id === "rev-1"));
  assert.equal(members.hierarchyActive, false);

  const reviewers = (await call("GET", "reviewers")).json.reviewers;
  const jamie = reviewers.find((r: { id: string }) => r.id === "rev-1");
  assert.equal(jamie?.name, "Jamie Doe");
  assert.equal(typeof jamie?.handle, "string");

  assert.deepEqual((await call("DELETE", "identity/rev-1")).json, { ok: true });
  assert.equal((await call("DELETE", "identity/rev-1")).status, 404);
});

test("images: 400 for an unsafe name, 404 when missing, bytes when present", async () => {
  assert.equal((await call("GET", "images/..%2Fcomments.json")).json.error, "invalid_name");
  assert.equal((await call("GET", `images/${"b".repeat(64)}.png`)).status, 404);
  const res = await handle(new Request(`${BASE}/images/${IMAGE_NAME}`));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/png");
  assert.match(res.headers.get("cache-control") ?? "", /immutable/);
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), IMAGE_BYTES);
});

test("deleting a comment, then 404", async () => {
  assert.deepEqual((await call("DELETE", "comments/c4")).json, { ok: true });
  assert.equal((await call("DELETE", "comments/c4")).status, 404);
});
