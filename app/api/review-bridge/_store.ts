import path from "node:path";

import { createDocStore } from "@/lib/bridge-store";
import { externalizeComment, externalizeImageList } from "./_images";
import { ensureRestored, snapshot } from "./_backup";
import type {
  ReviewActor,
  ReviewAgentSettings,
  ReviewAgentSettingsMap,
  ReviewComment,
  ReviewCommentOrigin,
  ReviewCommentStatus,
  ReviewExportPayload,
  ReviewIdentity,
  ReviewReply,
} from "@/components/auis-review/types";

/**
 * Serverless store of the Review Bridge. Review Mode posts here (same-origin)
 * and this module persists through lib/bridge-store: the disk driver keeps
 * `review-bridge/data/comments.json` + `comments.archive.json`, which is
 * exactly what the solve/germano skills read. Backup/restore hooks live next
 * to the files (`_backup.ts`).
 */

const SCHEMA_VERSION = 3;
const DATA_DIR = path.join(process.cwd(), "review-bridge", "data");
const MAIN_FILE = path.join(DATA_DIR, "comments.json");
const ARCHIVE_FILE = path.join(DATA_DIR, "comments.archive.json");

const MAIN_KEY = "review:main";
const ARCHIVE_KEY = "review:archive";

interface MainDb {
  schemaVersion: number;
  comments: ReviewComment[];
  identities: ReviewIdentity[];
  agentSettings: ReviewAgentSettingsMap;
}
interface ArchiveDb {
  schemaVersion: number;
  comments: ReviewComment[];
}

const docs = createDocStore({
  namespace: "review",
  resolveFile: (key) => (key === ARCHIVE_KEY ? ARCHIVE_FILE : MAIN_FILE),
  hooks: {
    // Self-heals when comments.json vanished (clean/reinstall).
    beforeRead: async () => {
      await ensureRestored();
    },
    // Snapshots the pre-change state; forced when the write empties the
    // comments (defense against truncation/wipe).
    beforeWrite: async (next) => {
      const n = next as { comments?: unknown[] };
      await snapshot({ force: Array.isArray(n.comments) && n.comments.length === 0 });
    },
  },
});

const initMain = (): MainDb => ({
  schemaVersion: SCHEMA_VERSION,
  comments: [],
  identities: [],
  agentSettings: {},
});
const initArchive = (): ArchiveDb => ({ schemaVersion: SCHEMA_VERSION, comments: [] });

