/** A workspace's location and its explicit navigation boundary. Remote opening is post-v1. */
export type Workspace =
  | { kind: "local"; path: string; origin: string }
  | { kind: "remote"; url: string; allowedOrigins: string[] };

export function webOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isLoopback(value: string): boolean {
  try {
    return (
      webOrigin(value) !== null &&
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname)
    );
  } catch {
    return false;
  }
}

export function isAllowedNavigation(
  workspace: Workspace,
  value: string,
): boolean {
  const origin = webOrigin(value);
  if (!origin) return false;
  if (workspace.kind === "local")
    return isLoopback(value) && origin === webOrigin(workspace.origin);
  return [workspace.url, ...workspace.allowedOrigins].some(
    (allowed) => origin === webOrigin(allowed),
  );
}

/** IPC accepts a path, never an origin. Check the parsed URL too (backslashes normalise to slashes). */
export function workspaceRoute(
  workspace: Workspace,
  route: string,
): string | null {
  if (
    !route.startsWith("/") ||
    route.startsWith("//") ||
    /[\\\x00-\x20]/.test(route)
  )
    return null;
  try {
    const base = workspace.kind === "local" ? workspace.origin : workspace.url;
    const url = new URL(route, base).href;
    return isAllowedNavigation(workspace, url) ? url : null;
  } catch {
    return null;
  }
}

/** Kept visible while running: a skill must target this project's bridge. */
export function bridgeNotice(server: {
  status: string;
  url?: string;
  port?: number;
}): string | null {
  return server.status === "running" &&
    server.port !== 3000 &&
    server.url &&
    isLoopback(server.url)
    ? `export BRIDGE_BASE=${webOrigin(server.url)}`
    : null;
}
