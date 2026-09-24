import { readdirSync, readFileSync, statSync } from "fs"
import { join, relative } from "path"

/**
 * The product's pages — every route outside the builder (`app/auis`) and the
 * serverless routes (`app/api`). Auis ships none: `app/page.tsx` only forwards
 * to the hub, and that redirect is the builder's, not a page of the product.
 *
 * Server-only (reads the filesystem). The hub uses it to point the product
 * card at a page that exists; /auis/product uses it to forward there, or to
 * say that there is nothing to open yet.
 */

export type ProductPage = {
  /** The route as the browser sees it: "/" or "/dashboard". */
  href: string
  /** The source file, relative to the project root. */
  file: string
}

const PAGE_FILES = new Set([
  "page.tsx",
  "page.jsx",
  "page.ts",
  "page.js",
  "page.mdx",
  "page.md",
])
const BUILDER_TOP_LEVEL = new Set(["auis", "api"])

/** `app/page.tsx` as shipped: a bare redirect to the hub, not a product page. */
function isHubRedirect(file: string): boolean {
  try {
    return /redirect\(\s*["'`]\/auis["'`]\s*\)/.test(readFileSync(file, "utf8"))
  } catch {
    return false
  }
}

function depthOf(href: string): number {
  return href === "/" ? 0 : href.split("/").length - 1
}

/**
 * Linkable product pages, shallowest first, then alphabetical. Route groups
 * `(name)` add no segment. Private folders `_x`, parallel slots `@x` and
 * dynamic segments `[x]` are skipped: a dynamic route has no URL to link to
 * without a parameter.
 */
export function listProductPages(root: string = process.cwd()): ProductPage[] {
  const pages: ProductPage[] = []

  const walk = (dir: string, segments: string[], depth: number) => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries.sort()) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) {
        if (depth === 0 && BUILDER_TOP_LEVEL.has(name)) continue
        if (name.startsWith("_") || name.startsWith("@") || name.startsWith("[")) continue
        const isGroup = name.startsWith("(") && name.endsWith(")")
        walk(full, isGroup ? segments : [...segments, name], depth + 1)
      } else if (PAGE_FILES.has(name)) {
        const href = "/" + segments.join("/")
        if (href === "/" && isHubRedirect(full)) continue
        pages.push({ href, file: relative(root, full) })
      }
    }
  }

  walk(join(root, "app"), [], 0)
  return pages.sort(
    (a, b) => depthOf(a.href) - depthOf(b.href) || a.href.localeCompare(b.href),
  )
}

/** The page the hub's product card opens, or null while the product has none. */
export function findFirstProductPage(root?: string): ProductPage | null {
  return listProductPages(root)[0] ?? null
}
