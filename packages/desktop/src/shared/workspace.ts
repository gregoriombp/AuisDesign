// Where a project's view may go.
//
// A project window shows one workspace: today a local dev server, later also a
// hosted site with its own login. Either way the rule is the same and it is
// keyed on a list of origins: the view stays on them, and anything else is a
// link for the user's browser. A list, not a single origin, is what leaves
// room for a hosted site's sign-in host.
//
// Origins are compared exactly. `localhost` and `127.0.0.1` on the same port
// are not treated as one: two dev servers can each hold one of them, and a
// loose match would let one project's view land on another project's server.
//
// Pure, no Node and no Electron: both processes and the tests can use it.

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** True for an http(s) page on one of the origins the view is allowed to show. */
export function isAllowedNavigation(url: string, allowedOrigins: readonly string[]): boolean {
  const parsed = parse(url);
  if (!parsed) return false;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  return allowedOrigins.includes(parsed.origin);
}

/** True for a link that may be handed to the user's browser: web pages only, never `file:` or a custom scheme. */
export function isWebLink(url: string): boolean {
  const parsed = parse(url);
  return parsed !== null && (parsed.protocol === "http:" || parsed.protocol === "https:");
}

/**
 * The URL for an in-app route such as `/auis/styleguide`, or null when the
 * route is not a plain path on that origin. The chrome sends routes, never
 * URLs, and this is what keeps a route from becoming a way out.
 */
export function resolveRoute(origin: string, route: string): string | null {
  if (!route.startsWith("/")) return null;
  const base = parse(origin);
  if (!base) return null;
  let target: URL;
  try {
    target = new URL(route, base);
  } catch {
    return null;
  }
  // `//host` and `/\host` are paths to another site, not paths on this one.
  return target.origin === base.origin ? target.toString() : null;
}
