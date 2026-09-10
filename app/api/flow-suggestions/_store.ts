import path from "node:path";
import { randomUUID } from "node:crypto";

import { createDocStore } from "@/lib/bridge-store";

import {
  canonicalFlowRevision,
  canonicalizeFlowSnapshot,
  hasCanonicalBase,
  hashFlowSnapshot,
  parseFlowMaterializationReceipt,
  type FlowActor,
  type FlowMaterializationReceiptInput,
  type FlowSnapshot,
} from "./_integrity";

export { hashFlowSnapshot } from "./_integrity";
export type { FlowActor, FlowMaterializationReceiptInput, FlowSnapshot } from "./_integrity";

/**
 * Serverless store for UX Flow suggestions. The UX-flow editor posts
 * suggestions here (same-origin, no token). Persistence goes through
 * lib/bridge-store: `flow-bridge/data/suggestions.json` + its archive, which is
 * what the resolve skill reads from disk — with atomic, serialized writes.
 *
 * Lifecycle:
 *   open ──in_review──► in_review ──apply──► applied   (→ archive)
 *    │                      │      ──discard─► discarded (→ archive)
 *    │                      └──reject──► open
 *    └──discard──► discarded (→ archive)
 *
 * A proposal only reaches `in_review` with a materialization receipt from the
 * agent (base revision + files + validations), and only gets applied while the
 * proposal it was materialized from is unchanged.
 */

export type FlowSuggestionStatus = "open" | "in_review" | "applied" | "discarded";

export type FlowResolution = { actor: FlowActor; at: number; summary: string };

export type FlowMaterializationReceipt = {
  actor: FlowActor;
  at: number;
  baseRevision: string;
  baseHash: string;
  files: string[];
  validations: string[];
  summary: string;
  /** Canonical hash of the proposed nodes/edges stamped by the server. */
  proposalHash?: string;
};

export type FlowSuggestion = {
  id: string;
  schemaVersion: 1 | 2;
  flow: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  authorName?: string;
  status: FlowSuggestionStatus;
  resolution?: FlowResolution;
  /** Absent only on legacy suggestions created before structural concurrency checks. */
  baseRevision?: string;
  /** Hash of the canonical nodes/edges the proposal was based on. */
  baseHash?: string;
  /** Present on new records; absent on legacy suggestions kept readable. */
  baseSnapshot?: FlowSnapshot;
  /** Written by the materializing agent; required before a human can accept. */
  materializationReceipt?: FlowMaterializationReceipt;
  nodes: unknown[];
  edges: unknown[];
};

export type Transition = "in_review" | "apply" | "discard" | "reject";

const SCHEMA_VERSION = 2;
const DATA_DIR = path.join(process.cwd(), "flow-bridge", "data");
const MAIN_FILE = path.join(DATA_DIR, "suggestions.json");
const ARCHIVE_FILE = path.join(DATA_DIR, "suggestions.archive.json");

const MAIN_KEY = "flows:suggestions";
const ARCHIVE_KEY = "flows:suggestions:archive";

type Db = { schemaVersion: number; suggestions: FlowSuggestion[] };

const docs = createDocStore({
  namespace: "flows",
  resolveFile: (key) => (key === ARCHIVE_KEY ? ARCHIVE_FILE : MAIN_FILE),
});

const initDb = (): Db => ({ schemaVersion: SCHEMA_VERSION, suggestions: [] });

