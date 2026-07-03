#!/usr/bin/env node
// Auis — skills sync
// Single source of truth: skills/<capability>/<name>/
// Generates the agent discovery trees:
//   .claude/skills/<name>/   (Claude Code)   — uses SKILL.md
//   .agents/skills/<name>/   (Codex/Cursor)  — uses SKILL.codex.md when present, else SKILL.md
// Both trees are .gitignored — they are generated, never edited by hand.
// Run: npm run skills:sync   (also wired into predev/postinstall)

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SKILLS = join(ROOT, "skills")
const CLAUDE = join(ROOT, ".claude/skills")
const CODEX = join(ROOT, ".agents/skills")

const registryPath = join(SKILLS, "registry.json")
if (!existsSync(registryPath)) {
  console.error("skills/registry.json missing — run `npm run skills:catalog` first.")
  process.exit(1)
}
const registry = JSON.parse(readFileSync(registryPath, "utf8"))

// Manual recursive copy (avoids fs.cpSync mode-preservation issues on restricted mounts).
function copyTree(srcDir, dstDir) {
  mkdirSync(dstDir, { recursive: true })
  for (const entry of readdirSync(srcDir)) {
    const sp = join(srcDir, entry)
    if (statSync(sp).isDirectory()) {
      copyTree(sp, join(dstDir, entry))
    } else if (entry !== "SKILL.codex.md") {
      // SKILL.codex.md is applied explicitly for the Codex tree below
      writeFileSync(join(dstDir, entry), readFileSync(sp))
    }
  }
}

rmSync(CLAUDE, { recursive: true, force: true })
rmSync(CODEX, { recursive: true, force: true })
mkdirSync(CLAUDE, { recursive: true })
mkdirSync(CODEX, { recursive: true })

let nClaude = 0, nCodex = 0, nVariant = 0
for (const skill of registry.skills) {
  const src = join(SKILLS, skill.capability, skill.name)
  if (!existsSync(src)) { console.warn("missing source:", skill.name); continue }

  if (skill.platforms.includes("claude")) {
    copyTree(src, join(CLAUDE, skill.name))
    nClaude++
  }
  if (skill.platforms.includes("codex")) {
    const dst = join(CODEX, skill.name)
    copyTree(src, dst)
    const variant = join(src, "SKILL.codex.md")
    if (skill.divergent && existsSync(variant)) {
      writeFileSync(join(dst, "SKILL.md"), readFileSync(variant))
      nVariant++
    }
    nCodex++
  }
}

console.log(`skills:sync ✓  .claude/skills: ${nClaude}  ·  .agents/skills: ${nCodex} (${nVariant} Codex variants applied)`)
