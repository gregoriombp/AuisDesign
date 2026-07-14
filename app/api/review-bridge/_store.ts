import path from "node:path";
import fs from "node:fs/promises";

import type {
  ReviewActor,
  ReviewAgentSettings,
  ReviewAgentSettingsMap,
  ReviewComment,
  ReviewCommentStatus,
  ReviewExportPayload,
  ReviewIdentity,
  ReviewReply,
} from "@/components/auis-review/types";

/**
 * Serverless replacement for the standalone review-bridge Express server
 * (review-bridge/src/{index,store}.ts). Review Mode posts here (same-origin, no
 * token) and this module persists to the SAME JSON files the old bridge used —
 * review-bridge/data/comments.json (+ .archive.json) — so the existing data and
 * the resolve/germano skills keep working, and `npm run dev` no longer needs a
 * second process. Mirrors the flow-suggestions / page-edits serverless stores:
 * atomic tmp+rename writes and ONE read-modify-write lock so burst POSTs (and
 * the two-file approve/reopen ops) never lose updates.
 */

const SCHEMA_VERSION = 3;
const DATA_DIR = path.join(process.cwd(), "review-bridge", "data");
const MAIN_FILE = path.join(DATA_DIR, "comments.json");
const ARCHIVE_FILE = path.join(DATA_DIR, "comments.archive.json");

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

async function readMain(): Promise<MainDb> {
  try {
    const raw = await fs.readFile(MAIN_FILE, "utf8");
    const p = JSON.parse(raw) as Partial<MainDb>;
    return {
      schemaVersion: SCHEMA_VERSION,
      comments: Array.isArray(p.comments) ? p.comments : [],
      identities: Array.isArray(p.identities) ? p.identities : [],
      agentSettings: isSettingsMap(p.agentSettings) ? p.agentSettings : {},
    };
  } catch {
    return { schemaVersion: SCHEMA_VERSION, comments: [], identities: [], agentSettings: {} };
  }
}

function isSettingsMap(v: unknown): v is ReviewAgentSettingsMap {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
async function readArchive(): Promise<ArchiveDb> {
  try {
    const raw = await fs.readFile(ARCHIVE_FILE, "utf8");
    const p = JSON.parse(raw) as Partial<ArchiveDb>;
    return {
      schemaVersion: SCHEMA_VERSION,
      comments: Array.isArray(p.comments) ? p.comments : [],
    };
  } catch {
    return { schemaVersion: SCHEMA_VERSION, comments: [] };
  }
}

async function writeFileAtomic(file: string, data: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // tmp + rename: a crash mid-write never leaves truncated JSON (readers see
  // all-or-nothing). null,2 keeps the same pretty-print lowdb used to write.
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}
const writeMain = (db: MainDb) => writeFileAtomic(MAIN_FILE, db);
const writeArchive = (db: ArchiveDb) => writeFileAtomic(ARCHIVE_FILE, db);

// It's a single process (the dev server), but the UI fires writes in bursts and
// several ops touch both files (main+archive) — without serializing, two
// concurrent read-modify-writes lose updates. One global lock chains every
// write; reads are lock-free (always fresh from disk).
let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => {});
  return run;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
