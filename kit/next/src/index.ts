// @auis/next — plugs the Review Bridge server (@auis/server) into a Next.js App
// Router app. In the host it is one catch-all route file:
//
//   // app/api/review-bridge/[...path]/route.ts
//   import { createReviewRoute } from "@auis/next"
//   export const runtime = "nodejs"
//   export const dynamic = "force-dynamic"
//   const route = createReviewRoute()
//   export const GET = route.GET  // …and POST, PUT, PATCH, DELETE
//
// `runtime` and `dynamic` have to be written in the host's file: Next reads
// them statically. The browser half of this adapter (the router hooks the
// review UI needs) arrives with @auis/ui — see docs/review-bridge-packages-plan.md.
import { createReviewHandler, type ReviewServerOptions } from "@auis/server";

type RouteHandler = (request: Request) => Promise<Response>;

export interface ReviewRoute {
  GET: RouteHandler;
  POST: RouteHandler;
  PUT: RouteHandler;
  PATCH: RouteHandler;
  DELETE: RouteHandler;
}

/** One handler per HTTP method, all answering through the same `handle()`. */
export function createReviewRoute(options?: ReviewServerOptions): ReviewRoute {
  const handle = createReviewHandler(options);
  const route: RouteHandler = (request) => handle(request);
  return { GET: route, POST: route, PUT: route, PATCH: route, DELETE: route };
}

export type { ReviewServerOptions };
