import { NextRequest, NextResponse } from "next/server";
import { getAgentSettings, setAgentSettings } from "../_store";
import { getBridgeSession } from "../_session";
import type { ReviewAgentSettings } from "@/components/auis-review/types";
import { withBridgeErrors } from "../_errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET() {
  const settings = await getAgentSettings();
  return NextResponse.json({ settings });
}

async function handlePUT(request: NextRequest) {
  // Turning an agent on/off is the dispatcher's master lock — admin only.
  const session = await getBridgeSession(request);
  if (session.role === "reviewer") {
    return NextResponse.json({ error: "forbidden_role" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { agentId?: unknown }).agentId !== "string"
  ) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { agentId, settings } = body as { agentId: string; settings: unknown };
  if (
    !settings ||
    typeof settings !== "object" ||
    typeof (settings as ReviewAgentSettings).liveResponse !== "boolean" ||
    typeof (settings as ReviewAgentSettings).autoConstruct !== "boolean"
  ) {
    return NextResponse.json({ error: "invalid_settings" }, { status: 400 });
  }
  await setAgentSettings(agentId, settings as ReviewAgentSettings);
  return NextResponse.json({ ok: true });
}

export const GET = withBridgeErrors(handleGET);
export const PUT = withBridgeErrors(handlePUT);
