import { access } from "node:fs/promises"

// Node's type-stripping runner needs explicit `.ts` extensions on relative
// imports; the codebase omits them (bundler resolution). This loader tries the
// `.ts` sibling first and falls back to Node's normal resolution.
export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.[a-z0-9]+$/i.test(specifier)
  ) {
    try {
      const candidate = new URL(`${specifier}.ts`, context.parentURL)
      await access(candidate)
      return nextResolve(candidate.href, context)
    } catch {
      // Delegate normal package/directory resolution to Node.
    }
  }
  return nextResolve(specifier, context)
}
