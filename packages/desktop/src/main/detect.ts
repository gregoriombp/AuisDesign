// What a folder is, as far as running it goes: which kind of project, which
// package manager installed it, whether it can start, and which Node it asks
// for. Everything here is read from the folder; nothing is written.
//
// This module does not import `electron`, so it runs under `node --test`.

import fs from "node:fs";
import path from "node:path";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/**
 * Named by what the project has, because that is what the app acts on:
 *
 * - `auis`: the Auis surfaces are in the project (`/auis`, the styleguide…),
 *   so the window opens on the hub and offers their shortcuts.
 * - `auis-review`: the Review kit was installed into a host app (`auis init`).
 *   The app's own pages, with Review on top; there is no hub to open.
 * - `next`: a Next app without Auis.
 * - `other`: anything else with a `dev` script.
 */
export type ProjectKind = "auis" | "auis-review" | "next" | "other";

export interface ProjectInfo {
  kind: ProjectKind;
  packageManager: PackageManager;
  hasDevScript: boolean;
  depsInstalled: boolean;
  /** `engines.node` from package.json, when the project declares one. */
  nodeRange: string | null;
}

interface Manifest {
  scripts?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  engines?: { node?: unknown };
}

function readManifest(root: string): Manifest | null {
  try {
    const data: unknown = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    return typeof data === "object" && data !== null ? (data as Manifest) : null;
  } catch {
    return null;
  }
}

/** The lockfile says which package manager the project is installed with. */
export function packageManagerOf(root: string): PackageManager {
  const has = (file: string) => fs.existsSync(path.join(root, file));
  if (has("pnpm-lock.yaml")) return "pnpm";
  if (has("yarn.lock")) return "yarn";
  if (has("bun.lock") || has("bun.lockb")) return "bun";
  return "npm";
}

function kindOf(root: string, manifest: Manifest): ProjectKind {
  const has = (...parts: string[]) => fs.existsSync(path.join(root, ...parts));
  if (has("app", "auis") || has("src", "app", "auis")) return "auis";
  if (has(".auis", "manifest.json")) return "auis-review";
  if (manifest.dependencies?.next !== undefined || manifest.devDependencies?.next !== undefined) {
    return "next";
  }
  return "other";
}

/** Null when the folder has no readable package.json: it is not a project. */
export function detectProject(root: string): ProjectInfo | null {
  const manifest = readManifest(root);
  if (!manifest) return null;
  const range = manifest.engines?.node;
  return {
    kind: kindOf(root, manifest),
    packageManager: packageManagerOf(root),
    hasDevScript: typeof manifest.scripts?.dev === "string" && manifest.scripts.dev.trim() !== "",
    // Yarn Plug'n'Play installs without a node_modules folder.
    depsInstalled:
      fs.existsSync(path.join(root, "node_modules")) || fs.existsSync(path.join(root, ".pnp.cjs")),
    nodeRange: typeof range === "string" && range.trim() !== "" ? range.trim() : null,
  };
}

/** Why a folder is not a project the app can run, in words for the person who picked it, or null. */
export function whyNotRunnable(root: string): string | null {
  if (!fs.existsSync(root)) return "This folder no longer exists. It may have been moved or deleted.";
  const info = detectProject(root);
  if (!info) return "This folder has no package.json, so there is no project to run.";
  if (!info.hasDevScript) return "This project has no dev script in its package.json.";
  return null;
}

// ── Node version ranges ───────────────────────────────────────────────────

type Triple = [number, number, number];

function parseTriple(text: string): Triple | null {
  const match = text.trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function compare(a: Triple, b: Triple): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** One comparator against a version: true, false, or null when it is not understood. */
function testComparator(version: Triple, token: string): boolean | null {
  if (token === "*" || token.toLowerCase() === "x") return true;
  const match = token.match(/^(>=|<=|>|<|=|\^|~)?v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/i);
  if (!match) return null;

  const op = match[1] ?? "";
  const major = Number(match[2]);
  const minorOpen = match[3] === undefined || /^[x*]$/i.test(match[3]);
  const patchOpen = minorOpen || match[4] === undefined || /^[x*]$/i.test(match[4]);
  const minor = minorOpen ? 0 : Number(match[3]);
  const patch = patchOpen ? 0 : Number(match[4]);

  const floor: Triple = [major, minor, patch];
  // Where a partial version stops: `20` covers up to 21.0.0, `20.9` up to 20.10.0.
  const partialEnd: Triple | null = minorOpen
    ? [major + 1, 0, 0]
    : patchOpen
      ? [major, minor + 1, 0]
      : null;
  const within = (end: Triple) => compare(version, floor) >= 0 && compare(version, end) < 0;

  switch (op) {
    case ">=":
      return compare(version, floor) >= 0;
    case ">":
      return partialEnd ? compare(version, partialEnd) >= 0 : compare(version, floor) > 0;
    case "<":
      return compare(version, floor) < 0;
    case "<=":
      return partialEnd ? compare(version, partialEnd) < 0 : compare(version, floor) <= 0;
    case "^":
      // Below 1.0 a caret means something narrower; no Node range needs it.
      return major === 0 ? null : within([major + 1, 0, 0]);
    case "~":
      return within(minorOpen ? [major + 1, 0, 0] : [major, minor + 1, 0]);
    default:
      return partialEnd ? within(partialEnd) : compare(version, floor) === 0;
  }
}

/**
 * Whether a Node version satisfies an `engines.node` range. It reads the
 * forms projects actually write (`>=20.9`, `^20 || ^22`, `>=20 <23`, `22.x`).
 * Anything it does not understand counts as satisfied: this check exists to
 * explain a real mismatch, and must never block a project over a range it
 * could not read.
 */
export function nodeSatisfies(version: string, range: string): boolean {
  const triple = parseTriple(version);
  if (!triple) return true;

  let understood = true;
  const satisfied = range.split("||").some((alternative) => {
    // `>= 20` is one comparator, not two.
    const tokens = alternative
      .replace(/(>=|<=|>|<|=|\^|~)\s+/g, "$1")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    // Every comparator is read, even after one fails: an unreadable one later
    // in the list still means the range was not understood.
    const results = tokens.map((token) => testComparator(triple, token));
    if (results.includes(null)) understood = false;
    return results.every((result) => result ?? true);
  });
  return satisfied || !understood;
}
