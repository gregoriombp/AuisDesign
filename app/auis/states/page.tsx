import type { Metadata } from "next"
import { readdirSync, statSync } from "fs"
import { join } from "path"

import { StatesMatrixPage } from "./_components/StatesMatrixPage"

export const metadata: Metadata = {
  title: "State Mode — Auis",
  description:
    "State Mode coverage and a matrix with every scenario of each screen, side by side.",
}

// Product screens = every page.tsx outside the builder layer (app/auis) and
// the serverless routes (app/api). Counted on the filesystem at build/dev
// time — the coverage denominator never needs manual upkeep.
function countProductPages(): number {
  const appDir = join(process.cwd(), "app")
  const excludedTopLevel = new Set(["auis", "api"])
  let count = 0
  const walk = (dir: string, depth: number) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) {
        if (depth === 0 && excludedTopLevel.has(name)) continue
        walk(full, depth + 1)
      } else if (name === "page.tsx") {
        count++
      }
    }
  }
  walk(appDir, 0)
  return count
}

export default function AuisStatesRoute() {
  return <StatesMatrixPage totalProductPages={countProductPages()} />
}
