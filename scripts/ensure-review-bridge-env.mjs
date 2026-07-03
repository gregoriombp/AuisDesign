import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { randomBytes } from "node:crypto"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const BRIDGE_DIR = resolve(ROOT, "review-bridge")
const BRIDGE_ENV = resolve(ROOT, "review-bridge/.env")
const FRONTEND_ENV = resolve(ROOT, ".env.local")
const BRIDGE_URL = "http://127.0.0.1:9878"
const BRIDGE_HOST = "127.0.0.1"

function readEnv(file) {
  if (!existsSync(file)) return ""
  return readFileSync(file, "utf8")
}

function getEnvValue(contents, key) {
  const line = contents
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${key}=`))
  return line ? line.slice(key.length + 1) : undefined
}

function upsertEnv(file, updates, header) {
  const contents = readEnv(file)
  const keys = new Set(Object.keys(updates))
  const kept = contents
    .split(/\r?\n/)
    .filter((line) => {
      if (line === header) return false
      const eq = line.indexOf("=")
      if (eq === -1) return true
      return !keys.has(line.slice(0, eq))
    })
    .join("\n")
    .trimEnd()
  const block = [
    header,
    ...Object.entries(updates).map(([key, value]) => `${key}=${value}`),
  ].join("\n")
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${kept ? `${kept}\n\n` : ""}${block}\n`)
}

if (!existsSync(resolve(BRIDGE_DIR, "node_modules"))) {
  console.log("installing review-bridge dependencies...")
  const install = spawnSync("npm", ["--prefix", BRIDGE_DIR, "install"], {
    stdio: "inherit",
  })
  if (install.status !== 0) {
    process.exit(install.status ?? 1)
  }
}

const bridgeEnv = readEnv(BRIDGE_ENV)
const existingToken = getEnvValue(bridgeEnv, "AUIS_REVIEW_TOKEN")
const token = existingToken || randomBytes(32).toString("hex")

upsertEnv(
  BRIDGE_ENV,
  {
    AUIS_REVIEW_TOKEN: token,
    AUIS_REVIEW_HOST: BRIDGE_HOST,
  },
  "# Review Bridge — local-only. Managed by npm run dev."
)

upsertEnv(
  FRONTEND_ENV,
  {
    NEXT_PUBLIC_AUIS_REVIEW_BRIDGE_URL: BRIDGE_URL,
    NEXT_PUBLIC_AUIS_REVIEW_TOKEN: token,
  },
  "# Review Bridge — local agent queue. Managed by npm run dev."
)

console.log(`review-bridge env ready at ${BRIDGE_URL}`)
