import { configureReviewServer, type ReviewServerOptions } from "./config";
import { withBridgeErrors } from "./errors";
import * as agentSettings from "./routes/agentSettings";
import * as comment from "./routes/comment";
import * as comments from "./routes/comments";
import * as commentsArchive from "./routes/commentsArchive";
import * as dispatchQueue from "./routes/dispatchQueue";
import * as exportRoute from "./routes/export";
import * as health from "./routes/health";
import * as identity from "./routes/identity";
import * as images from "./routes/images";
import * as importRoute from "./routes/import";
import * as members from "./routes/members";
import * as replies from "./routes/replies";
import * as reply from "./routes/reply";
import * as reviewers from "./routes/reviewers";
import * as session from "./routes/session";
import * as version from "./routes/version";

type Params = Record<string, string>;
type RouteHandler = (request: Request, params: Params) => Promise<Response>;
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type RouteModule = Partial<Record<Method, (request: Request, params: never) => Promise<Response>>>;

const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/**
 * The Review Bridge API, path by path. Static segments come before `:params`
 * where both could match (`comments/archive` before `comments/:id`), the same
 * precedence the per-file Next routes had.
 */
const ROUTES: { pattern: string[]; module: RouteModule }[] = [
  { pattern: ["health"], module: health },
  { pattern: ["version"], module: version },
  { pattern: ["session"], module: session },
  { pattern: ["agent-settings"], module: agentSettings },
  { pattern: ["dispatch-queue"], module: dispatchQueue },
  { pattern: ["export"], module: exportRoute },
  { pattern: ["import"], module: importRoute },
  { pattern: ["members"], module: members },
  { pattern: ["reviewers"], module: reviewers },
  { pattern: ["comments"], module: comments },
  { pattern: ["comments", "archive"], module: commentsArchive },
  { pattern: ["comments", ":id"], module: comment },
  { pattern: ["comments", ":id", "replies"], module: replies },
  { pattern: ["comments", ":id", "replies", ":replyId"], module: reply },
  { pattern: ["identity", ":id"], module: identity },
  { pattern: ["images", ":name"], module: images },
];

function match(pattern: string[], segments: string[]): Params | null {
  if (pattern.length !== segments.length) return null;
  const params: Params = {};
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i].startsWith(":")) params[pattern[i].slice(1)] = segments[i];
    else if (pattern[i] !== segments[i]) return null;
  }
  return params;
}

function pathSegments(pathname: string, basePath: string): string[] | null {
  if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return null;
  try {
    return pathname.slice(basePath.length).split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    // A malformed escape (`%E0%A4%A`) names no route.
    return null;
  }
}

/**
 * Builds the Review Bridge server: one `handle(Request): Promise<Response>` for
 * every endpoint under `basePath`. It knows nothing about the framework around
 * it, so any server that speaks the standard Request/Response can mount it;
 * `@auis/next` is the Next adapter.
 *
 * Answers 404 for a path the bridge does not have and 405 (with `Allow`) for a
 * path it has under another method. Store failures become a 503 with the
 * message (see `withBridgeErrors`).
 */
export function createReviewHandler(
  options: ReviewServerOptions = {},
): (request: Request) => Promise<Response> {
  configureReviewServer(options);
  const basePath = (options.basePath ?? "/api/review-bridge").replace(/\/+$/, "");

  return async function handle(request: Request): Promise<Response> {
    const segments = pathSegments(new URL(request.url).pathname, basePath);
    if (segments) {
      for (const route of ROUTES) {
        const params = match(route.pattern, segments);
        if (!params) continue;
        const fn = route.module[request.method as Method] as RouteHandler | undefined;
        if (!fn) {
          const allow = METHODS.filter((m) => route.module[m]).join(", ");
          return Response.json(
            { error: "method_not_allowed" },
            { status: 405, headers: { Allow: allow } },
          );
        }
        return withBridgeErrors(fn)(request, params);
      }
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  };
}