function asDb(raw: unknown): Db {
  const p = (raw ?? {}) as Partial<Db>;
  return {
    schemaVersion: SCHEMA_VERSION,
    suggestions: Array.isArray(p.suggestions) ? p.suggestions : [],
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Same human-readable format the review bridge uses.
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
  const { data } = await docs.get(MAIN_KEY, initDb);
  const db = asDb(data);
  let out = db.suggestions;
  if (flow) out = out.filter((s) => s.flow === flow);
  if (status) out = out.filter((s) => s.status === status);
  return out.slice().sort((a, b) => b.createdAt - a.createdAt);
}

export async function createSuggestion(input: {
  flow: string;
  description: string;
  authorName?: string;
  baseNodes: unknown[];
  baseEdges: unknown[];
  nodes: unknown[];
  edges: unknown[];
}): Promise<FlowSuggestion> {
  const created = await docs.update(MAIN_KEY, initDb, (raw) => {
    const db = asDb(raw);
    const now = Date.now();
    const baseSnapshot = canonicalizeFlowSnapshot(input.baseNodes, input.baseEdges);
    const baseHash = hashFlowSnapshot(baseSnapshot.nodes, baseSnapshot.edges);
    const suggestion: FlowSuggestion = {
      id: randomUUID().slice(0, 8),
      schemaVersion: SCHEMA_VERSION,
      flow: input.flow,
      description: input.description,
      createdAt: now,
      updatedAt: now,
      authorName: input.authorName,
      status: "open",
      baseRevision: canonicalFlowRevision(input.flow, baseHash),
      baseHash,
      baseSnapshot,
      nodes: input.nodes,
      edges: input.edges,
    };
    db.suggestions.push(suggestion);
    return { data: db, result: suggestion };
  });
  return created!;
}

export async function transitionSuggestion(
  id: string,
  transition: Transition,
  actor?: FlowActor,
  receipt?: FlowMaterializationReceiptInput,
): Promise<FlowSuggestion | null> {
  const who: FlowActor = actor ?? { kind: "user", id: "user", name: "User" };

  if (transition === "in_review" || transition === "reject") {
    return docs.update(MAIN_KEY, initDb, (raw) => {
      const main = asDb(raw);
      const idx = main.suggestions.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      const suggestion = main.suggestions[idx];
      const at = Date.now();
      if (transition === "in_review") {
        if (suggestion.status !== "open") return { result: suggestion }; // no write
        if (!suggestion.baseRevision || !suggestion.baseHash) {
          throw new FlowTransitionError(
            "Legacy suggestion without a base revision. Recreate the proposal in the editor before materializing it.",
          );
        }
        if (!receipt) {
          throw new FlowTransitionError(
            "A materialization receipt is required to send the proposal to review.",
          );
        }
        if (
          suggestion.baseSnapshot &&
          !hasCanonicalBase({
            flow: suggestion.flow,
            baseRevision: suggestion.baseRevision,
            baseHash: suggestion.baseHash,
            baseSnapshot: suggestion.baseSnapshot,
          })
        ) {
          throw new FlowTransitionError(
            "The canonical base snapshot does not match the proposal's hash. Recreate the proposal in the editor.",
          );
        }
        const parsedReceipt = parseFlowMaterializationReceipt(receipt);
        if (!parsedReceipt) {
          throw new FlowTransitionError(
            "Invalid receipt. Provide the base revision, files, validations and a summary.",
          );
        }
        if (
          parsedReceipt.baseRevision !== suggestion.baseRevision ||
          parsedReceipt.baseHash !== suggestion.baseHash
        ) {
          throw new FlowTransitionError(
            "The receipt's base revision does not match the proposal. Rebuild it on top of the current flow.",
          );
        }
        suggestion.status = "in_review";
        suggestion.updatedAt = at;
        suggestion.resolution = { actor: who, at, summary: summarize(who, at, "claimed") };
        suggestion.materializationReceipt = {
          ...parsedReceipt,
          actor: who,
          at,
          proposalHash: hashFlowSnapshot(suggestion.nodes, suggestion.edges),
        };
        return { data: main, result: suggestion };
      }
      // reject
      if (suggestion.status !== "in_review") return { result: suggestion }; // no write
      suggestion.status = "open";
      suggestion.updatedAt = at;
      delete suggestion.resolution;
      delete suggestion.materializationReceipt;
      return { data: main, result: suggestion };
    });
  }

  // apply | discard → stamp + move to the archive doc
  return docs.updatePair(
    { key: MAIN_KEY, init: initDb },
    { key: ARCHIVE_KEY, init: initDb },
    (rawMain, rawArchive) => {
      const main = asDb(rawMain);
      const idx = main.suggestions.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      const suggestion = main.suggestions[idx];
      const at = Date.now();
      if (transition === "apply") {
        if (suggestion.status !== "in_review") {
          throw new FlowTransitionError(
            "The proposal must be materialized and in review before it can be accepted.",
          );
        }
        if (!suggestion.materializationReceipt) {
          throw new FlowTransitionError(
            "A proposal without a materialization receipt cannot be accepted.",
          );
        }
        if (
          suggestion.materializationReceipt.proposalHash &&
          suggestion.materializationReceipt.proposalHash !==
            hashFlowSnapshot(suggestion.nodes, suggestion.edges)
        ) {
          throw new FlowTransitionError(
            "The structural proposal changed after materialization. Reopen it and materialize again.",
          );
        }
      }
      const finalStatus: FlowSuggestionStatus =
        transition === "apply" ? "applied" : "discarded";
      suggestion.status = finalStatus;
      suggestion.updatedAt = at;
      suggestion.resolution = { actor: who, at, summary: summarize(who, at, finalStatus) };
      main.suggestions.splice(idx, 1);

      const archive = asDb(rawArchive);
      const archiveIdx = archive.suggestions.findIndex((s) => s.id === id);
      if (archiveIdx === -1) archive.suggestions.push(suggestion);
      else archive.suggestions[archiveIdx] = suggestion;

      return { a: main, b: archive, result: suggestion };
    },
  );
}

export class FlowTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlowTransitionError";
  }
}

export async function deleteSuggestion(id: string): Promise<boolean> {
  const removed = await docs.updatePair(
    { key: MAIN_KEY, init: initDb },
    { key: ARCHIVE_KEY, init: initDb },
    (rawMain, rawArchive) => {
      const main = asDb(rawMain);
      const mainIdx = main.suggestions.findIndex((s) => s.id === id);
      if (mainIdx !== -1) {
        main.suggestions.splice(mainIdx, 1);
        return { a: main, result: true };
      }
      const archive = asDb(rawArchive);
      const archiveIdx = archive.suggestions.findIndex((s) => s.id === id);
      if (archiveIdx !== -1) {
        archive.suggestions.splice(archiveIdx, 1);
        return { b: archive, result: true };
      }
      return { result: false };
    },
  );
  return removed ?? false;
}
