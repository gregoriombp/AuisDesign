import { setCommentAgentRun } from "../store";
import { getBridgeSession } from "../session";
import { canBridgeSessionWriteAsAgent, getReviewAgent } from "@auis/core/agents";

/**
 * The "agent working" mark on a comment. Only the local mention runner calls
 * it, with the `x-bridge-agent-id` header, through the same gate as agent
 * replies: locally without auth it passes; behind an auth layer it needs the
 * agent token.
 *
 * PUT `{ phase: "queued" | "running" }` marks; DELETE clears that agent's mark.
 * Neither counts as activity: the mark is passing state, and the agent's reply
 * already records what matters.
 */

type AgentCheck = { ok: true; agentId: string } | { ok: false; response: Response };

async function agentFrom(request: Request): Promise<AgentCheck> {
  const agentId = request.headers.get("x-bridge-agent-id")?.trim();
  const agent = agentId ? getReviewAgent(agentId) : undefined;
  if (!agent) {
    return {
      ok: false,
      response: Response.json({ error: "unknown_agent_author" }, { status: 400 }),
    };
  }
  const session = await getBridgeSession(request);
  if (!canBridgeSessionWriteAsAgent(session)) {
    return {
      ok: false,
      response: Response.json({ error: "agent_auth_required" }, { status: 403 }),
    };
  }
  return { ok: true, agentId: agent.id };
}

async function handlePUT(request: Request, params: { id: string }) {
  const who = await agentFrom(request);
  if (!who.ok) return who.response;

  let phase: unknown;
  try {
    phase = ((await request.json()) as { phase?: unknown })?.phase;
  } catch {
    phase = undefined;
  }
  if (phase !== "queued" && phase !== "running") {
    return Response.json({ error: "invalid_phase" }, { status: 400 });
  }

  const exists = await setCommentAgentRun(params.id, {
    agentId: who.agentId,
    phase,
    startedAt: Date.now(),
  });
  if (!exists) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}

async function handleDELETE(request: Request, params: { id: string }) {
  const who = await agentFrom(request);
  if (!who.ok) return who.response;

  const exists = await setCommentAgentRun(params.id, null, who.agentId);
  if (!exists) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}

export const PUT = handlePUT;
export const DELETE = handleDELETE;
