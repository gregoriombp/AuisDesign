#!/usr/bin/env node
/**
 * Rank source files by comment load for /prose-sweep.
 * Usage: node .claude/skills/prose-sweep/scripts/rank.mjs [path...]
 * The repository root is four levels up, from both skills/support/prose-sweep/scripts
 * and the generated .claude/skills/prose-sweep/scripts.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".agents",
  ".claude",
  ".codex",
  ".cursor",
  "output",
  "dist",
  "coverage",
  ".turbo",
]);
const SKIP_PATHS = ["review-bridge/data", "flow-bridge/data", "page-editor/data"];
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const FIELD_RE =
  /^\s*(?:export\s+)?(?:(?:readonly|public|private|protected|static|override|async|abstract)\s+)*(?:(?:get|set)\s+)?([A-Za-z_$][\w$]*)\s*[?:]?\s*[:(=]/;
const RESTATE_RE = /^(label|value|name|path|id|optional|context|the|a|an)\b/i;

function skipped(rel) {
  const parts = rel.split(path.sep);
  if (parts.some((p) => SKIP_DIRS.has(p) || p.startsWith(".next") || p.startsWith(".playwright"))) {
    return true;
  }
  return SKIP_PATHS.some((p) => rel === p || rel.startsWith(`${p}/`));
}

async function collect(target, out) {
  const full = path.isAbsolute(target) ? target : path.join(ROOT, target);
  const rel = path.relative(ROOT, full);
  if (rel.startsWith("..") || skipped(rel)) return;
  let info;
  try {
    info = await stat(full);
  } catch {
    return;
  }
  if (info.isDirectory()) {
    for (const entry of await readdir(full, { withFileTypes: true })) {
      await collect(path.join(rel, entry.name), out);
    }
    return;
  }
  if (info.isFile() && EXT.has(path.extname(full))) out.push(rel);
}

function analyze(src) {
  const lines = src.split("\n");
  let inBlock = false;
  let inJsdoc = false;
  let commentLines = 0;
  let blank = 0;
  let jsdocLines = 0;
  let restatingJsdoc = 0;
  let fieldJsdocs = 0;
  let blockStart = 0;
  let blockLen = 0;
  const longBlocks = [];

  const flush = () => {
    if (blockLen >= 4) longBlocks.push({ start: blockStart, lines: blockLen });
    blockLen = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      blank += 1;
      if (blockLen) flush();
      continue;
    }

    let isComment = false;
    if (inJsdoc) {
      isComment = true;
      jsdocLines += 1;
      if (trimmed.includes("*/")) inJsdoc = false;
    } else if (inBlock) {
      isComment = true;
      if (trimmed.includes("*/")) inBlock = false;
    } else if (trimmed.startsWith("/**")) {
      isComment = true;
      jsdocLines += 1;
      inJsdoc = !(trimmed.endsWith("*/") && trimmed.length > 4);
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j += 1;
      const next = lines[j] || "";
      const match = next.match(FIELD_RE);
      if (match) {
        fieldJsdocs += 1;
        const text = trimmed.replace(/^\/\*\*\s*/, "").replace(/\s*\*\/$/, "");
        if (text.toLowerCase().includes(match[1].toLowerCase()) || RESTATE_RE.test(text)) {
          restatingJsdoc += 1;
        }
      }
    } else if (trimmed.startsWith("/*")) {
      isComment = true;
      inBlock = !trimmed.includes("*/");
    } else if (trimmed.startsWith("//")) {
      isComment = true;
    }

    if (isComment) {
      commentLines += 1;
      if (!blockLen) blockStart = i + 1;
      blockLen += 1;
    } else if (blockLen) {
      flush();
    }
  }
  if (blockLen) flush();

  const total = lines.length;
  const ratio = total - blank > 0 ? commentLines / (total - blank) : 0;
  return { total, commentLines, jsdocLines, fieldJsdocs, restatingJsdoc, ratio, longBlocks };
}

const args = process.argv.slice(2);
const seeds = args.length ? args : ["lib", "components", "app", "scripts"];
const files = [];
for (const seed of seeds) await collect(seed, files);
files.sort();

const rows = [];
for (const rel of files) {
  const result = analyze(await readFile(path.join(ROOT, rel), "utf8"));
  if (result.commentLines < 8 && result.ratio < 0.25) continue;
  rows.push({ rel, ...result });
}

const byRatio = [...rows]
  .filter((row) => row.ratio >= 0.35 && row.commentLines >= 12)
  .sort((a, b) => b.ratio - a.ratio);
const byRestate = [...rows]
  .filter((row) => row.restatingJsdoc >= 3)
  .sort((a, b) => b.restatingJsdoc - a.restatingJsdoc);
const byVolume = [...rows].sort((a, b) => b.commentLines - a.commentLines).slice(0, 25);

const fmt = (row) =>
  `${String(Math.round(row.ratio * 100)).padStart(3)}% ${String(row.commentLines).padStart(4)}c/${String(row.total).padStart(4)}t jsdoc=${row.jsdocLines} restate=${row.restatingJsdoc} long=${row.longBlocks.length}  ${row.rel}`;

console.log(`scanned ${files.length} files, ${rows.length} comment-heavy`);
console.log("\n=== ratio >= 35% and >= 12 comment lines ===");
console.log(byRatio.slice(0, 30).map(fmt).join("\n") || "(none)");
console.log("\n=== restating field JSDoc >= 3 ===");
console.log(byRestate.slice(0, 25).map(fmt).join("\n") || "(none)");
console.log("\n=== top comment volume ===");
console.log(byVolume.map(fmt).join("\n") || "(none)");
