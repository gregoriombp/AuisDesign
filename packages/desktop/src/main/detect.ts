// Read project facts without executing its config. Safe to use from Node tests.
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import semver from "semver";
import { findOnPath, type Env } from "./env.ts";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export type ProjectKind = "scaffold" | "host" | "next";
type Manifest = Record<string, unknown> & {
  scripts?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: { node?: unknown };
  packageManager?: unknown;
};

function readManifest(root: string): Manifest | null {
  try {
    const value: unknown = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    );
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Manifest)
      : null;
  } catch {
    return null;
  }
}

export function manifestProblem(root: string): string | null {
  const manifest = readManifest(root);
  if (!manifest)
    return "This folder has no readable package.json. Choose a project folder.";
  if (
    typeof manifest.scripts?.dev !== "string" ||
    !manifest.scripts.dev.trim()
  ) {
    return "This project has no dev script in its package.json.";
  }
  return null;
}

export function packageManagerOf(root: string): PackageManager {
  const declared = readManifest(root)?.packageManager;
  const name = typeof declared === "string" ? declared.split("@")[0] : "";
  if (["npm", "pnpm", "yarn", "bun"].includes(name))
    return name as PackageManager;
  if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(root, "yarn.lock"))) return "yarn";
  if (
    ["bun.lock", "bun.lockb"].some((file) =>
      fs.existsSync(path.join(root, file)),
    )
  )
    return "bun";
  return "npm";
}

export interface ProjectInfo {
  kind: ProjectKind;
  hasAuis: boolean;
  packageManager: PackageManager;
  nodeRange: string;
  missingDependencies: string[];
}

export type Detection =
  | { ok: true; project: ProjectInfo }
  | { ok: false; code: "folder-missing" | "project-invalid"; message: string };

export function detectProject(root: string): Detection {
  try {
    if (!fs.statSync(root).isDirectory()) throw new Error("not a directory");
  } catch {
    return {
      ok: false,
      code: "folder-missing",
      message:
        "This folder is no longer here. Locate it in the project list, or forget the project.",
    };
  }
  const problem = manifestProblem(root);
  if (problem) return { ok: false, code: "project-invalid", message: problem };
  const manifest = readManifest(root)!;
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  };
  if (!dependencies.next) {
    return {
      ok: false,
      code: "project-invalid",
      message:
        "This version of Auis Design opens Next.js projects. This project does not declare Next.js.",
    };
  }
  const nodeRange = manifest.engines?.node ?? ">=20.9";
  if (typeof nodeRange !== "string" || !semver.validRange(nodeRange)) {
    return {
      ok: false,
      code: "project-invalid",
      message:
        "The Node requirement in package.json is not a valid version range. Fix engines.node and try again.",
    };
  }
  const resolve = createRequire(path.join(root, "package.json"));
  // Resolve from this project (including hoisted monorepo dependencies), never from the desktop app.
  const missingDependencies = Object.keys(dependencies).filter((name) => {
    try {
      return !fs.existsSync(resolve.resolve(`${name}/package.json`));
    } catch {
      try {
        return !fs.existsSync(resolve.resolve(name));
      } catch {
        return true;
      }
    }
  });
  try {
    const installed = JSON.parse(
      fs.readFileSync(resolve.resolve("next/package.json"), "utf8"),
    );
    if (
      semver.valid(installed.version) &&
      semver.lt(installed.version, "16.0.0")
    ) {
      return {
        ok: false,
        code: "project-invalid",
        message: `Next.js ${installed.version} is installed. Auis Design needs Next.js 16 or later to find and manage the dev server.`,
      };
    }
  } catch {
    /* A missing Next installation is handled by Install. */
  }
  const hasAuis = ["app/auis", "src/app/auis"].some((dir) =>
    fs.existsSync(path.join(root, dir)),
  );
  const kind = manifest.auis
    ? "scaffold"
    : fs.existsSync(path.join(root, ".auis/manifest.json"))
      ? "host"
      : "next";
  return {
    ok: true,
    project: {
      kind,
      hasAuis,
      packageManager: packageManagerOf(root),
      nodeRange,
      missingDependencies,
    },
  };
}

export interface NodeInfo {
  path: string | null;
  version: string | null;
}

export async function readNode(root: string, env: Env): Promise<NodeInfo> {
  const file = findOnPath("node", env);
  if (!file) return { path: null, version: null };
  return new Promise((resolve) => {
    execFile(
      file,
      ["--version"],
      { cwd: root, env, timeout: 5000 },
      (error, stdout) => {
        resolve({
          path: file,
          version: error ? null : semver.valid(stdout.trim()),
        });
      },
    );
  });
}

export function nodeProblem(node: NodeInfo, range: string): string | null {
  if (!node.path)
    return `Node was not found in your shell. Install Node ${range}, then try again.`;
  if (!node.version)
    return `Node at ${node.path} did not report a version. Check your shell setup, then try again.`;
  return semver.satisfies(node.version, range)
    ? null
    : `This project needs Node ${range}. Found ${node.version} at ${node.path}. Switch Node for this folder, then try again.`;
}
