// skills-sync runs inside repositories that are not Auis's — the template ships
// it, so `npm install` in someone else's project executes it. These tests pin the
// only behaviour that matters there: it must never destroy a skill it did not write.
//
// Each test builds a throwaway repo (the real script, a two-skill registry) and
// runs the script in it, so nothing here depends on Auis's own skills/ tree.

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"
import { tmpdir } from "node:os"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const SCRIPT = join(REPO, "scripts", "skills-sync.mjs")
const temps = []

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true })
})

function write(root, rel, contents) {
  const p = join(root, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, contents)
}

/** A repo that holds the real script and a registry of two skills, one of which
 *  ("commit") is deliberately a name a host is likely to have already used. */
function makeRepo(skills = ["auis-demo", "commit"]) {
  const root = mkdtempSync(join(tmpdir(), "auis-sync-"))
  temps.push(root)
  mkdirSync(join(root, "scripts"), { recursive: true })
  cpSync(SCRIPT, join(root, "scripts", "skills-sync.mjs"))
  for (const name of skills) write(root, `skills/support/${name}/SKILL.md`, `auis ${name}\n`)
  write(
    root,
    "skills/registry.json",
    JSON.stringify({
      version: 1,
      skills: skills.map((name) => ({
        name,
        capability: "support",
        platforms: ["claude", "codex"],
        divergent: false,
      })),
    })
  )
  return root
}

/** Returns stdout AND stderr: the skip notice is a console.warn. */
function sync(root) {
  const run = spawnSync(process.execPath, [join(root, "scripts", "skills-sync.mjs")], {
    cwd: root,
    encoding: "utf8",
  })
  assert.equal(run.status, 0, `skills-sync exited ${run.status}: ${run.stderr}`)
  return `${run.stdout}${run.stderr}`
}

/** Every file under `dir` as `relative path -> contents`, for byte comparison. */
function snapshot(root, dir) {
  const base = join(root, dir)
  const out = {}
  const walk = (d) => {
    let entries
    try {
      entries = readdirSync(d)
    } catch {
      return
    }
    for (const entry of entries) {
      const p = join(d, entry)
      if (statSync(p).isDirectory()) walk(p)
      else out[relative(base, p).split(sep).join("/")] = readFileSync(p, "utf8")
    }
  }
  walk(base)
  return out
}

describe("skills-sync ownership", () => {
  it("leaves a host skill it never wrote completely alone", () => {
    const root = makeRepo()
    write(root, ".claude/skills/my-skill/SKILL.md", "host only\n")

    sync(root)

    assert.equal(readFileSync(join(root, ".claude/skills/my-skill/SKILL.md"), "utf8"), "host only\n")
    assert.equal(readFileSync(join(root, ".claude/skills/auis-demo/SKILL.md"), "utf8"), "auis auis-demo\n")
  })

  it("skips — never overwrites — a host skill whose name collides with one of ours", () => {
    const root = makeRepo()
    write(root, ".claude/skills/commit/SKILL.md", "host version\n")

    const out = sync(root)

    assert.equal(readFileSync(join(root, ".claude/skills/commit/SKILL.md"), "utf8"), "host version\n")
    assert.match(out, /skipped 1/)
    const manifest = JSON.parse(readFileSync(join(root, ".auis/skills-manifest.json"), "utf8"))
    assert.ok(!manifest.claude.includes("commit"), "a skipped skill must not be claimed in the manifest")
  })

  it("is idempotent — a second run changes nothing", () => {
    const root = makeRepo()
    write(root, ".claude/skills/my-skill/SKILL.md", "host only\n")
    write(root, ".claude/skills/commit/SKILL.md", "host version\n")

    sync(root)
    const first = { claude: snapshot(root, ".claude"), agents: snapshot(root, ".agents") }
    sync(root)
    const second = { claude: snapshot(root, ".claude"), agents: snapshot(root, ".agents") }

    assert.deepEqual(second, first)
  })

  it("adopts an install that predates the manifest, by content, without deleting", () => {
    const root = makeRepo()
    // What the previous (manifest-less) generation of this script would have left.
    write(root, ".claude/skills/auis-demo/SKILL.md", "auis auis-demo\n")

    const out = sync(root)

    assert.ok(!/skipped/.test(out), "identical contents are ours — adopt, do not skip")
    const manifest = JSON.parse(readFileSync(join(root, ".auis/skills-manifest.json"), "utf8"))
    assert.ok(manifest.claude.includes("auis-demo"))
  })

  it("removes a skill the registry dropped, and only that one", () => {
    const root = makeRepo()
    write(root, ".claude/skills/my-skill/SKILL.md", "host only\n")
    sync(root)

    // Registry shrinks to one skill; "commit" is now ours to remove.
    write(
      root,
      "skills/registry.json",
      JSON.stringify({
        version: 1,
        skills: [{ name: "auis-demo", capability: "support", platforms: ["claude", "codex"], divergent: false }],
      })
    )
    sync(root)

    const names = readdirSync(join(root, ".claude/skills")).sort()
    assert.deepEqual(names, ["auis-demo", "my-skill"])
  })
})