// Same format the review-bridge / flow-bridge use ("Resolved by … on DD/MM/YYYY …").
// Byte-identical to components/auis-review/storage/utils.ts and
// review-bridge/src/types.ts — the three code paths write the SAME string.
function formatResolutionSummary(actor: ReviewActor, at: number): string {
  const d = new Date(at);
  const day = pad2(d.getDate());
  const month = pad2(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  const seconds = pad2(d.getSeconds());
  return `Resolved by ${actor.name} on ${day}/${month}/${year} at ${hours}:${minutes}:${seconds}.`;
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
}
export async function listComments(filter?: ListFilter): Promise<ReviewComment[]> {
  const db = await readMain();
  return db.comments
    .filter((c) => {
      if (filter?.url && c.url !== filter.url) return false;
      if (filter?.status && c.status !== filter.status) return false;
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

// ── writes (under the lock) ──────────────────────────────────────────────────
export async function upsertComment(comment: ReviewComment): Promise<void> {
  return withLock(async () => {
    const db = await readMain();
    const idx = db.comments.findIndex((c) => c.id === comment.id);
    if (idx === -1) db.comments.push(comment);
    else db.comments[idx] = comment;
    await writeMain(db);
  });
}

export async function deleteComment(id: string): Promise<boolean> {
  return withLock(async () => {
    const main = await readMain();
    const beforeMain = main.comments.length;
    main.comments = main.comments.filter((c) => c.id !== id);
    if (main.comments.length !== beforeMain) {
      await writeMain(main);
      return true;
    }
    const archive = await readArchive();
    const beforeArc = archive.comments.length;
    archive.comments = archive.comments.filter((c) => c.id !== id);
    if (archive.comments.length !== beforeArc) {
      await writeArchive(archive);
      return true;
    }
    return false;
  });
}

export interface TransitionResult {
  comment: ReviewComment;
  location: "main" | "archive";
}

export async function transitionToInReview(
  id: string,
  actor: ReviewActor,
): Promise<TransitionResult | null> {
  return withLock(async () => {
    const db = await readMain();
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
    await writeMain(db);
    return { comment: updated, location: "main" };
  });
}

export async function approve(
  id: string,
  approver: { id: string; name: string },
): Promise<TransitionResult | null> {
  return withLock(async () => {
    const main = await readMain();
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
    const archive = await readArchive();
    const aIdx = archive.comments.findIndex((c) => c.id === id);
    if (aIdx === -1) archive.comments.push(updated);
    else archive.comments[aIdx] = updated;
    await writeMain(main);
    await writeArchive(archive);
    return { comment: updated, location: "archive" };
  });
}

export async function reject(id: string): Promise<TransitionResult | null> {
  return withLock(async () => {
    const db = await readMain();
    const idx = db.comments.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const existing = db.comments[idx];
    if (!existing) return null;
    const updated: ReviewComment = { ...existing, status: "open", updatedAt: Date.now() };
    delete updated.resolution;
    db.comments[idx] = updated;
    await writeMain(db);
    return { comment: updated, location: "main" };
  });
}

export async function archiveDirect(
  id: string,
  actor: ReviewActor,
): Promise<TransitionResult | null> {
  return withLock(async () => {
    const main = await readMain();
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
    const archive = await readArchive();
    const aIdx = archive.comments.findIndex((c) => c.id === id);
    if (aIdx === -1) archive.comments.push(updated);
    else archive.comments[aIdx] = updated;
    await writeMain(main);
    await writeArchive(archive);
    return { comment: updated, location: "archive" };
  });
}

export async function reopenFromArchive(id: string): Promise<TransitionResult | null> {
  return withLock(async () => {
    const archive = await readArchive();
    const idx = archive.comments.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const existing = archive.comments[idx];
    if (!existing) return null;
    const updated: ReviewComment = { ...existing, status: "open", updatedAt: Date.now() };
    delete updated.resolution;
    archive.comments.splice(idx, 1);
    const main = await readMain();
    const mIdx = main.comments.findIndex((c) => c.id === id);
    if (mIdx === -1) main.comments.push(updated);
    else main.comments[mIdx] = updated;
    await writeArchive(archive);
    await writeMain(main);
    return { comment: updated, location: "main" };
  });
}

export interface AddReplyInput {
  authorKind: "agent" | "user";
  authorId: string;
  authorName: string;
  authorColorToken?: string;
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
  return withLock(async () => {
    const reply: ReviewReply = {
      id: makeReplyId(),
      authorKind: input.authorKind,
      authorId: input.authorId,
      authorName: input.authorName,
      authorColorToken: input.authorColorToken ?? "var(--fg-tertiary)",
      text: input.text,
      ...(input.images && input.images.length > 0 ? { images: input.images } : {}),
      createdAt: Date.now(),
    };
    const main = await readMain();
    const idx = main.comments.findIndex((c) => c.id === commentId);
    if (idx !== -1) {
      const existing = main.comments[idx]!;
      const replies = Array.isArray(existing.replies) ? [...existing.replies, reply] : [reply];
      const updated: ReviewComment = { ...existing, replies, updatedAt: reply.createdAt };
      main.comments[idx] = updated;
      await writeMain(main);
      return { reply, comment: updated, location: "main" };
    }
    const archive = await readArchive();
    const aIdx = archive.comments.findIndex((c) => c.id === commentId);
    if (aIdx !== -1) {
      const existing = archive.comments[aIdx]!;
      const replies = Array.isArray(existing.replies) ? [...existing.replies, reply] : [reply];
      const updated: ReviewComment = { ...existing, replies, updatedAt: reply.createdAt };
      archive.comments[aIdx] = updated;
      await writeArchive(archive);
      return { reply, comment: updated, location: "archive" };
    }
    return null;
  });
}

export async function upsertIdentity(identity: ReviewIdentity): Promise<void> {
  return withLock(async () => {
    const db = await readMain();
    const idx = db.identities.findIndex((i) => i.id === identity.id);
    if (idx === -1) db.identities.push(identity);
    else db.identities[idx] = identity;
    await writeMain(db);
  });
}

// ── per-agent settings (Live Response / Auto Construct) ──────────────────────
// Co-located in comments.json so the /loop dispatcher reads comments + the
// permissions that gate them in a single load.
export async function getAgentSettings(): Promise<ReviewAgentSettingsMap> {
  const db = await readMain();
  return db.agentSettings;
}

export async function setAgentSettings(
  agentId: string,
  settings: ReviewAgentSettings,
): Promise<void> {
  return withLock(async () => {
    const db = await readMain();
    db.agentSettings = { ...db.agentSettings, [agentId]: settings };
    await writeMain(db);
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
  return withLock(async () => {
    const main = await readMain();
    const archive = await readArchive();
    const seen = new Set([
      ...main.comments.map((c) => c.id),
      ...archive.comments.map((c) => c.id),
    ]);
    let added = 0;
    let skipped = 0;
    for (const c of payload.comments ?? []) {
      if (seen.has(c.id)) {
        skipped++;
        continue;
      }
      seen.add(c.id);
      if (c.status === "resolved") archive.comments.push(c);
      else main.comments.push(c);
      added++;
    }
    if (Array.isArray(payload.archivedComments)) {
      for (const c of payload.archivedComments) {
        if (seen.has(c.id)) {
          skipped++;
          continue;
        }
        seen.add(c.id);
        archive.comments.push(c);
        added++;
      }
    }
    await writeMain(main);
    await writeArchive(archive);
    return { added, skipped };
  });
}

// Cheap signature for client polling (replaces the Express server's SSE): the
// mtime of both files. It changes when the app OR a skill (solve/germano) writes.
export async function dataSignature(): Promise<string> {
  const stat = async (f: string) => {
    try {
      const s = await fs.stat(f);
      return Math.floor(s.mtimeMs);
    } catch {
      return 0;
    }
  };
  const [m, a] = await Promise.all([stat(MAIN_FILE), stat(ARCHIVE_FILE)]);
  return `${m}:${a}`;
}
