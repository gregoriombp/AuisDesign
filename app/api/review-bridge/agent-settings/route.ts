import { NextRequest, NextResponse } from "next/server";
import { getAgentSettings, setAgentSettings } from "../_store";
import type { ReviewAgentSettings } from "@/components/auis-review/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getAgentSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
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
