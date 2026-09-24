import { NextRequest, NextResponse } from "next/server";
import { getAgentSettings, setAgentSettings } from "../_store";
import { getBridgeSession } from "../_session";
import { mentionTriggerEnabled } from "../_mention";
import { REVIEW_AGENTS } from "@/lib/auis-review/agents";
import {
  REVIEW_AGENT_RUNTIME,
  validateAgentSettings,
} from "@/lib/auis-review/agentRuntime";
import { withBridgeErrors } from "../_errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET(request: NextRequest) {
  // Knowing which agents are armed is operational information — not for a
  // reviewer session.
  const session = await getBridgeSession(request);
  if (session.role === "reviewer") {
    return NextResponse.json({ error: "forbidden_role" }, { status: 403 });
  }
  const settings = await getAgentSettings();
  // The runner (scripts/mention-run.mjs) does not import TypeScript: it gets
  // each agent's runtime from here, with the name and handle for the prompt.
  const runtimes = Object.fromEntries(
    REVIEW_AGENTS.map((a) => [
      a.id,
      { ...REVIEW_AGENT_RUNTIME[a.id], name: a.name, handle: a.handle },
    ]),
  );
  return NextResponse.json({
    settings,
    runtime: runtimes,
    triggerEnabled: mentionTriggerEnabled(),
  });
}

async function handlePUT(request: NextRequest) {
  // Switching an agent on governs the mention trigger — admin only.
  const session = await getBridgeSession(request);
  if (session.role !== "admin") {
    return NextResponse.json({ error: "forbidden_role" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { agentId, settings: patch } = (body ?? {}) as {
    agentId?: unknown;
    settings?: unknown;
  };
  if (typeof agentId !== "string") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const current = (await getAgentSettings())[agentId];
  if (!current) {
    return NextResponse.json({ error: "unknown_agent" }, { status: 400 });
  }
  // The client sends only what changed; the merge happens here, so two quick
  // clicks on different keys do not trample each other.
  const next = validateAgentSettings(agentId, {
    ...current,
    ...(patch && typeof patch === "object" ? patch : {}),
  });
  if (!next) {
    return NextResponse.json({ error: "invalid_settings" }, { status: 400 });
  }
  await setAgentSettings(agentId, next);
  return NextResponse.json({ ok: true, settings: next });
}

export const GET = withBridgeErrors(handleGET);
export const PUT = withBridgeErrors(handlePUT);
