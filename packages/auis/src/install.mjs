/**
 * `auis init` and `auis uninstall` — the Review Bridge, installed into a
 * repository that is not Auis's, and taken back out.
 *
 * `init` writes a handful of touch points and records every one of them in
 * `.auis/manifest.json`:
 *
 *   - one route file:      app/api/review-bridge/[...path]/route.ts
 *   - the root layout:     one import and one <AuisReview /> before </body>
 *   - package.json:        one dependency (@auis/next)
 *   - the lockfile:        whatever the package manager's install changes
 *   - .gitignore:          a delimited block
 *   - .auis/:              the manifest, the original bytes of every file it
 *                          edited, and data/ (the comment queue)
 *
 * It never overwrites a file it did not create, and it never touches AGENTS.md,
 * .mcp.json, globals.css, tsconfig.json or components.json.
 *
 * `uninstall` reads the manifest and reverses it. A file that still has the
 * bytes `init` left gets its original bytes back, exactly. A file the user
 * changed since gets a surgical removal of only what `init` inserted. A file
 * `init` created and the user edited is kept, with a warning. The comments are
 * moved into the project's backup folder, never deleted (unless --purge).
 *
 * The plan is computed once, by `planInstall()`; `doctor` prints the same plan,
 * so the footprint `doctor` promises is the footprint `init` has.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { color, fail, step, warn, write } from "./ui.mjs";
import { detect } from "./detect.mjs";
import { exec } from "./template.mjs";

/** The kit version `init` writes. Kept equal to kit/next/package.json by a test. */
export const KIT_VERSION = "0.1.0";
export const KIT_PACKAGE = "@auis/next";
export const MANIFEST_VERSION = 1;

export const AUIS_DIR = ".auis";
export const MANIFEST = `${AUIS_DIR}/manifest.json`;
export const DATA_DIR = `${AUIS_DIR}/data`;
const ORIGINALS = `${AUIS_DIR}/originals`;

const BLOCK_START = "# >>> auis — written by `auis init`, removed by `auis uninstall`";
const BLOCK_END = "# <<< auis";
const BLOCK_LINES = [BLOCK_START, `/${DATA_DIR}/`, `/${ORIGINALS}/`, BLOCK_END];

const LOCKFILES = {
  npm: ["package-lock.json"],
  pnpm: ["pnpm-lock.yaml"],
  yarn: ["yarn.lock"],
  bun: ["bun.lock", "bun.lockb"],
};

export const ONLY = ["review"];

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const abs = (root, rel) => path.join(root, rel);
const readMaybe = (file) => (fs.existsSync(file) ? fs.readFileSync(file) : null);

// ---------------------------------------------------------------------------
// What gets written
// ---------------------------------------------------------------------------

export function routeSource() {
  return `// Auis Review Bridge — written by \`auis init\`, removed by \`auis uninstall\`.
// Every /api/review-bridge/* request (pins, comments, the drawer) is answered
// by @auis/server. Comments live in .auis/data (gitignored).
import { createReviewRoute } from "@auis/next"

// Next reads these two statically, so they stay literal here.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const route = createReviewRoute({ dataDir: ".auis/data" })
export const GET = route.GET
export const POST = route.POST
export const PUT = route.PUT
export const PATCH = route.PATCH
export const DELETE = route.DELETE
`;
}

const IMPORT_SPEC = "@auis/next/client";
const ELEMENT = "<AuisReview />";

/**
 * The layout with the import after its last top-level import and the element
 * before `</body>`, in the file's own quote and semicolon style. Returns null
 * when there is not exactly one `</body>` to aim at.
 */
