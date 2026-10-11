import { createReviewRoute } from "@auis/next"

// Every /api/review-bridge/* request is answered by the Review Bridge server
// (@auis/server, in kit/server). Next reads `runtime` and `dynamic` statically,
// so they stay literal here.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The mention runner is the one @auis/server ships; Auis consumes the kit from
// source, so it points at the file instead of an installed package.
const route = createReviewRoute({ mentionRunner: "kit/server/bin/mention-run.mjs" })
export const GET = route.GET
export const POST = route.POST
export const PUT = route.PUT
export const PATCH = route.PATCH
export const DELETE = route.DELETE
