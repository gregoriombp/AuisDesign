#!/usr/bin/env node
/**
 * Builds the kit and loads what it built the way an installed app would: from
 * node_modules/@auis/*, through each package's `exports`, with Node's own ESM
 * resolver (no tsconfig paths, no bundler). Catches a missing `.js` on an
 * import, a subpath the exports map does not cover, or a file left out of dist.
 *
 *   npm run kit:smoke
 *
 * The chrome itself (@auis/ui, @auis/next/client) imports CSS and Next's
 * extensionless entry points, which only a bundler resolves, so for those it
 * checks that the files exist; the server half is imported and answers a
 * request.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { build } from "./build.mjs"

const KIT = path.resolve(import.meta.dirname, "..")

build()

const app = fs.mkdtempSync(path.join(os.tmpdir(), "auis-kit-smoke-"))
try {
  fs.writeFileSync(path.join(app, "package.json"), '{ "name": "smoke", "type": "module" }\n')
  const scope = path.join(app, "node_modules", "@auis")
  fs.mkdirSync(scope, { recursive: true })
  for (const name of ["core", "server", "ui", "next"]) {
    fs.symlinkSync(path.join(KIT, name), path.join(scope, name), "dir")
  }

  const entry = path.join(app, "smoke.mjs")
  fs.writeFileSync(
    entry,
    `
import assert from "node:assert/strict"
import { parseReviewCommand } from "@auis/core"
import { cssPath } from "@auis/core/elementAnchor"
import { createReviewHandler } from "@auis/server"
import { createReviewRoute } from "@auis/next"
import { bridgeBase } from "@auis/server/bin/mention-cli.mjs"

assert.equal(typeof cssPath, "function")
assert.deepEqual(parseReviewCommand("hi @Claude").mentions, ["claude"])
assert.equal(bridgeBase({}), "http://127.0.0.1:3000")
const handle = createReviewHandler({ dataDir: "data", backupDir: "backups" })
const res = await handle(new Request("http://127.0.0.1/api/review-bridge/health"))
assert.equal(res.status, 200)
assert.equal((await res.json()).ok, true)
assert.equal(typeof createReviewRoute().GET, "function")
`,
  )
  const { spawnSync } = await import("node:child_process")
  const run = spawnSync(
    process.execPath,
    // Resolve from the symlinks' place (app/node_modules), as an install
    // would, not from kit/ where they point.
    ["--preserve-symlinks", "--preserve-symlinks-main", entry],
    { cwd: app, encoding: "utf8" },
  )
  assert.equal(run.status, 0, `the built kit does not load:\n${run.stderr}`)

  for (const file of [
    "ui/dist/index.js",
    "ui/dist/ReviewChrome.js",
    "ui/dist/styles/chrome.css",
    "next/dist/client.js",
    "next/dist/client.d.ts",
    "server/bin/mention-run.mjs",
    "server/bin/mention-prompt.md",
  ]) {
    assert.ok(fs.existsSync(path.join(KIT, file)), `missing ${file}`)
  }
  for (const file of ["ui/dist/ReviewChrome.js", "next/dist/client.js"]) {
    const src = fs.readFileSync(path.join(KIT, file), "utf8")
    assert.match(src, /^"use client";/, `${file} lost its "use client"`)
  }
  process.stdout.write("  the built kit loads from node_modules\n")
} finally {
  fs.rmSync(app, { recursive: true, force: true })
}
