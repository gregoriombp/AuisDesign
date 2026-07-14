import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

/**
 * Serverless replacement for the standalone flow-bridge Express server. The
 * UX-flow editor posts suggestions here (same-origin, no token), and this
 * module persists them to the SAME JSON files the old flow-bridge used
 * (`flow-bridge/data/*.json`) so the resolve skill keeps reading them.
 *
 * Lifecycle mirrors flow-bridge/src/store.ts:
 *   open ──in_review──► in_review ──apply──► applied   (→ archive)
 *    │                      │      ──discard─► discarded (→ archive)
 *    │                      └──reject──► open
 *    └──discard──► discarded (→ archive)
 */

export type FlowSuggestionStatus = "open" | "in_review" | "applied" | "discarded";

export type FlowActor = { kind: "agent" | "user"; id: string; name: string };

export type FlowResolution = { actor: FlowActor; at: number; summary: string };

export type FlowSuggestion = {
  id: string;
  schemaVersion: 1;
  flow: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  authorName?: string;
  status: FlowSuggestionStatus;
  resolution?: FlowResolution;
  nodes: unknown[];
  edges: unknown[];
};

export type Transition = "in_review" | "apply" | "discard" | "reject";

const SCHEMA_VERSION = 1;
const DATA_DIR = path.join(process.cwd(), "flow-bridge", "data");
const MAIN_FILE = path.join(DATA_DIR, "suggestions.json");
const ARCHIVE_FILE = path.join(DATA_DIR, "suggestions.archive.json");

type Db = { schemaVersion: number; suggestions: FlowSuggestion[] };

async function readDb(file: string): Promise<Db> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<Db>;
    return {
      schemaVersion: SCHEMA_VERSION,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch {
    // Missing/corrupt file → start empty (the dir is created on first write).
    return { schemaVersion: SCHEMA_VERSION, suggestions: [] };
  }
}

async function writeDb(file: string, db: Db): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(db, null, 2), "utf8");
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Same human-readable format the review-bridge / flow-bridge already use.
function summarize(
  actor: FlowActor,
  at: number,
  kind: "applied" | "discarded" | "claimed",
): string {
  const verb =
    kind === "applied" ? "Applied" : kind === "discarded" ? "Discarded" : "In review";
  const d = new Date(at);
  const stamp = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} at ${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return `${verb} by ${actor.name} on ${stamp}.`;
}

export async function listSuggestions(
  flow?: string,
  status?: FlowSuggestionStatus,
): Promise<FlowSuggestion[]> {
  const db = await readDb(MAIN_FILE);
  let out = db.suggestions;
  if (flow) out = out.filter((s) => s.flow === flow);
  if (status) out = out.filter((s) => s.status === status);
  return out.slice().sort((a, b) => b.createdAt - a.createdAt);
}

export async function createSuggestion(input: {
  flow: string;
  description: string;
  authorName?: string;
  nodes: unknown[];
  edges: unknown[];
}): Promise<FlowSuggestion> {
  const db = await readDb(MAIN_FILE);
  const now = Date.now();
  const suggestion: FlowSuggestion = {
    id: randomUUID().slice(0, 8),
    schemaVersion: SCHEMA_VERSION,
    flow: input.flow,
    description: input.description,
    createdAt: now,
    updatedAt: now,
    authorName: input.authorName,
    status: "open",
    nodes: input.nodes,
    edges: input.edges,
  };
  db.suggestions.push(suggestion);
  await writeDb(MAIN_FILE, db);
  return suggestion;
}

export async function transitionSuggestion(
  id: string,
  transition: Transition,
  actor?: FlowActor,
): Promise<FlowSuggestion | null> {
  const main = await readDb(MAIN_FILE);
  const idx = main.suggestions.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const suggestion = main.suggestions[idx];
  const at = Date.now();
  const who: FlowActor = actor ?? { kind: "user", id: "user", name: "User" };

  if (transition === "in_review") {
    if (suggestion.status === "open") {
      suggestion.status = "in_review";
      suggestion.updatedAt = at;
      suggestion.resolution = { actor: who, at, summary: summarize(who, at, "claimed") };
      await writeDb(MAIN_FILE, main);
    }
    return suggestion;
  }

  if (transition === "reject") {
    if (suggestion.status === "in_review") {
      suggestion.status = "open";
      suggestion.updatedAt = at;
      delete suggestion.resolution;
      await writeDb(MAIN_FILE, main);
    }
    return suggestion;
  }

  // apply | discard → stamp + move to the archive file
  const finalStatus: FlowSuggestionStatus = transition === "apply" ? "applied" : "discarded";
  suggestion.status = finalStatus;
  suggestion.updatedAt = at;
  suggestion.resolution = { actor: who, at, summary: summarize(who, at, finalStatus) };
  main.suggestions.splice(idx, 1);

  const archive = await readDb(ARCHIVE_FILE);
  const archiveIdx = archive.suggestions.findIndex((s) => s.id === id);
  if (archiveIdx === -1) archive.suggestions.push(suggestion);
  else archive.suggestions[archiveIdx] = suggestion;

  await writeDb(MAIN_FILE, main);
  await writeDb(ARCHIVE_FILE, archive);
  return suggestion;
}

export async function deleteSuggestion(id: string): Promise<boolean> {
  const main = await readDb(MAIN_FILE);
  const mainIdx = main.suggestions.findIndex((s) => s.id === id);
  if (mainIdx !== -1) {
    main.suggestions.splice(mainIdx, 1);
    await writeDb(MAIN_FILE, main);
    return true;
  }
  const archive = await readDb(ARCHIVE_FILE);
  const archiveIdx = archive.suggestions.findIndex((s) => s.id === id);
  if (archiveIdx !== -1) {
    archive.suggestions.splice(archiveIdx, 1);
    await writeDb(ARCHIVE_FILE, archive);
    return true;
  }
  return false;
}
