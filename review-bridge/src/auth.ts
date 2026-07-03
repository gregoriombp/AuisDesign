import type { NextFunction, Request, Response } from "express"

const TOKEN = process.env.AUIS_REVIEW_TOKEN ?? ""

export function tokenConfigured(): boolean {
  return TOKEN.length > 0
}

/**
 * Token shared with the frontend via NEXT_PUBLIC_AUIS_REVIEW_TOKEN.
 * Validation is constant-time to avoid trivial timing leaks.
 *
 * If no token is configured, every request is rejected — even though the
 * bridge is local-only by default, it should never run wide-open.
 */
export function requireToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!tokenConfigured()) {
    res.status(503).json({
      error: "no_token_configured",
      hint: "Defina AUIS_REVIEW_TOKEN no .env do review-bridge.",
    })
    return
  }

  const headerToken =
    typeof req.headers["x-review-token"] === "string"
      ? req.headers["x-review-token"]
      : Array.isArray(req.headers["x-review-token"])
      ? req.headers["x-review-token"][0]
      : ""

  const queryToken =
    typeof req.query.token === "string" ? req.query.token : ""

  const presented = headerToken || queryToken

  if (!presented || !timingSafeEqual(presented, TOKEN)) {
    res.status(401).json({ error: "invalid_token" })
    return
  }

  next()
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}
