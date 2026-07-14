import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

/**
 * Request queue for the per-screen actions in /auis/projects — "Restyle with
 * the design system" (kind "restyle") and "Build in repo" (kind "build"). Same
 * serverless mechanics as flow-suggestions/_store.ts: writes to a JSON file
 * (flow-bridge/data/project-builds.json) that the `auis-project-build-solve`
 * skill reads later to fulfil the requests.
 *
 * Lifecycle (same as flow-suggestions):
 *   open ──in_review──► in_review ──apply──► applied   (→ archive, sets builtRoute)
 *    │                      │      ──discard─► discarded (→ archive)
 *    │                      └──reject──► open
 *    └──discard──► discarded (→ archive)
 *
 * Important: this store is the QUEUE. The durable state of each screen (status /
 * builtRoute) lives in the TS manifest (app/auis/projects/_data/projects.ts) and
 * is written by the skill on apply — not by this API.
 */

export type ProjectBuildStatus = "open" | "in_review" | "applied" | "discarded";

export type BuildKind = "restyle" | "build";

export type BuildActor = { kind: "agent" | "user"; id: string; name: string };

export type BuildResolution = { actor: BuildActor; at: number; summary: string };

export type ProjectBuild = {
  id: string;
  schemaVersion: 1;
  projectSlug: string;
  screenId: string;
  screenName: string;
  kind: BuildKind;
  figmaFileKey: string;
  figmaNodeId: string;
  thumbnail: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
  status: ProjectBuildStatus;
  resolution?: BuildResolution;
  /** Set when a "build" is applied — the route of the generated page. */
  builtRoute?: string;
};

export type Transition = "in_review" | "apply" | "discard" | "reject";

const SCHEMA_VERSION = 1;
const DATA_DIR = path.join(process.cwd(), "flow-bridge", "data");
const MAIN_FILE = path.join(DATA_DIR, "project-builds.json");
const ARCHIVE_FILE = path.join(DATA_DIR, "project-builds.archive.json");

type Db = { schemaVersion: number; builds: ProjectBuild[] };

async function readDb(file: string): Promise<Db> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<Db>;
    return {
      schemaVersion: SCHEMA_VERSION,
      builds: Array.isArray(parsed.builds) ? parsed.builds : [],
    };
  } catch {
    return { schemaVersion: SCHEMA_VERSION, builds: [] };
  }
}

async function writeDb(file: string, db: Db): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(db, null, 2), "utf8");
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Same human-readable stamp the review-bridge / flow-bridge use.
function summarize(
  actor: BuildActor,
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

export type BuildFilter = {
  projectSlug?: string;
  screenId?: string;
  kind?: BuildKind;
  status?: ProjectBuildStatus;
};

export async function listBuilds(filter: BuildFilter = {}): Promise<ProjectBuild[]> {
  const db = await readDb(MAIN_FILE);
  let out = db.builds;
  if (filter.projectSlug) out = out.filter((b) => b.projectSlug === filter.projectSlug);
  if (filter.screenId) out = out.filter((b) => b.screenId === filter.screenId);
  if (filter.kind) out = out.filter((b) => b.kind === filter.kind);
  if (filter.status) out = out.filter((b) => b.status === filter.status);
  return out.slice().sort((a, b) => b.createdAt - a.createdAt);
}

export async function createBuild(input: {
  projectSlug: string;
  screenId: string;
  screenName: string;
  kind: BuildKind;
  figmaFileKey: string;
  figmaNodeId: string;
  thumbnail: string;
  note?: string;
}): Promise<ProjectBuild> {
  const db = await readDb(MAIN_FILE);
  const now = Date.now();
  const build: ProjectBuild = {
    id: randomUUID().slice(0, 8),
    schemaVersion: SCHEMA_VERSION,
    projectSlug: input.projectSlug,
    screenId: input.screenId,
    screenName: input.screenName,
    kind: input.kind,
    figmaFileKey: input.figmaFileKey,
    figmaNodeId: input.figmaNodeId,
    thumbnail: input.thumbnail,
    note: input.note,
    createdAt: now,
    updatedAt: now,
    status: "open",
  };
  db.builds.push(build);
  await writeDb(MAIN_FILE, db);
  return build;
}

export async function transitionBuild(
  id: string,
  transition: Transition,
  actor?: BuildActor,
  builtRoute?: string,
): Promise<ProjectBuild | null> {
  const main = await readDb(MAIN_FILE);
  const idx = main.builds.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  const build = main.builds[idx];
  const at = Date.now();
  const who: BuildActor = actor ?? { kind: "user", id: "user", name: "User" };

  if (transition === "in_review") {
    if (build.status === "open") {
      build.status = "in_review";
      build.updatedAt = at;
      build.resolution = { actor: who, at, summary: summarize(who, at, "claimed") };
      await writeDb(MAIN_FILE, main);
    }
    return build;
  }

  if (transition === "reject") {
    if (build.status === "in_review") {
      build.status = "open";
      build.updatedAt = at;
      delete build.resolution;
      await writeDb(MAIN_FILE, main);
    }
    return build;
  }

  // apply | discard → stamp + move to the archive file
  const finalStatus: ProjectBuildStatus = transition === "apply" ? "applied" : "discarded";
  build.status = finalStatus;
  build.updatedAt = at;
  if (transition === "apply" && builtRoute) build.builtRoute = builtRoute;
  build.resolution = { actor: who, at, summary: summarize(who, at, finalStatus) };
  main.builds.splice(idx, 1);

  const archive = await readDb(ARCHIVE_FILE);
  const archiveIdx = archive.builds.findIndex((b) => b.id === id);
  if (archiveIdx === -1) archive.builds.push(build);
  else archive.builds[archiveIdx] = build;

  await writeDb(MAIN_FILE, main);
  await writeDb(ARCHIVE_FILE, archive);
  return build;
}

export async function deleteBuild(id: string): Promise<boolean> {
  const main = await readDb(MAIN_FILE);
  const mainIdx = main.builds.findIndex((b) => b.id === id);
  if (mainIdx !== -1) {
    main.builds.splice(mainIdx, 1);
    await writeDb(MAIN_FILE, main);
    return true;
  }
  const archive = await readDb(ARCHIVE_FILE);
  const archiveIdx = archive.builds.findIndex((b) => b.id === id);
  if (archiveIdx !== -1) {
    archive.builds.splice(archiveIdx, 1);
    await writeDb(ARCHIVE_FILE, archive);
    return true;
  }
  return false;
}