function isSettingsMap(v: unknown): v is ReviewAgentSettingsMap {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Sanitizes a document coming from storage (partial/old file): same role as a
// defensive readMain/readArchive.
function asMain(raw: unknown): MainDb {
  const p = (raw ?? {}) as Partial<MainDb>;
  return {
    schemaVersion: SCHEMA_VERSION,
    comments: Array.isArray(p.comments) ? p.comments : [],
    identities: Array.isArray(p.identities) ? p.identities : [],
    agentSettings: isSettingsMap(p.agentSettings) ? p.agentSettings : {},
  };
}
function asArchive(raw: unknown): ArchiveDb {
  const p = (raw ?? {}) as Partial<ArchiveDb>;
  return {
    schemaVersion: SCHEMA_VERSION,
    comments: Array.isArray(p.comments) ? p.comments : [],
  };
}

async function readMain(): Promise<MainDb> {
  const { data } = await docs.get(MAIN_KEY, initMain);
  return asMain(data);
}
async function readArchive(): Promise<ArchiveDb> {
  const { data } = await docs.get(ARCHIVE_KEY, initArchive);
  return asArchive(data);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
// Same format as the client-side helper ("Resolved by … on dd/mm/yyyy at …").
function formatResolutionSummary(actor: ReviewActor, at: number): string {
  const d = new Date(at);
  return `Resolved by ${actor.name} on ${pad2(d.getDate())}/${pad2(
    d.getMonth() + 1,
  )}/${d.getFullYear()} at ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(
    d.getSeconds(),
  )}.`;
}
function makeReplyId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `rep-${t}-${r}`;
}

// ── reads ────────────────────────────────────────────────────────────────────
export interface ListFilter {
  url?: string;
  status?: ReviewCommentStatus;
  origin?: ReviewCommentOrigin;
  flow?: string;
}
export async function listComments(filter?: ListFilter): Promise<ReviewComment[]> {
  const db = await readMain();
  return db.comments
    .filter((c) => {
      if (filter?.url && c.url !== filter.url) return false;
      if (filter?.status && c.status !== filter.status) return false;
      if (filter?.origin && (c.origin ?? "page") !== filter.origin) return false;
      if (filter?.flow && c.flowRef?.flow !== filter.flow) return false;
      return true;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export interface ArchiveFilter {
  url?: string;
  before?: number;
  limit?: number;
}
export interface ArchivePage {
  comments: ReviewComment[];
  nextCursor?: number;
}
export async function listArchive(filter?: ArchiveFilter): Promise<ArchivePage> {
  const db = await readArchive();
  const filtered = db.comments
    .filter((c) => {
      if (filter?.url && c.url !== filter.url) return false;
      if (filter?.before && c.updatedAt >= filter.before) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const limit = Math.max(1, Math.min(filter?.limit ?? 50, 200));
  const page = filtered.slice(0, limit);
  const nextCursor = filtered.length > limit ? page[page.length - 1]?.updatedAt : undefined;
  return { comments: page, nextCursor };
}

export async function getCommentAny(
  id: string,
): Promise<{ comment: ReviewComment; location: "main" | "archive" } | null> {
  const main = await readMain();
  const inMain = main.comments.find((c) => c.id === id);
  if (inMain) return { comment: inMain, location: "main" };
  const archive = await readArchive();
  const inArchive = archive.comments.find((c) => c.id === id);
  if (inArchive) return { comment: inArchive, location: "archive" };
  return null;
}

// ── writes (atomic RMW through the driver; mutates are re-runnable) ──────────
export async function upsertComment(comment: ReviewComment): Promise<void> {
  // Externalize OUTSIDE the mutate: image writes do not belong in a retry loop.
  const externalized = await externalizeComment(comment);
  await docs.update(MAIN_KEY, initMain, (raw) => {
    const db = asMain(raw);
    const idx = db.comments.findIndex((c) => c.id === externalized.id);
    if (idx === -1) db.comments.push(externalized);
    else db.comments[idx] = externalized;
    return { data: db, result: undefined };
  });
}

export async function deleteComment(id: string): Promise<boolean> {
  const removed = await docs.updatePair(
    { key: MAIN_KEY, init: initMain },
    { key: ARCHIVE_KEY, init: initArchive },
    (rawMain, rawArchive) => {
      const main = asMain(rawMain);
      const beforeMain = main.comments.length;
      main.comments = main.comments.filter((c) => c.id !== id);
      if (main.comments.length !== beforeMain) return { a: main, result: true };
      const archive = asArchive(rawArchive);
      const beforeArc = archive.comments.length;
      archive.comments = archive.comments.filter((c) => c.id !== id);
      if (archive.comments.length !== beforeArc) return { b: archive, result: true };
      return { result: false };
    },
  );
  return removed ?? false;
}

export interface TransitionResult {
  comment: ReviewComment;
  location: "main" | "archive";
}

export async function transitionToInReview(
  id: string,
  actor: ReviewActor,
): Promise<TransitionResult | null> {
  return docs.update(MAIN_KEY, initMain, (raw) => {
    const db = asMain(raw);
    const idx = db.comments.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const existing = db.comments[idx];
    if (!existing) return null;
    const at = Date.now();
    const updated: ReviewComment = {
      ...existing,
      status: "in_review",
      updatedAt: at,
      resolution: { actor, at, summary: formatResolutionSummary(actor, at) },
    };
    db.comments[idx] = updated;
    return { data: db, result: { comment: updated, location: "main" as const } };
  });
}

export async function approve(
  id: string,
  approver: { id: string; name: string },
): Promise<TransitionResult | null> {
  return docs.updatePair(
    { key: MAIN_KEY, init: initMain },
    { key: ARCHIVE_KEY, init: initArchive },
    (rawMain, rawArchive) => {
      const main = asMain(rawMain);
      const idx = main.comments.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      const existing = main.comments[idx];
      if (!existing) return null;
      const at = Date.now();
      const resolution = existing.resolution
        ? { ...existing.resolution, approvedAt: at, approvedBy: approver }
        : {
            actor: { kind: "user" as const, id: approver.id, name: approver.name },
            at,
            summary: formatResolutionSummary(
              { kind: "user", id: approver.id, name: approver.name },
              at,
            ),
            approvedAt: at,
            approvedBy: approver,
          };
      const updated: ReviewComment = { ...existing, status: "resolved", updatedAt: at, resolution };
      main.comments.splice(idx, 1);
      const archive = asArchive(rawArchive);
      const aIdx = archive.comments.findIndex((c) => c.id === id);
      if (aIdx === -1) archive.comments.push(updated);
      else archive.comments[aIdx] = updated;
      return { a: main, b: archive, result: { comment: updated, location: "archive" as const } };
    },
  );
}

export async function reject(id: string): Promise<TransitionResult | null> {
  return docs.update(MAIN_KEY, initMain, (raw) => {
    const db = asMain(raw);
    const idx = db.comments.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const existing = db.comments[idx];
    if (!existing) return null;
    const updated: ReviewComment = { ...existing, status: "open", updatedAt: Date.now() };
    delete updated.resolution;
    db.comments[idx] = updated;
    return { data: db, result: { comment: updated, location: "main" as const } };
  });
}

export async function archiveDirect(
  id: string,
  actor: ReviewActor,
): Promise<TransitionResult | null> {
  return docs.updatePair(
    { key: MAIN_KEY, init: initMain },
    { key: ARCHIVE_KEY, init: initArchive },
    (rawMain, rawArchive) => {
      const main = asMain(rawMain);
      const idx = main.comments.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      const existing = main.comments[idx];
      if (!existing) return null;
      const at = Date.now();
      const updated: ReviewComment = {
        ...existing,
        status: "resolved",
        updatedAt: at,
        resolution: {
          actor,
          at,
          summary: formatResolutionSummary(actor, at),
          approvedAt: at,
          approvedBy: { id: actor.id, name: actor.name },
        },
      };
      main.comments.splice(idx, 1);
      const archive = asArchive(rawArchive);
      const aIdx = archive.comments.findIndex((c) => c.id === id);
      if (aIdx === -1) archive.comments.push(updated);
      else archive.comments[aIdx] = updated;
      return { a: main, b: archive, result: { comment: updated, location: "archive" as const } };
    },
  );
}

export async function reopenFromArchive(id: string): Promise<TransitionResult | null> {
  return docs.updatePair(
    { key: MAIN_KEY, init: initMain },
    { key: ARCHIVE_KEY, init: initArchive },
    (rawMain, rawArchive) => {
      const archive = asArchive(rawArchive);
      const idx = archive.comments.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      const existing = archive.comments[idx];
      if (!existing) return null;
      const updated: ReviewComment = { ...existing, status: "open", updatedAt: Date.now() };
      delete updated.resolution;
      archive.comments.splice(idx, 1);
      const main = asMain(rawMain);
      const mIdx = main.comments.findIndex((c) => c.id === id);
      if (mIdx === -1) main.comments.push(updated);
      else main.comments[mIdx] = updated;
      return { a: main, b: archive, result: { comment: updated, location: "main" as const } };
    },
  );
}

export interface AddReplyInput {
  authorKind: "agent" | "user";
  authorId: string;
  authorName: string;
  authorColorToken?: string;
  /** E-mail of the authenticated session, when there is one. */
  authorEmail?: string;
  /** Session role (stamped by the route, never by the client). */
  authorRole?: "admin" | "reviewer";
  text: string;
  images?: string[];
}
export interface AddReplyResult {
  reply: ReviewReply;
  comment: ReviewComment;
  location: "main" | "archive";
}
export async function addReply(
  commentId: string,
  input: AddReplyInput,
): Promise<AddReplyResult | null> {
  const images = await externalizeImageList(input.images);
  return docs.updatePair<MainDb, ArchiveDb, AddReplyResult>(
    { key: MAIN_KEY, init: initMain },
    { key: ARCHIVE_KEY, init: initArchive },
    (rawMain, rawArchive) => {
      // id/createdAt are regenerated on a retry — harmless, only the winning
      // attempt is written.
      const reply: ReviewReply = {
        id: makeReplyId(),
        authorKind: input.authorKind,
        authorId: input.authorId,
        authorName: input.authorName,
        authorColorToken: input.authorColorToken ?? "var(--fg-tertiary)",
        ...(input.authorEmail ? { authorEmail: input.authorEmail } : {}),
        ...(input.authorRole ? { authorRole: input.authorRole } : {}),
        text: input.text,
        ...(images && images.length > 0 ? { images } : {}),
        createdAt: Date.now(),
      };
      const main = asMain(rawMain);
      const idx = main.comments.findIndex((c) => c.id === commentId);
      if (idx !== -1) {
        const existing = main.comments[idx]!;
        const replies = Array.isArray(existing.replies) ? [...existing.replies, reply] : [reply];
        const updated: ReviewComment = { ...existing, replies, updatedAt: reply.createdAt };
        main.comments[idx] = updated;
        return { a: main, result: { reply, comment: updated, location: "main" as const } };
      }
      const archive = asArchive(rawArchive);
      const aIdx = archive.comments.findIndex((c) => c.id === commentId);
      if (aIdx !== -1) {
        const existing = archive.comments[aIdx]!;
        const replies = Array.isArray(existing.replies) ? [...existing.replies, reply] : [reply];
        const updated: ReviewComment = { ...existing, replies, updatedAt: reply.createdAt };
        archive.comments[aIdx] = updated;
        return { b: archive, result: { reply, comment: updated, location: "archive" as const } };
      }
      return null;
    },
  );
}

export interface EditReplyInput {
  text: string;
  /** undefined → keeps the current images; array (even empty) → replaces. */
  images?: string[];
}
export interface EditReplyResult {
  reply: ReviewReply;
  comment: ReviewComment;
  location: "main" | "archive";
}
export async function editReply(
  commentId: string,
  replyId: string,
  input: EditReplyInput,
): Promise<EditReplyResult | null> {
  const images =
    input.images === undefined ? undefined : await externalizeImageList(input.images);
  return docs.updatePair<MainDb, ArchiveDb, EditReplyResult>(
    { key: MAIN_KEY, init: initMain },
    { key: ARCHIVE_KEY, init: initArchive },
    (rawMain, rawArchive) => {
      const patch = (list: ReviewComment[]): { reply: ReviewReply; comment: ReviewComment } | null => {
        const cIdx = list.findIndex((c) => c.id === commentId);
        if (cIdx === -1) return null;
        const comment = list[cIdx]!;
        const replies = Array.isArray(comment.replies) ? [...comment.replies] : [];
        const rIdx = replies.findIndex((r) => r.id === replyId);
        if (rIdx === -1) return null;
        const at = Date.now();
        const updatedReply: ReviewReply = { ...replies[rIdx]!, text: input.text, editedAt: at };
        if (input.images !== undefined) {
          if (images && images.length > 0) updatedReply.images = images;
          else delete updatedReply.images;
        }
        replies[rIdx] = updatedReply;
        const updatedComment: ReviewComment = { ...comment, replies, updatedAt: at };
        list[cIdx] = updatedComment;
        return { reply: updatedReply, comment: updatedComment };
      };
      const main = asMain(rawMain);
      const inMain = patch(main.comments);
      if (inMain) return { a: main, result: { ...inMain, location: "main" as const } };
      const archive = asArchive(rawArchive);
      const inArchive = patch(archive.comments);
      if (inArchive) return { b: archive, result: { ...inArchive, location: "archive" as const } };
      return null;
    },
  );
}

// Read-only — used by /reviewers and /members to list the people who reviewed
// from this checkout.
export async function listIdentities(): Promise<ReviewIdentity[]> {
  const db = await readMain();
  return db.identities;
}

export async function upsertIdentity(identity: ReviewIdentity): Promise<void> {
  await docs.update(MAIN_KEY, initMain, (raw) => {
    const db = asMain(raw);
    const idx = db.identities.findIndex((i) => i.id === identity.id);
    if (idx === -1) db.identities.push(identity);
    else db.identities[idx] = identity;
    return { data: db, result: undefined };
  });
}

// Removes an identity from the members list (admin housekeeping). Does not
// touch the comments already signed by it — historical authorship stays intact.
export async function deleteIdentity(id: string): Promise<boolean> {
  const removed = await docs.update(MAIN_KEY, initMain, (raw) => {
    const db = asMain(raw);
    const before = db.identities.length;
    db.identities = db.identities.filter((i) => i.id !== id);
    return { data: db, result: db.identities.length !== before };
  });
  return removed ?? false;
}

// ── per-agent settings (Live Response / Auto Construct) ──────────────────────
// Co-located in comments.json so the dispatcher reads comments + the
// permissions that gate them in a single load.
export async function getAgentSettings(): Promise<ReviewAgentSettingsMap> {
  const db = await readMain();
  return db.agentSettings;
}

export async function setAgentSettings(
  agentId: string,
  settings: ReviewAgentSettings,
): Promise<void> {
  await docs.update(MAIN_KEY, initMain, (raw) => {
    const db = asMain(raw);
    db.agentSettings = { ...db.agentSettings, [agentId]: settings };
    return { data: db, result: undefined };
  });
}

export async function exportAll(): Promise<ReviewExportPayload> {
  const main = await readMain();
  const archive = await readArchive();
  const exportedBy = main.identities[0] ?? {
    id: "server",
    name: "Server",
    colorToken: "var(--fg-tertiary)",
    createdAt: 0,
  };
  return {
    schemaVersion: SCHEMA_VERSION as 3,
    exportedAt: Date.now(),
    exportedBy,
    comments: main.comments,
    archivedComments: archive.comments,
  };
}

export async function importMerge(
  payload: ReviewExportPayload,
): Promise<{ added: number; skipped: number }> {
  // Externalize OUTSIDE the RMW: pre-compute the fresh candidates against a
  // snapshot of the ids; the mutate re-checks `seen` at write time — an id that
  // became a duplicate between the two phases is simply skipped.
  const snapshotSeen = new Set<string>();
  {
    const main = await readMain();
    const archive = await readArchive();
    for (const c of main.comments) snapshotSeen.add(c.id);
    for (const c of archive.comments) snapshotSeen.add(c.id);
  }
  const freshComments: ReviewComment[] = [];
  for (const c of payload.comments ?? []) {
    if (!snapshotSeen.has(c.id)) freshComments.push(await externalizeComment(c));
  }
  const freshArchived: ReviewComment[] = [];
  if (Array.isArray(payload.archivedComments)) {
    for (const c of payload.archivedComments) {
      if (!snapshotSeen.has(c.id)) freshArchived.push(await externalizeComment(c));
    }
  }
  const totalIncoming =
    (payload.comments?.length ?? 0) +
    (Array.isArray(payload.archivedComments) ? payload.archivedComments.length : 0);

  const merged = await docs.updatePair(
    { key: MAIN_KEY, init: initMain },
    { key: ARCHIVE_KEY, init: initArchive },
    (rawMain, rawArchive) => {
      const main = asMain(rawMain);
      const archive = asArchive(rawArchive);
      const seen = new Set([
        ...main.comments.map((c) => c.id),
        ...archive.comments.map((c) => c.id),
      ]);
      let added = 0;
      for (const c of freshComments) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        if (c.status === "resolved") archive.comments.push(c);
        else main.comments.push(c);
        added++;
      }
      for (const c of freshArchived) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        archive.comments.push(c);
        added++;
      }
      return { a: main, b: archive, result: { added, skipped: totalIncoming - added } };
    },
  );
  return merged ?? { added: 0, skipped: totalIncoming };
}

// Cheap signature for the client's polling: the mtime of the two files. It
// changes when the app OR a skill (solve/germano) writes.
export async function dataSignature(): Promise<string> {
  return docs.signature([MAIN_KEY, ARCHIVE_KEY]);
}
