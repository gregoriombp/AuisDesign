import { NextResponse } from "next/server";

import { BridgeConflictError, BridgeUnavailableError } from "@/lib/bridge-store";

/**
 * Without this, any storage failure bubbles up raw and Next answers with an
 * empty-bodied 500: the client can only say "500 Internal Server Error" and
 * whoever is on the screen has no idea whether it is a session, the network or
 * the store. Here the failure becomes a 503 with the whole message, which
 * Review Mode shows in its own popover.
 *
 * 503 (not 500) because both causes are temporary — the store is down or there
 * is write contention — so retrying is the right move.
 */
export function bridgeErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof BridgeUnavailableError || err instanceof BridgeConflictError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  return null;
}

type Handler<A extends unknown[]> = (...args: A) => Promise<Response>;

/** Wraps a bridge route handler, translating store failures. */
export function withBridgeErrors<A extends unknown[]>(handler: Handler<A>): Handler<A> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      const mapped = bridgeErrorResponse(err);
      if (mapped) return mapped;
      console.error("[bridge] unhandled error:", err);
      return NextResponse.json(
        { error: "Unexpected bridge failure — check the server logs." },
        { status: 500 },
      );
    }
  };
}
