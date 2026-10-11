import { getAgentSettings, setAgentSettings } from "../store";
import { getBridgeSession } from "../session";
import { mentionTriggerEnabled } from "../mention";
import { REVIEW_AGENTS } from "@auis/core/agents";
import {
  REVIEW_AGENT_RUNTIME,
  validateAgentSettings,
} from "@auis/core/agentRuntime";

async function handleGET(request: Request) {
  // Knowing which agents are armed is operational information — not for a
  // reviewer session.
  const session = await getBridgeSession(request);
  if (session.role === "reviewer") {
    return Response.json({ error: "forbidden_role" }, { status: 403 });
  }
  const settings = await getAgentSettings();
  // The runner (kit/server/bin/mention-run.mjs) does not import TypeScript: it gets
  // each agent's runtime from here, with the name and handle for the prompt.
  const runtimes = Object.fromEntries(
    REVIEW_AGENTS.map((a) => [
      a.id,
      { ...REVIEW_AGENT_RUNTIME[a.id], name: a.name, handle: a.handle },
    ]),
  );
  return Response.json({
    settings,
    runtime: runtimes,
    triggerEnabled: mentionTriggerEnabled(),
  });
}

async function handlePUT(request: Request) {
  // Switching an agent on governs the mention trigger — admin only.
  const session = await getBridgeSession(request);
  if (session.role !== "admin") {
    return Response.json({ error: "forbidden_role" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const { agentId, settings: patch } = (body ?? {}) as {
    agentId?: unknown;
    settings?: unknown;
  };
  if (typeof agentId !== "string") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const current = (await getAgentSettings())[agentId];
  if (!current) {
    return Response.json({ error: "unknown_agent" }, { status: 400 });
  }
  // The client sends only what changed; the merge happens here, so two quick
  // clicks on different keys do not trample each other.
  const next = validateAgentSettings(agentId, {
    ...current,
    ...(patch && typeof patch === "object" ? patch : {}),
  });
  if (!next) {
    return Response.json({ error: "invalid_settings" }, { status: 400 });
  }
  await setAgentSettings(agentId, next);
  return Response.json({ ok: true, settings: next });
}

export const GET = handleGET;
export const PUT = handlePUT;
