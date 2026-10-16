// ds:check is what CI and the agent hook lean on, so these tests pin its contract:
// the exit codes (0 clean, 2 primary findings, 1 the scan failed), the ignore
// config with its mandatory reasons, the inline disables, and the hook's two
// passes (per edit, then once per turn without repeating itself).
//
// Each test builds a throwaway repo holding the real scripts and a few fixture
// files, so nothing here depends on Auis's own app/ or components/.

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { tmpdir } from "node:os"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const temps = []

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true })
})

function write(root, rel, contents) {
  const p = join(root, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, contents)
}

const CLEAN = `export function Ok() {\n  return <div className="bg-raised p-4 rounded-lg" />\n}\n`
const BAD = `export function Bad() {\n  return <div className="bg-[#fff] p-4" />\n}\n`

/** A repo with the real scripts, a component map, and the given files. */
function makeRepo(files = {}) {
  const root = mkdtempSync(join(tmpdir(), "auis-dscheck-"))
  temps.push(root)
  for (const name of ["ds-check.mjs", "ds-check-hook.mjs"]) {
    cpSync(join(REPO, "scripts", name), join(root, "scripts", name))
  }
  write(root, "docs/component-map.md", "# map\n")
  for (const [rel, contents] of Object.entries(files)) {
    write(root, rel, typeof contents === "string" ? contents : JSON.stringify(contents))
  }
  return root
}

