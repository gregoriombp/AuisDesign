import { spawn } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const BRIDGE_DIR = resolve(ROOT, "review-bridge")
const HOST = process.env.AUIS_REVIEW_HOST || "127.0.0.1"
const PORT = process.env.AUIS_REVIEW_PORT || "9878"
const HEALTH_URL = `http://${HOST}:${PORT}/health`

async function isHealthy() {
  try {
    const res = await fetch(HEALTH_URL, {
      signal: AbortSignal.timeout(800),
    })
    if (!res.ok) return false
    const health = await res.json()
    return health?.service === "auis-review-bridge"
  } catch {
    return false
  }
}

if (await isHealthy()) {
  console.log(`review-bridge already running at ${HEALTH_URL}`)
  process.exit(0)
}

const bridge = spawn("npm", ["--prefix", BRIDGE_DIR, "start"], {
  stdio: "inherit",
  env: {
    ...process.env,
    AUIS_REVIEW_HOST: HOST,
    AUIS_REVIEW_PORT: PORT,
  },
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    bridge.kill(signal)
  })
}

bridge.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
