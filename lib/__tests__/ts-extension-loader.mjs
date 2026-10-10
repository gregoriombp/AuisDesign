import { stat } from "node:fs/promises"

// Node's type-stripping runner needs explicit `.ts` extensions on relative
// imports; the codebase omits them (bundler resolution). This loader resolves
// the `@/` alias to the repo root, then tries the `.ts` sibling (or a folder's
// `index.ts`) before falling back to Node's normal resolution.
const ROOT = new URL("../../", import.meta.url)
const SUFFIXES = [".ts", "/index.ts"]

async function isFile(url) {
  try {
    return (await stat(url)).isFile()
  } catch {
    return false
  }
}

export async function resolve(specifier, context, nextResolve) {
  let base = null
  if (specifier.startsWith("@/")) {
    base = new URL(specifier.slice(2), ROOT)
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    base = new URL(specifier, context.parentURL)
  }
  if (base && !/\.[a-z0-9]+$/i.test(specifier)) {
    for (const suffix of SUFFIXES) {
      const candidate = new URL(`${base.href}${suffix}`)
      if (await isFile(candidate)) return nextResolve(candidate.href, context)
    }
  }
  if (base) return nextResolve(base.href, context)
  return nextResolve(specifier, context)
}
