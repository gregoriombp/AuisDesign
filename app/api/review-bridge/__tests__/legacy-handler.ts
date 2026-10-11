// Dispatches a standard Request to the per-file Next routes under
// app/api/review-bridge, the way Next's router would. It exists only so the
// parity tests (routes.test.ts) can run against the routes as they are BEFORE
// the move into @auis/server; afterwards the same tests run against
// createReviewHandler() and this file goes away.
import { NextRequest } from "next/server";

type RouteModule = Record<
  string,
  (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>
>;

// Static segments first: Next prefers comments/archive over comments/[id].
const TABLE: { pattern: string[]; load: () => Promise<RouteModule> }[] = [
  { pattern: ["health"], load: () => import("../health/route") },
  { pattern: ["version"], load: () => import("../version/route") },
  { pattern: ["session"], load: () => import("../session/route") },
  { pattern: ["agent-settings"], load: () => import("../agent-settings/route") },
  { pattern: ["dispatch-queue"], load: () => import("../dispatch-queue/route") },
  { pattern: ["export"], load: () => import("../export/route") },
  { pattern: ["import"], load: () => import("../import/route") },
  { pattern: ["members"], load: () => import("../members/route") },
  { pattern: ["reviewers"], load: () => import("../reviewers/route") },
  { pattern: ["comments"], load: () => import("../comments/route") },
  { pattern: ["comments", "archive"], load: () => import("../comments/archive/route") },
  { pattern: ["comments", ":id"], load: () => import("../comments/[id]/route") },
  { pattern: ["comments", ":id", "replies"], load: () => import("../comments/[id]/replies/route") },
  {
    pattern: ["comments", ":id", "replies", ":replyId"],
    load: () => import("../comments/[id]/replies/[replyId]/route"),
  },
  { pattern: ["identity", ":id"], load: () => import("../identity/[id]/route") },
  { pattern: ["images", ":name"], load: () => import("../images/[name]/route") },
];

function match(pattern: string[], segments: string[]): Record<string, string> | null {
  if (pattern.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i].startsWith(":")) params[pattern[i].slice(1)] = segments[i];
    else if (pattern[i] !== segments[i]) return null;
  }
  return params;
}

export function createLegacyHandler(basePath = "/api/review-bridge") {
  return async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);
    const segments = pathname
      .slice(basePath.length)
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    for (const route of TABLE) {
      const params = match(route.pattern, segments);
      if (!params) continue;
      const mod = await route.load();
      const fn = mod[request.method];
      if (!fn) return new Response(null, { status: 405 });
      return fn(new NextRequest(request), { params: Promise.resolve(params) });
    }
    return new Response(null, { status: 404 });
  };
}
