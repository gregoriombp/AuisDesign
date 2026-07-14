#!/usr/bin/env node
// Auis — regenerate skills/registry.json + skills/CATALOG.md from the skills/ tree.
// Run: npm run skills:catalog

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SK = join(ROOT, "skills")

// Curation metadata. Edit here when adding/curating skills.
const COWORK = new Set(["auis-foundation", "auis-component", "auis-page", "auis-audit", "auis-flow", "auis-handoff"])
const RECOMMENDED = new Set([...COWORK, "auis-review-bridge-solve", "auis-ux-writing"])
const LEGACY = new Set(["design-system-new-component", "design-system-new-page", "setup-design-system-from-cla-design", "setup-design-system-from-reference"])
const CLAUDE_ONLY = new Set(["auis-review-bridge-dispatch", "auis-edit-bridge-solve"])

const CAP_LABELS = {
  "design-system": "Design System",
  "ux-flows": "UX Flows",
  "bridges": "Bridges (review / flow / edit / project)",
  "build": "Build & Handoff",
  "content": "Content / UX Writing",
  "support": "Support",
}
const CAP_ORDER = Object.keys(CAP_LABELS)

function description(p) {
  try {
    const t = readFileSync(p, "utf8")
    let d = (t.match(/^description:\s*(.+)$/m) || [])[1]?.trim() || ""
    if (d === "" || d === ">" || d === "|") {
      const m = t.match(/description:\s*[>|]?\s*\n((?:[ \t]{2,}.*\n)+)/)
      if (m) d = m[1].replace(/\s+/g, " ").trim()
    }
    return d.slice(0, 220)
  } catch { return "" }
}

const caps = readdirSync(SK).filter((c) => !c.startsWith("_") && statSync(join(SK, c)).isDirectory())
const skills = []
for (const cap of caps) {
  for (const name of readdirSync(join(SK, cap))) {
    const dir = join(SK, cap, name)
    if (!statSync(dir).isDirectory()) continue
    skills.push({
      name,
      capability: cap,
      origin: COWORK.has(name) ? "cowork" : "repo",
      platforms: CLAUDE_ONLY.has(name) ? ["claude"] : ["claude", "codex"],
      recommended: RECOMMENDED.has(name),
      legacy: LEGACY.has(name),
      divergent: existsSync(join(dir, "SKILL.codex.md")),
      description: description(join(dir, "SKILL.md")),
    })
  }
}
skills.sort((a, b) => a.capability.localeCompare(b.capability) || a.name.localeCompare(b.name))

writeFileSync(join(SK, "registry.json"), JSON.stringify({ version: 1, generated: new Date().toISOString().slice(0, 10), count: skills.length, skills }, null, 2))

let md = `# Auis Skills — Catalog\n\n> Generated from \`skills/registry.json\` (\`npm run skills:catalog\`). **${skills.length} skills.** Single source of truth in \`skills/<capability>/<name>/\`. The auto-discovery trees \`.claude/skills/\` (Claude Code) and \`.agents/skills/\` (Codex/Cursor) are **generated** by \`npm run skills:sync\`.\n\n**Legend:** 🟣 Claude · 🟠 Codex/Cursor · 🌐 Cowork (generic / zeroed) · ⭐ recommended set · ◐ has a \`SKILL.codex.md\` variant · _legacy_ neutralized.\n\n`
for (const cap of CAP_ORDER) {
  const items = skills.filter((r) => r.capability === cap)
  if (!items.length) continue
  md += `## ${CAP_LABELS[cap]} (${items.length})\n\n| Skill | Platform | Origin | Tags | What it does |\n|---|---|---|---|---|\n`
  for (const r of items) {
    const plat = (r.platforms.includes("claude") ? "🟣" : "") + (r.platforms.includes("codex") ? "🟠" : "") + (r.origin === "cowork" ? "🌐" : "")
    const tags = [r.recommended ? "⭐" : "", r.divergent ? "◐" : "", r.legacy ? "legacy" : ""].filter(Boolean).join(" ") || "—"
    const desc = (r.description || "").replace(/\|/g, "\\|").slice(0, 150)
    md += `| \`${r.name}\` | ${plat} | ${r.origin} | ${tags} | ${desc} |\n`
  }
  md += "\n"
}
md += `---\n\n## Recommended set — the "zeroed" core (ready for any product)\n\n${skills.filter((r) => r.recommended).map((r) => "- `" + r.name + "`" + (r.origin === "cowork" ? " 🌐" : "")).join("\n")}\n\nThe 🌐 ones (origin \`cowork\`) are the **published generic** versions — prefer them when starting from scratch. The \`repo\` ones are richer variants (bridges, ux-flow, audit) taken from real use. Known overlaps: \`auis-foundation\` 🌐 vs \`auis-design-system-foundation\`; \`auis-component\` 🌐 vs \`auis-new-component\`; \`auis-page\` 🌐 vs \`auis-new-page\`; \`auis-audit\` 🌐 vs \`auis-design-system-audit\`.\n\n## Platforms\n\nOf the ${skills.length}: ${skills.filter((r) => r.platforms.includes("codex")).length} on Claude+Codex, ${skills.filter((r) => r.platforms.length === 1).length} Claude-only (\`${skills.filter((r) => r.platforms.length === 1).map((r) => r.name).join("`, `")}\`). ${skills.filter((r) => r.divergent).length} have their own Codex variant (◐).\n`
writeFileSync(join(SK, "CATALOG.md"), md)

console.log(`skills:catalog ✓  ${skills.length} skills · ${skills.filter((r) => r.divergent).length} divergent · ${skills.filter((r) => r.recommended).length} recommended`)
