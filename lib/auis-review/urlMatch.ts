// Review Mode URL matching.
//
// A pin is scoped by the WHOLE URL, on purpose: `?state=`, `?status=` and the
// like are State Mode axes, and each value is a different screen that deserves
// its own comments. So the comparison must NOT be fuzzy.
//
// Two allowances, and only these two, because both are verifiable:
//
//  1. Params that say HOW TO GET THERE or HOW TO FRAME, not WHICH SCREEN it is.
//     `reviewCommentId` is the permalink, `ge` is a click recipe (State Mode
//     already treats it as ephemeral) and `chrome=0` only hides the builder bar.
//  2. Routes that became redirects. A LITERAL table mirroring the redirects that
//     exist — not a generic matcher, which would end up equating `/a/x/sub` with
//     `/a/x`.
//
// Without this, a comment left on a route that was later unified stays orphaned
// forever: the content moved address and an exact string comparison never
// matches again.

/** Params that do not distinguish one screen from another. */
const EPHEMERAL_PARAMS = ["reviewCommentId", "ge", "chrome"]

/**
 * Routes that became redirects, from the old address to the new one. Mirror the
 * `redirect()` calls of your pages and the rules in `next.config.ts`. `:id`
 * matches one segment. Add an entry here whenever a route dies or is unified —
 * that is what keeps the comments left on the old address alive.
 */
const PATH_REWRITES: { from: string; to: string }[] = []

function rewritePath(pathname: string): string {
  const have = pathname.split("/").filter(Boolean)
  for (const rule of PATH_REWRITES) {
    const from = rule.from.split("/").filter(Boolean)
    if (from.length !== have.length) continue
    const bound: Record<string, string> = {}
    const hit = from.every((part, i) => {
      if (part.startsWith(":")) {
        bound[part.slice(1)] = have[i]
        return true
      }
      return part === have[i]
    })
    if (!hit) continue
    return (
      "/" +
      rule.to
        .split("/")
        .filter(Boolean)
        .map((part) => (part.startsWith(":") ? bound[part.slice(1)] : part))
        .join("/")
    )
  }
  return pathname
}

/**
 * Canonical form of a comment URL: the path already resolved through the known
 * redirects, without the ephemeral params, and with the keys in a stable order —
 * because `?a=1&b=2` and `?b=2&a=1` are the same screen and would otherwise be
 * two different strings.
 */
export function canonicalizeReviewUrl(url: string): string {
  const [rawPath = "", rawQuery = ""] = (url ?? "").split("?", 2)
  const pathname = rewritePath(rawPath)
  const params = new URLSearchParams(rawQuery)
  for (const key of EPHEMERAL_PARAMS) params.delete(key)
  const entries = Array.from(params.entries()).sort(([a], [b]) =>
    a === b ? 0 : a < b ? -1 : 1,
  )
  const search = new URLSearchParams(entries).toString()
  return search ? `${pathname}?${search}` : pathname
}

/** Do two addresses point at the same review screen? */
export function isSameReviewUrl(a: string, b: string): boolean {
  return canonicalizeReviewUrl(a) === canonicalizeReviewUrl(b)
}