function cli(root, args = [], env = {}) {
  const run = spawnSync(process.execPath, [join(root, "scripts", "ds-check.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  })
  return { code: run.status, stdout: run.stdout, stderr: run.stderr }
}

function json(root, args = []) {
  const run = cli(root, ["--json", ...args])
  return { code: run.code, report: JSON.parse(run.stdout) }
}

function hook(root, event, input, env = {}) {
  const run = spawnSync(process.execPath, [join(root, "scripts", "ds-check-hook.mjs"), event], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify(input),
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: root,
      AUIS_DS_CHECK_STATE_DIR: join(root, ".state"),
      ...env,
    },
  })
  return { code: run.status, stderr: run.stderr }
}

describe("ds:check exit codes", () => {
  it("exits 0 when nothing is wrong", () => {
    const root = makeRepo({ "components/Ok.tsx": CLEAN })
    assert.equal(cli(root).code, 0)
  })

  it("exits 2 on a primary finding and reports it as JSON", () => {
    const root = makeRepo({ "components/Bad.tsx": BAD })
    const { code, report } = json(root)
    assert.equal(code, 2)
    assert.equal(report.summary.primary, 1)
    assert.deepEqual(
      report.findings.map((f) => [f.rule, f.file, f.line, f.match]),
      [["hardcoded-color", "components/Bad.tsx", 2, "bg-[#fff]"]],
    )
  })

  it("keeps info-only notes at exit 0", () => {
    const root = makeRepo({ "components/Wide.tsx": `export const W = () => <div className="w-[300px]" />\n` })
    const { code, report } = json(root)
    assert.equal(code, 0)
    assert.equal(report.summary.info, 1)
  })

  it("exits 1 when a target does not exist", () => {
    const root = makeRepo()
    const run = cli(root, ["components/Nope.tsx"])
    assert.equal(run.code, 1)
    assert.match(run.stderr, /target not found/)
  })

  it("checks only the files it is given", () => {
    const root = makeRepo({ "components/Ok.tsx": CLEAN, "components/Bad.tsx": BAD })
    assert.equal(cli(root, ["components/Ok.tsx"]).code, 0)
    assert.equal(cli(root, ["components/Bad.tsx"]).code, 2)
  })

  it("skips a target outside the scanned folders", () => {
    const root = makeRepo({ "kit/ui/Thing.tsx": BAD })
    const { code, report } = json(root, ["kit/ui/Thing.tsx"])
    assert.equal(code, 0)
    assert.equal(report.skipped[0].file, "kit/ui/Thing.tsx")
  })

  it("--tier edit leaves out the end-of-turn rules", () => {
    const palette = `export const P = () => <div className="bg-blue-500" />\n`
    const root = makeRepo({ "components/Palette.tsx": palette })
    assert.equal(cli(root).code, 2)
    assert.equal(cli(root, ["--tier", "edit"]).code, 0)
  })
})

describe("ds:check ignore config", () => {
  it("ignoreFiles silences only the rules it names", () => {
    const svg = `export const Logo = () => <svg className="bg-[#fff]" viewBox="0 0 1 1" />\n`
    const root = makeRepo({
      "components/BrandLogo.tsx": svg,
      ".auis/ds-check.json": {
        ignoreFiles: [{ path: "**/*Logo.tsx", rules: ["raw-svg"], reason: "our own mark" }],
      },
    })
    const { code, report } = json(root)
    assert.equal(code, 2)
    assert.deepEqual(report.findings.map((f) => f.rule), ["hardcoded-color"])
    assert.equal(report.suppressed[0].rule, "raw-svg")
    assert.equal(report.suppressed[0].reason, "our own mark")
  })

  it("ignoreValues matches rule + value, and the file when given", () => {
    const root = makeRepo({
      "components/A.tsx": BAD,
      "components/B.tsx": BAD,
      ".auis/ds-check.json": {
        ignoreValues: [{ rule: "hardcoded-color", value: "bg-[#fff]", file: "components/A.tsx", reason: "print sheet" }],
      },
    })
    const { report } = json(root)
    assert.deepEqual(report.findings.map((f) => f.file), ["components/B.tsx"])
    assert.equal(report.suppressed[0].by, "config:ignoreValues")
  })

  it("ignoreRules turns a rule off everywhere", () => {
    const root = makeRepo({
      "components/Bad.tsx": BAD,
      ".auis/ds-check.json": { ignoreRules: [{ rule: "hardcoded-color", reason: "migrating" }] },
    })
    assert.equal(cli(root).code, 0)
  })

  it("refuses an exception without a reason (exit 1)", () => {
    const root = makeRepo({
      "components/Bad.tsx": BAD,
      ".auis/ds-check.json": { ignoreRules: [{ rule: "hardcoded-color" }] },
    })
    const run = cli(root)
    assert.equal(run.code, 1)
    assert.match(run.stderr, /"reason" is required/)
  })

  it("refuses an unknown rule id (exit 1)", () => {
    const root = makeRepo({
      ".auis/ds-check.json": { ignoreRules: [{ rule: "hardcoded-colour", reason: "typo" }] },
    })
    assert.equal(cli(root).code, 1)
  })

  it("refuses invalid JSON (exit 1)", () => {
    const root = makeRepo({ ".auis/ds-check.json": "{ nope" })
    assert.equal(cli(root).code, 1)
  })
})

describe("ds:check inline disables", () => {
  it("ds-check-disable-next-line in a JSX comment covers the line below", () => {
    const src = [
      "export function C() {",
      "  return (",
      "    <div>",
      "      {/* ds-check-disable-next-line hardcoded-color -- brand-mandated print color */}",
      '      <p className="bg-[#fff]" />',
      '      <p className="text-[#000]" />',
      "    </div>",
      "  )",
      "}",
    ].join("\n")
    const root = makeRepo({ "components/C.tsx": src })
    const { code, report } = json(root)
    assert.equal(code, 2)
    assert.deepEqual(report.findings.map((f) => f.line), [6])
    assert.equal(report.suppressed[0].reason, "brand-mandated print color")
  })

  it("ds-check-disable-line covers its own line", () => {
    const src = `export const C = () => <p className="bg-[#fff]" /> // ds-check-disable-line\n`
    assert.equal(cli(makeRepo({ "components/C.tsx": src })).code, 0)
  })

  it("ds-check-disable covers the whole file, only for the rules it names", () => {
    const src = [
      "// ds-check-disable hardcoded-color -- generated from the brand book",
      BAD,
      `export const S = () => <svg viewBox="0 0 1 1" />`,
    ].join("\n")
    const { report } = json(makeRepo({ "components/C.tsx": src }))
    assert.deepEqual(report.findings.map((f) => f.rule), ["raw-svg"])
  })

  it("a directive for another rule does not silence this one", () => {
    const src = `export const C = () => <p className="bg-[#fff]" /> // ds-check-disable-line raw-svg\n`
    assert.equal(cli(makeRepo({ "components/C.tsx": src })).code, 2)
  })
})

describe("ds:check hook", () => {
  const post = (root, rel, session = "s1") =>
    hook(root, "post", {
      session_id: session,
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: { file_path: join(root, rel) },
      cwd: root,
    })
  const stop = (root, extra = {}, session = "s1") =>
    hook(root, "stop", { session_id: session, hook_event_name: "Stop", stop_hook_active: false, ...extra })

  it("post: flags bg-[#fff] in the edited file (exit 2, message on stderr)", () => {
    const root = makeRepo({ "components/Bad.tsx": BAD })
    const run = post(root, "components/Bad.tsx")
    assert.equal(run.code, 2)
    assert.match(run.stderr, /components\/Bad\.tsx:2 {2}\[hardcoded-color\]/)
  })

  it("post: stays quiet on a clean file", () => {
    const root = makeRepo({ "components/Ok.tsx": CLEAN })
    const run = post(root, "components/Ok.tsx")
    assert.equal(run.code, 0)
    assert.equal(run.stderr, "")
  })

  it("post: ignores files it does not check and the off switch", () => {
    const root = makeRepo({ "components/Bad.tsx": BAD, "docs/notes.md": "bg-[#fff]" })
    assert.equal(post(root, "docs/notes.md").code, 0)
    const off = hook(root, "post", { session_id: "s1", tool_input: { file_path: join(root, "components/Bad.tsx") } }, { AUIS_DS_CHECK_HOOK: "0" })
    assert.equal(off.code, 0)
  })

  it("post: only the objective rules — a raw palette color waits for the turn", () => {
    const palette = `export const P = () => <div className="bg-blue-500" />\n`
    const root = makeRepo({ "components/P.tsx": palette })
    assert.equal(post(root, "components/P.tsx").code, 0)
    const end = stop(root)
    assert.equal(end.code, 2)
    assert.match(end.stderr, /raw-tailwind-color/)
  })

  it("stop: does not repeat what the edit hook already reported", () => {
    const root = makeRepo({ "components/Bad.tsx": BAD })
    assert.equal(post(root, "components/Bad.tsx").code, 2)
    assert.equal(stop(root).code, 0)
  })

  it("stop: reports a finding once, then lets the turn end", () => {
    const palette = `export const P = () => <div className="bg-blue-500" />\n`
    const root = makeRepo({ "components/P.tsx": palette })
    post(root, "components/P.tsx")
    assert.equal(stop(root).code, 2)
    assert.equal(stop(root).code, 0)
  })

  it("stop: steps aside when a stop hook already continued the turn", () => {
    const palette = `export const P = () => <div className="bg-blue-500" />\n`
    const root = makeRepo({ "components/P.tsx": palette })
    post(root, "components/P.tsx")
    assert.equal(stop(root, { stop_hook_active: true }).code, 0)
  })

  it("stop: sessions do not share state", () => {
    const palette = `export const P = () => <div className="bg-blue-500" />\n`
    const root = makeRepo({ "components/P.tsx": palette })
    post(root, "components/P.tsx", "a")
    assert.equal(stop(root, {}, "b").code, 0) // b touched nothing
    assert.equal(stop(root, {}, "a").code, 2)
  })

  it("never blocks the agent when the config is broken", () => {
    const root = makeRepo({ "components/Bad.tsx": BAD, ".auis/ds-check.json": "{ nope" })
    const run = post(root, "components/Bad.tsx")
    assert.equal(run.code, 0)
    assert.match(run.stderr, /hook skipped/)
  })
})

describe("ds:check hook install", () => {
  const settings = (root) => JSON.parse(readFileSync(join(root, ".claude", "settings.local.json"), "utf8"))

  it("on/off touches only its own entries in settings.local.json, idempotently", () => {
    const root = makeRepo({
      ".claude/settings.local.json": {
        permissions: { allow: ["Bash(ls)"] },
        hooks: { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo mine" }] }] },
      },
    })
    assert.equal(hook(root, "on", {}).code, 0)
    assert.equal(hook(root, "on", {}).code, 0)
    const on = settings(root)
    assert.deepEqual(on.permissions, { allow: ["Bash(ls)"] })
    assert.equal(on.hooks.PostToolUse.length, 2)
    assert.equal(on.hooks.Stop.length, 1)
    assert.match(on.hooks.PostToolUse[1].hooks[0].command, /ds-check-hook\.mjs" post$/)
    assert.equal(on.hooks.PostToolUse[1].matcher, "Edit|Write|MultiEdit")

    assert.equal(hook(root, "off", {}).code, 0)
    const off = settings(root)
    assert.deepEqual(off.hooks, { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo mine" }] }] })
    assert.deepEqual(off.permissions, { allow: ["Bash(ls)"] })
  })

  it("refuses to rewrite a settings file it cannot parse", () => {
    const root = makeRepo({ ".claude/settings.local.json": "{ nope" })
    assert.equal(hook(root, "on", {}).code, 1)
    assert.equal(readFileSync(join(root, ".claude", "settings.local.json"), "utf8"), "{ nope")
  })
})
