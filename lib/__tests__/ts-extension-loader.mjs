import { stat } from "node:fs/promises"

// Node's type-stripping runner needs explicit `.ts` extensions on relative
// imports; the codebase omits them (bundler resolution). This loader resolves
// the `@/` alias to the repo root and `@auis/*` to kit/, then tries the `.ts`
// sibling (or a folder's `index.ts`) before falling back to Node's resolution.
const ROOT = new URL("../../", import.meta.url)
const SUFFIXES = [".ts", "/index.ts"]

async function isFile(url) {
  try {
    return (await stat(url)).isFile()
  } catch {
    return false
  }
}

// The Review Bridge packages (docs/review-bridge-packages-plan.md) resolve to
// their source in kit/, the same mapping as tsconfig's `paths`.
const KIT = /^@auis\/(core|server|next)(\/.*)?$/

export async function resolve(specifier, context, nextResolve) {
  let base = null
  const kit = KIT.exec(specifier)
  if (kit) {
    base = new URL(`kit/${kit[1]}/src${kit[2] ?? "/index"}`, ROOT)
  } else if (specifier.startsWith("@/")) {
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
  // `next` ships no exports map, so Node's ESM resolver needs the `.js` the
  // bundler adds on its own (`next/server` → `next/server.js`).
  if (specifier.startsWith("next/") && !/\.[cm]?js$/.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.js`, context)
    } catch {
      // No `.js` sibling: let Node's normal resolution decide.
    }
  }
  return nextResolve(specifier, context)
}
