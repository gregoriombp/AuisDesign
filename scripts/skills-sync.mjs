#!/usr/bin/env node
// Auis — skills sync
// Single source of truth: skills/<capability>/<name>/
// Generates the agent discovery trees:
//   .claude/skills/<name>/   (Claude Code)   — uses SKILL.md
//   .agents/skills/<name>/   (Codex/Cursor)  — uses SKILL.codex.md when present, else SKILL.md
// In THIS repo both trees are .gitignored — they are generated, never edited by hand.
// Run: npm run skills:sync   (also wired into predev/postinstall)
//
// OWNERSHIP. This script also runs inside repositories that are not Auis's: the
// template ships it, so `npm install` in someone else's project executes it. It
// therefore never deletes a tree wholesale (`.claude/skills/`, `.agents/`) and
// never overwrites a skill directory it does not own. A directory is Auis's when
// .auis/skills-manifest.json says the previous run wrote it, OR when its contents
// already match byte for byte what this run would write — which is what makes an
// install that predates the manifest adopt itself without a destructive step.
// Anything else belongs to the host: reported, skipped, left alone. Both trees are
// commonly gitignored, so a wrong delete here is unrecoverable.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, dirname, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SKILLS = join(ROOT, "skills")
const CLAUDE = join(ROOT, ".claude/skills")
const CODEX = join(ROOT, ".agents/skills")
const MANIFEST = join(ROOT, ".auis/skills-manifest.json")

const registryPath = join(SKILLS, "registry.json")
if (!existsSync(registryPath)) {
  console.error("skills/registry.json missing — run `npm run skills:catalog` first.")
  process.exit(1)
}
const registry = JSON.parse(readFileSync(registryPath, "utf8"))

/** Reads a directory into a `relative path -> contents` map. Manual recursion
 *  rather than fs.cpSync/readdir(recursive) — it avoids mode-preservation
 *  problems on restricted mounts, and gives us the map we compare with. */
function readTree(dir, base = dir, out = new Map()) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) readTree(p, base, out)
    else out.set(relative(base, p).split(sep).join("/"), readFileSync(p))
  }
  return out
}

/** What this run would write for one skill. `SKILL.codex.md` never ships as
 *  itself: on the Codex tree it replaces SKILL.md, on the Claude tree it is dropped. */
function expectedTree(srcDir, useCodexVariant) {
  const files = new Map()
  for (const [rel, buf] of readTree(srcDir)) {
    if (rel === "SKILL.codex.md") continue
    files.set(rel, buf)
  }
  if (useCodexVariant) {
    const variant = join(srcDir, "SKILL.codex.md")
    if (existsSync(variant)) files.set("SKILL.md", readFileSync(variant))
  }
  return files
}

function sameTree(a, b) {
  if (a.size !== b.size) return false
  for (const [rel, buf] of a) {
    const other = b.get(rel)
    if (!other || !buf.equals(other)) return false
  }
  return true
}

function writeTree(dstDir, files) {
  for (const [rel, buf] of files) {
    const p = join(dstDir, rel)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, buf)
  }
}

/** Absent on a first install — which is exactly the case where deleting
 *  anything would be destroying somebody else's skills. */
function readManifest() {
  try {
    const prev = JSON.parse(readFileSync(MANIFEST, "utf8"))
    return { claude: new Set(prev.claude ?? []), codex: new Set(prev.codex ?? []) }
  } catch {
    return { claude: new Set(), codex: new Set() }
  }
}

const previous = readManifest()
mkdirSync(CLAUDE, { recursive: true })
mkdirSync(CODEX, { recursive: true })

const skipped = new Set()

/** Returns the skill name when it was installed, null when the host owns that name. */
function install(treeDir, name, files, ownedBefore) {
  const dst = join(treeDir, name)
  if (!existsSync(dst)) {
    writeTree(dst, files)
    return name
  }
  if (ownedBefore.has(name) || sameTree(files, readTree(dst))) {
    // Ours: replace it outright so a renamed or deleted file cannot linger.
    rmSync(dst, { recursive: true, force: true })
    writeTree(dst, files)
    return name
  }
  skipped.add(name)
  return null
}

const wroteClaude = [], wroteCodex = []
let nVariant = 0

for (const skill of registry.skills) {
  const src = join(SKILLS, skill.capability, skill.name)
  if (!existsSync(src)) { console.warn("missing source:", skill.name); continue }

  if (skill.platforms.includes("claude")) {
    const done = install(CLAUDE, skill.name, expectedTree(src, false), previous.claude)
    if (done) wroteClaude.push(done)
  }
  if (skill.platforms.includes("codex")) {
    const useVariant = Boolean(skill.divergent) && existsSync(join(src, "SKILL.codex.md"))
    const done = install(CODEX, skill.name, expectedTree(src, useVariant), previous.codex)
    if (done) {
      wroteCodex.push(done)
      if (useVariant) nVariant++
    }
  }
}

// Skills the registry dropped since the previous run: ours, so remove them —
// by name, one at a time, never the tree.
for (const [treeDir, before, now] of [
  [CLAUDE, previous.claude, new Set(wroteClaude)],
  [CODEX, previous.codex, new Set(wroteCodex)],
]) {
  for (const name of before) {
    if (now.has(name) || skipped.has(name)) continue
    const p = join(treeDir, name)
    if (existsSync(p)) rmSync(p, { recursive: true, force: true })
  }
}

mkdirSync(dirname(MANIFEST), { recursive: true })
writeFileSync(
  MANIFEST,
  `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), claude: wroteClaude, codex: wroteCodex }, null, 2)}\n`
)

console.log(
  `skills:sync ✓  .claude/skills: ${wroteClaude.length}  ·  .agents/skills: ${wroteCodex.length} (${nVariant} Codex variants applied)`
)
if (skipped.size > 0) {
  console.warn(
    `skills:sync — skipped ${skipped.size}: a directory of that name was already there and Auis did not write it. Left untouched: ${[...skipped].join(", ")}`
  )
}
