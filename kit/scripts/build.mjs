#!/usr/bin/env node
/**
 * Builds the publishable form of the Review Bridge packages: kit/<name>/dist,
 * plain ES modules plus .d.ts, one file per source file.
 *
 *   node kit/scripts/build.mjs            # all four, in dependency order
 *   node kit/scripts/build.mjs ui         # one, with what it depends on first
 *
 * The Auis app never reads dist/ — it consumes kit/<name>/src through
 * tsconfig `paths`. This is only what `npm pack` / `npm publish` ship.
 *
 * Why file by file and not a bundle: the chrome's client modules start with
 * "use client", which a bundle would merge away, and hosts import subpaths
 * (`@auis/ui/ReviewChrome`, `@auis/core/commandParse`) that must exist as files.
 *
 * Two things tsc leaves undone, done here after it:
 *  - relative imports are extensionless in the source (bundler resolution);
 *    Node's ESM loader needs `./x.js` or `./x/index.js`, so they are rewritten;
 *  - chrome.css is not a TypeScript file, so it is copied next to the module
 *    that imports it.
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const KIT = path.resolve(import.meta.dirname, "..")
const ROOT = path.resolve(KIT, "..")
const ORDER = ["core", "server", "ui", "next"]
const DEPENDS = { core: [], server: ["core"], ui: ["core"], next: ["core", "server", "ui"] }

function closure(names) {
  const want = new Set()
  const add = (n) => {
    for (const d of DEPENDS[n]) add(d)
    want.add(n)
  }
  names.forEach(add)
  return ORDER.filter((n) => want.has(n))
}

function tsc(name) {
  const dir = path.join(KIT, name)
  const dist = path.join(dir, "dist")
  fs.rmSync(dist, { recursive: true, force: true })

  // Other kit packages resolve to their already-built declarations, so the
  // emitted .d.ts keep `@auis/core/...` as package specifiers.
  const paths = {}
  for (const dep of DEPENDS[name]) {
    paths[`@auis/${dep}`] = [`../${dep}/dist/index.d.ts`]
    paths[`@auis/${dep}/*`] = [`../${dep}/dist/*`]
  }
  const config = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      lib: ["DOM", "DOM.Iterable", "ES2023"],
      types: ["node"],
      typeRoots: [path.join(ROOT, "node_modules/@types")],
      strict: true,
      skipLibCheck: true,
      esModuleInterop: true,
      isolatedModules: true,
      declaration: true,
      rootDir: "src",
      outDir: "dist",
      baseUrl: ".",
      paths,
    },
    include: ["src/**/*.ts", "src/**/*.tsx"],
    exclude: ["src/**/__tests__/**"],
  }
  const configFile = path.join(dir, "tsconfig.build.json")
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2))
  try {
    const result = spawnSync(
      process.execPath,
      [path.join(ROOT, "node_modules/typescript/bin/tsc"), "-p", configFile],
      { cwd: dir, stdio: "inherit" },
    )
    if (result.status !== 0) throw new Error(`tsc failed for @auis/${name}`)
  } finally {
    fs.rmSync(configFile, { force: true })
  }
  return dist
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']*)\2/g

/** `./x` → `./x.js` or `./x/index.js`, whichever exists in dist. */
export function rewriteSpecifiers(source, file) {
  return source.replace(SPECIFIER, (match, lead, quote, spec) => {
    if (/\.(m?js|json|css)$/.test(spec)) return match
    const base = path.resolve(path.dirname(file), spec)
    const suffix = fs.existsSync(`${base}.js`)
      ? ".js"
      : fs.existsSync(path.join(base, "index.js"))
        ? "/index.js"
        : null
    if (!suffix) throw new Error(`${path.relative(KIT, file)}: cannot resolve ${spec}`)
    return `${lead}${quote}${spec}${suffix}${quote}`
  })
}

function finish(name, dist) {
  for (const file of walk(dist)) {
    if (!/\.(js|d\.ts)$/.test(file)) continue
    const before = fs.readFileSync(file, "utf8")
    const after = rewriteSpecifiers(before, file)
    if (after !== before) fs.writeFileSync(file, after)
  }
  if (name === "ui") {
    fs.mkdirSync(path.join(dist, "styles"), { recursive: true })
    fs.copyFileSync(
      path.join(KIT, "ui/src/styles/chrome.css"),
      path.join(dist, "styles/chrome.css"),
    )
  }
}

export function build(names = ORDER) {
  for (const name of closure(names)) {
    const dist = tsc(name)
    finish(name, dist)
    process.stdout.write(`  built @auis/${name}\n`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const names = process.argv.slice(2)
  for (const n of names) {
    if (!ORDER.includes(n)) {
      process.stderr.write(`unknown package: ${n} (one of ${ORDER.join(", ")})\n`)
      process.exit(1)
    }
  }
  build(names.length ? names : ORDER)
}
