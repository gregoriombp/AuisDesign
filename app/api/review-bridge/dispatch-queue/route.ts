import { NextRequest, NextResponse } from "next/server";
import { getAgentSettings, listComments } from "../_store";
import { parseReviewCommand } from "@/lib/auis-review/commandParse";
import { getReviewAgent } from "@/lib/auis-review/agents";
import { getReviewSkill } from "@/lib/auis-review/skills";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The actionable queue for the /loop dispatcher: open, user-authored comments
// that mention an agent the user has ENABLED in the Auis dot, gated by the
// double-lock (act needs autoConstruct ON *and* #now; otherwise respond if
// liveResponse is ON). Encodes the gate ONCE, server-side, reusing the same
// parser the composer/chips use — so the dispatcher skill just executes the work.

type DispatchMode = "respond" | "act";

interface DispatchItem {
  commentId: string;
  url: string;
  agentId: string;
  agentName: string;
  mode: DispatchMode;
  text: string;
  skills: { slug: string; label: string; acts: boolean }[];
  createdAt: number;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") ?? undefined;
  const settings = await getAgentSettings();
  const open = await listComments({ status: "open", url });

  const items: DispatchItem[] = [];
  for (const c of open) {
    // No self-loop: agent-authored pins (e.g. Germano's suggestions, which often
    // say "have @Claude do it") never auto-trigger another agent. Only the
    // user's own directives dispatch.
    if (getReviewAgent(c.authorId)) continue;

    const parsed = parseReviewCommand(c.text);
    if (parsed.mentions.length === 0) continue;

    for (const agentId of parsed.mentions) {
      const agent = getReviewAgent(agentId);
      if (!agent) continue;
      const s = settings[agentId] ?? { liveResponse: false, autoConstruct: false };

      // Double gate.
      let mode: DispatchMode | null = null;
      if (parsed.act && s.autoConstruct) mode = "act";
      else if (s.liveResponse) mode = "respond";
      if (!mode) continue;

      // Idempotency: an existing reply from this agent means it's already handled
      // (it answered, or asked a clarifying question and is waiting on the user).
      const handled = (c.replies ?? []).some(
        (r) => r.authorKind === "agent" && r.authorId === agentId,
      );
      if (handled) continue;

      items.push({
        commentId: c.id,
        url: c.url,
        agentId,
        agentName: agent.name,
        mode,
        text: c.text,
        skills: parsed.skills.map((slug) => {
          const sk = getReviewSkill(slug);
          return { slug, label: sk?.label ?? slug, acts: sk?.acts ?? false };
        }),
        createdAt: c.createdAt,
      });
    }
  }

  items.sort((a, b) => a.createdAt - b.createdAt); // FIFO — oldest first
  return NextResponse.json({ items, settings });
}
