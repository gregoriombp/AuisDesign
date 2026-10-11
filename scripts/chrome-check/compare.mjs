#!/usr/bin/env node
/**
 * Pixel diff of two shoot.mjs runs. Writes diff-<name>.png next to the second
 * run's shots and exits 1 when anything differs.
 *
 *   node scripts/chrome-check/compare.mjs before after
 *   CLIPS=1 node scripts/chrome-check/compare.mjs after bare
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { loadPlaywright, outDir } from "./lib.mjs"

const [a, b] = process.argv.slice(2).filter((x) => !x.startsWith("--"))
if (!a || !b) {
  console.error("usage: compare.mjs <label-a> <label-b>")
  process.exit(2)
}
const { compare } = loadPlaywright()
const dirA = outDir(a)
const dirB = outDir(b)
const names = JSON.parse(readFileSync(path.join(dirA, process.env.CLIPS === "1" ? "clips.json" : "shots.json"), "utf8"))

let same = 0
for (const name of names) {
  const fileB = path.join(dirB, `${name}.png`)
  if (!existsSync(fileB)) {
    console.log(`MISSING ${name}`)
    continue
  }
  const result = compare(readFileSync(fileB), readFileSync(path.join(dirA, `${name}.png`)), { threshold: 0.1 })
  if (!result) {
    same++
    continue
  }
  if (result.diff) writeFileSync(path.join(dirB, `diff-${name}.png`), result.diff)
  console.log(`DIFF ${name}: ${result.errorMessage}`)
}
console.log(`${same}/${names.length} identical`)
process.exit(same === names.length ? 0 : 1)
