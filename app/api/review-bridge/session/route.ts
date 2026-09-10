import { NextRequest, NextResponse } from "next/server";
import { getBridgeSession } from "../_session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Who am I for the Review Bridge — the client reads it ONCE and adapts the UI
 * (hide approve/reject, agent mentions, privacy toggle, the dot's panel). It is
 * an informative mirror: the real permission is re-checked on every write
 * route, so lying here grants no power.
 */
export async function GET(request: NextRequest) {
  const session = await getBridgeSession(request);
  return NextResponse.json({
    role: session.role,
    email: session.email,
    shared: session.shared,
    authEnabled: session.authEnabled,
  });
}