export function patchLayout(source) {
  if ((source.match(/<\/body>/g) ?? []).length !== 1) return null;

  const imports = [...source.matchAll(/^import\b[\s\S]*?(["'])[^"'\n]+\1;?[ \t]*$/gm)];
  const last = imports.at(-1);
  const quote = last ? last[1] : '"';
  const semi = last ? /;[ \t]*$/.test(last[0]) : true;
  const importLine = `import { AuisReview } from ${quote}${IMPORT_SPEC}${quote}${semi ? ";" : ""}`;

  let out;
  let at;
  if (last) {
    at = last.index + last[0].length;
    out = `${source.slice(0, at)}\n${importLine}${source.slice(at)}`;
  } else {
    // No imports: after a leading "use …" directive, if there is one.
    const directive = source.match(/^(["'])use [a-z]+\1;?[ \t]*\n/);
    at = directive ? directive[0].length : 0;
    out = `${source.slice(0, at)}${importLine}\n${source.slice(at)}`;
  }

  const close = out.indexOf("</body>");
  const lineStart = out.lastIndexOf("\n", close - 1) + 1;
  const before = out.slice(lineStart, close);
  let elementLine;
  if (/^[ \t]*$/.test(before)) {
    // `</body>` on its own line: one line above it, one indent deeper.
    const unit = before.includes("\t") ? "\t" : "  ";
    elementLine = `${before}${unit}${ELEMENT}`;
    out = `${out.slice(0, lineStart)}${elementLine}\n${out.slice(lineStart)}`;
  } else {
    elementLine = null; // inline: `<body>{children}</body>`
    out = `${out.slice(0, close)}${ELEMENT}${out.slice(close)}`;
  }
  return { source: out, importLine, elementLine };
}

/** Takes out exactly what patchLayout put in, wherever the user moved it since. */
export function unpatchLayout(source, { importLine, elementLine }) {
  let out = source;
  const dropLine = (text, line) => {
    const lines = text.split("\n");
    const i = lines.findIndex((l) => l.trim() === line.trim());
    if (i === -1) return null;
    lines.splice(i, 1);
    return lines.join("\n");
  };
  const a = dropLine(out, importLine);
  if (a !== null) out = a;
  if (elementLine) {
    const b = dropLine(out, elementLine);
    if (b !== null) out = b;
  } else if (out.includes(`${ELEMENT}</body>`)) {
    out = out.replace(`${ELEMENT}</body>`, "</body>");
  }
  return out;
}

function indentOf(json) {
  const m = json.match(/^[ \t]+(?=")/m);
  return m ? m[0] : "  ";
}

/** package.json with the kit added to `dependencies`, keys kept sorted. */
export function addDependency(source, name, range) {
  const pkg = JSON.parse(source);
  const deps = { ...(pkg.dependencies ?? {}), [name]: range };
  pkg.dependencies = Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify(pkg, null, indentOf(source))}\n`;
}

export function removeDependency(source, name) {
  const pkg = JSON.parse(source);
  if (pkg.dependencies?.[name] === undefined) return source;
  delete pkg.dependencies[name];
  if (Object.keys(pkg.dependencies).length === 0) delete pkg.dependencies;
  return `${JSON.stringify(pkg, null, indentOf(source))}\n`;
}

export function addGitignoreBlock(source) {
  if (source.includes(BLOCK_START)) return source;
  const sep = source.length === 0 || source.endsWith("\n") ? "" : "\n";
  const gap = source.length === 0 ? "" : "\n";
  return `${source}${sep}${gap}${BLOCK_LINES.join("\n")}\n`;
}

export function removeGitignoreBlock(source) {
  const start = source.indexOf(BLOCK_START);
  if (start === -1) return source;
  const endMark = source.indexOf(BLOCK_END, start);
  if (endMark === -1) return source;
  let end = endMark + BLOCK_END.length;
  if (source[end] === "\n") end++;
  let begin = start;
  // The blank line init put before the block goes with it.
  if (begin >= 2 && source.slice(begin - 2, begin) === "\n\n") begin--;
  return source.slice(0, begin) + source.slice(end);
}

// ---------------------------------------------------------------------------
// The plan — shared with `doctor`
// ---------------------------------------------------------------------------

/**
 * What `init` would do in `root`, given doctor's detections. `{ ok: false }`
 * with a reason when it cannot install there; otherwise the steps, each with
 * enough detail for doctor to print and for init to carry out.
 */
export function planInstall(d, root, { packageManager } = {}) {
  if (d.framework.name !== "next" || d.router.name !== "app-router") {
    const found = d.framework.name === "unknown"
      ? "no JavaScript framework"
      : `${d.framework.name}${d.router.name === "pages-router" ? " on the Pages Router" : ""}`;
    return {
      ok: false,
      reason: `auis init installs into a Next.js App Router app today; this is ${found}.`,
      steps: [],
    };
  }
  if (d.react.major !== null && d.react.major < 18) {
    return { ok: false, reason: `React ${d.react.major} is below the 18 the review chrome needs.`, steps: [] };
  }

  const base = d.rootLayout.path?.startsWith("src/") ? "src/app" : "app";
  const ts = fs.existsSync(abs(root, "tsconfig.json"));
  const route = `${base}/api/review-bridge/[...path]/route.${ts ? "ts" : "js"}`;
  const pm = packageManager ?? d.packageManager.name;
  const lockfile = (LOCKFILES[pm] ?? []).find((f) => fs.existsSync(abs(root, f))) ?? LOCKFILES[pm]?.[0] ?? null;

  const steps = [];
  steps.push({ action: "create", kind: "file", path: route, detail: `${routeSource().split("\n").length - 1} lines — the bridge's catch-all route` });
  if (d.rootLayout.path && d.rootLayout.patchable) {
    steps.push({ action: "edit", kind: "layout", path: d.rootLayout.path, detail: "+2 lines — one import, one <AuisReview /> before </body>" });
  } else if (d.rootLayout.path) {
    steps.push({ action: "print", kind: "layout", path: d.rootLayout.path, detail: `${d.rootLayout.bodies} <body> tags — auis prints the two lines for you to place` });
  }
  steps.push({ action: "edit", kind: "dependency", path: "package.json", detail: `+1 dependency — ${KIT_PACKAGE}@^${KIT_VERSION}` });
  if (lockfile) {
    steps.push({ action: "edit", kind: "lockfile", path: lockfile, detail: `${pm} install` });
  }
  steps.push({ action: fs.existsSync(abs(root, ".gitignore")) ? "append" : "create", kind: "block", path: ".gitignore", detail: `${BLOCK_LINES.length} lines, in a delimited block` });
  steps.push({ action: "create", kind: "manifest", path: MANIFEST, detail: "what auis wrote, so uninstall can reverse it" });
  steps.push({ action: "create", kind: "data", path: `${DATA_DIR}/`, detail: "the comment queue (gitignored)" });
  return { ok: true, route, base, packageManager: pm, lockfile, steps };
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

function saveOriginal(root, rel, bytes) {
  const file = abs(root, path.join(ORIGINALS, rel));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return `${ORIGINALS}/${rel}`;
}

function printPlan(plan) {
  write();
  write(`  ${color.bold("What init touches")}  ${color.dim(`${plan.steps.length} places`)}`);
  write();
  for (const s of plan.steps) {
    write(`    ${color.dim(s.action.padEnd(8))}${s.path.padEnd(44)}${color.dim(s.detail)}`);
  }
  write();
}

/** Directories `mkdir -p` would create for `rel`, outermost first. */
function missingDirs(root, rel) {
  const out = [];
  let dir = path.dirname(rel);
  while (dir !== "." && dir !== "/" && !fs.existsSync(abs(root, dir))) {
    out.unshift(dir);
    dir = path.dirname(dir);
  }
  return out;
}

export async function init({
  directory = ".",
  dryRun = false,
  install = true,
  packageManager,
  only = "review",
  kitRange = `^${KIT_VERSION}`,
} = {}) {
  const root = path.resolve(directory);
  if (!fs.existsSync(abs(root, "package.json"))) {
    fail(
      `${root} has no package.json.\n    ${color.bold("auis init")} installs the Review Bridge into an existing app. ` +
      `To start a new Auis project, run ${color.bold(`npx @auis/cli@latest ${directory === "." ? "my-product" : directory}`)}.`,
    );
    return 1;
  }
  if (!ONLY.includes(only)) {
    fail(`--only ${only}: only ${ONLY.join(", ")} can be installed into an existing app today.`);
    return 1;
  }

  const existing = readManifest(root);
  if (existing) {
    write(`  ${color.green("✓")} Already installed ${color.dim(`(${MANIFEST}, ${existing.createdAt})`)} — nothing to do.`);
    write(`    ${color.dim("To start over: npx @auis/cli uninstall, then init again.")}`);
    write();
    return 0;
  }

  const d = detect(root);
  const plan = planInstall(d, root, { packageManager });
  if (!plan.ok) {
    fail(`${plan.reason}\n    Run ${color.bold("npx @auis/cli doctor")} for what Auis can still do here.`);
    return 1;
  }
  if (fs.existsSync(abs(root, plan.route)) || fs.existsSync(abs(root, path.dirname(path.dirname(plan.route))))) {
    fail(`${path.dirname(path.dirname(plan.route))} already exists. auis init does not overwrite routes it did not write.`);
    return 1;
  }

  printPlan(plan);
  if (dryRun) {
    write(`  ${color.dim("Dry run — nothing was written.")}`);
    write();
    return 0;
  }

  const artifacts = [];

  // 1. The route.
  const createdDirs = missingDirs(root, plan.route);
  fs.mkdirSync(path.dirname(abs(root, plan.route)), { recursive: true });
  const routeBytes = Buffer.from(routeSource());
  fs.writeFileSync(abs(root, plan.route), routeBytes);
  artifacts.push({ kind: "file", path: plan.route, sha256: sha(routeBytes), createdDirs });
  step("route", plan.route);

  // 2. The layout.
  let printed = null;
  const layoutStep = plan.steps.find((s) => s.kind === "layout");
  if (layoutStep?.action === "edit") {
    const before = fs.readFileSync(abs(root, layoutStep.path));
    const patched = patchLayout(before.toString("utf8"));
    if (patched) {
      fs.writeFileSync(abs(root, layoutStep.path), patched.source);
      artifacts.push({
        kind: "layout",
        path: layoutStep.path,
        importLine: patched.importLine,
        elementLine: patched.elementLine,
        before: sha(before),
        after: sha(Buffer.from(patched.source)),
        original: saveOriginal(root, layoutStep.path, before),
      });
      step("layout", `${layoutStep.path} ${color.dim("+ import, + <AuisReview />")}`);
    } else {
      printed = layoutStep.path;
    }
  } else if (layoutStep) {
    printed = layoutStep.path;
  }

  // 3. package.json, then the install that updates the lockfile.
  const pkgBefore = fs.readFileSync(abs(root, "package.json"));
  fs.writeFileSync(abs(root, "package.json"), addDependency(pkgBefore.toString("utf8"), KIT_PACKAGE, kitRange));
  const lockBefore = plan.lockfile ? readMaybe(abs(root, plan.lockfile)) : null;
  let installed = false;
  if (install) {
    const { ok, stderr } = await exec(plan.packageManager, ["install"], { cwd: root, inherit: true });
    if (!ok) {
      warn(`${plan.packageManager} install failed${stderr ? `: ${stderr}` : ""} — the files are written; run it yourself.`);
    } else {
      installed = true;
    }
  }
  const pkgAfter = fs.readFileSync(abs(root, "package.json"));
  artifacts.push({
    kind: "dependency",
    path: "package.json",
    name: KIT_PACKAGE,
    range: kitRange,
    before: sha(pkgBefore),
    after: sha(pkgAfter),
    original: saveOriginal(root, "package.json", pkgBefore),
  });
  step("package", `${KIT_PACKAGE}@${kitRange}${installed ? color.dim(` · ${plan.packageManager} install`) : ""}`);
  if (plan.lockfile) {
    const lockAfter = readMaybe(abs(root, plan.lockfile));
    if (lockAfter && (!lockBefore || !lockBefore.equals(lockAfter))) {
      artifacts.push({
        kind: "lockfile",
        path: plan.lockfile,
        before: lockBefore ? sha(lockBefore) : null,
        after: sha(lockAfter),
        original: lockBefore ? saveOriginal(root, plan.lockfile, lockBefore) : null,
      });
    }
  }

  // 4. .gitignore.
  const ignoreBefore = readMaybe(abs(root, ".gitignore"));
  const ignoreAfter = addGitignoreBlock(ignoreBefore?.toString("utf8") ?? "");
  fs.writeFileSync(abs(root, ".gitignore"), ignoreAfter);
  artifacts.push({
    kind: "block",
    path: ".gitignore",
    created: ignoreBefore === null,
    before: ignoreBefore ? sha(ignoreBefore) : null,
    after: sha(Buffer.from(ignoreAfter)),
    original: ignoreBefore ? saveOriginal(root, ".gitignore", ignoreBefore) : null,
  });
  step("gitignore", `/${DATA_DIR}/, /${ORIGINALS}/`);

  // 5. The data folder, and the manifest last: it exists only for a finished init.
  fs.mkdirSync(abs(root, DATA_DIR), { recursive: true });
  artifacts.push({ kind: "data", path: DATA_DIR });
  const manifest = {
    auisManifestVersion: MANIFEST_VERSION,
    createdAt: new Date().toISOString(),
    only: [only],
    kit: { package: KIT_PACKAGE, range: kitRange },
    packageManager: plan.packageManager,
    artifacts,
  };
  fs.writeFileSync(abs(root, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  step("manifest", MANIFEST);

  write();
  if (printed) {
    warn(`${printed} has more than one <body>, so auis did not edit it. Add these two lines yourself:`);
    write();
    write(`      import { AuisReview } from "${IMPORT_SPEC}"`);
    write(`      ${ELEMENT}            ${color.dim("← just before </body>")}`);
    write();
  }
  write(`  ${color.bold("Review is installed.")} Start your dev server, then open Review with the pill at the bottom of the page or ${color.bold("⌘⇧Y")} ${color.dim("(Ctrl+Shift+Y)")}.`);
  write(`  ${color.dim("Comments live in .auis/data. Agents read them at /api/review-bridge.")}`);
  write(`  ${color.dim("To take it all back out: npx @auis/cli uninstall")}`);
  write();
  return 0;
}

// ---------------------------------------------------------------------------
// uninstall
// ---------------------------------------------------------------------------

export function readManifest(root) {
  try {
    return JSON.parse(fs.readFileSync(abs(root, MANIFEST), "utf8"));
  } catch {
    return null;
  }
}

/** Same key the bridge uses for this project's backups (kit/server config.ts). */
export function projectBackupDir(root) {
  let cwd = root;
  try {
    cwd = fs.realpathSync(root);
  } catch {
    /* keep the given path */
  }
  const key = crypto.createHash("sha256").update(cwd).digest("hex").slice(0, 16);
  return path.join(os.homedir(), ".auis", "review-bridge-backups", key);
}

function removeEmptyDirs(root, dirs) {
  for (const dir of [...dirs].reverse()) {
    try {
      fs.rmdirSync(abs(root, dir));
    } catch {
      /* not empty or already gone: someone else's now */
    }
  }
}

/**
 * Reverse one edited file: its original bytes when it is exactly as init left
 * it, otherwise `surgical(current)`. Returns what happened, for the report.
 */
function restore(root, artifact, surgical) {
  const file = abs(root, artifact.path);
  const current = readMaybe(file);
  if (current === null) return "missing";
  const original = artifact.original ? readMaybe(abs(root, artifact.original)) : null;
  if (sha(current) === artifact.after && original) {
    fs.writeFileSync(file, original);
    return "restored";
  }
  const next = surgical(current.toString("utf8"));
  if (next === current.toString("utf8")) return "untouched";
  fs.writeFileSync(file, next);
  return "edited";
}

export async function uninstall({ directory = ".", install = true, purge = false, force = false } = {}) {
  const root = path.resolve(directory);
  const manifest = readManifest(root);
  if (!manifest) {
    fail(`No ${MANIFEST} in ${root} — auis was not installed here by \`auis init\`, so there is nothing to reverse.`);
    return 1;
  }

  let needsInstall = false;
  let kept = 0;
  for (const a of [...manifest.artifacts].reverse()) {
    switch (a.kind) {
      case "file": {
        const current = readMaybe(abs(root, a.path));
        if (current === null) {
          step("route", `${a.path} ${color.dim("already gone")}`);
        } else if (sha(current) === a.sha256 || force) {
          fs.rmSync(abs(root, a.path));
          removeEmptyDirs(root, a.createdDirs ?? []);
          step("route", `${a.path} ${color.dim("removed")}`);
        } else {
          kept++;
          warn(`${a.path} changed since init — kept. Delete it yourself, or run uninstall --force.`);
        }
        break;
      }
      case "layout": {
        const how = restore(root, a, (src) => unpatchLayout(src, a));
        step("layout", `${a.path} ${color.dim(how)}`);
        break;
      }
      case "dependency": {
        const how = restore(root, a, (src) => removeDependency(src, a.name));
        if (how === "edited") needsInstall = true;
        step("package", `${a.name} ${color.dim(how === "restored" ? "removed" : how)}`);
        break;
      }
      case "lockfile": {
        const current = readMaybe(abs(root, a.path));
        if (current && sha(current) === a.after) {
          if (a.original) fs.writeFileSync(abs(root, a.path), readMaybe(abs(root, a.original)));
          else fs.rmSync(abs(root, a.path));
          step("lockfile", `${a.path} ${color.dim("restored")}`);
        } else {
          needsInstall = true;
        }
        break;
      }
      case "block": {
        const current = readMaybe(abs(root, a.path));
        if (a.created && current && sha(current) === a.after) {
          fs.rmSync(abs(root, a.path));
          step("gitignore", color.dim("removed (auis created it)"));
        } else {
          const how = restore(root, a, removeGitignoreBlock);
          step("gitignore", color.dim(how));
        }
        break;
      }
      case "data": {
        const data = abs(root, a.path);
        if (!fs.existsSync(data)) break;
        if (purge) {
          fs.rmSync(data, { recursive: true, force: true });
          step("data", `${a.path} ${color.dim("deleted (--purge)")}`);
        } else if (fs.readdirSync(data).length === 0) {
          fs.rmdirSync(data);
        } else {
          const stamp = new Date().toISOString().replace(/[:.]/g, "-");
          const dest = path.join(projectBackupDir(root), `uninstalled-${stamp}`);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.cpSync(data, dest, { recursive: true });
          fs.rmSync(data, { recursive: true, force: true });
          step("data", `${a.path} ${color.dim(`moved to ${dest}`)}`);
        }
        break;
      }
      default:
        break;
    }
  }

  if (needsInstall && install) {
    const pm = manifest.packageManager ?? "npm";
    const { ok } = await exec(pm, ["install"], { cwd: root, inherit: true });
    if (ok) step("lockfile", color.dim(`${pm} install`));
    else warn(`${pm} install failed — run it yourself to drop ${manifest.kit?.package ?? KIT_PACKAGE} from the lockfile.`);
  }

  // The manifest and the saved originals go last, and .auis with them if empty.
  fs.rmSync(abs(root, ORIGINALS), { recursive: true, force: true });
  if (kept === 0) fs.rmSync(abs(root, MANIFEST), { force: true });
  try {
    fs.rmdirSync(abs(root, AUIS_DIR));
  } catch {
    /* something of the user's is still in there */
  }

  write();
  if (kept > 0) {
    write(`  ${color.yellow("!")} Uninstalled, except ${kept} file${kept === 1 ? "" : "s"} you changed. ${MANIFEST} stays until you deal with ${kept === 1 ? "it" : "them"}.`);
  } else {
    write(`  ${color.bold("Review is uninstalled.")} ${color.dim("node_modules may still hold the packages until your next install.")}`);
  }
  write();
  return 0;
}
