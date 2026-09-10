import { NextRequest, NextResponse } from "next/server";
import { getAgentSettings, listComments } from "../_store";
import { effectiveAuthorRole, getBridgeSession } from "../_session";
import { parseReviewCommand } from "@/lib/auis-review/commandParse";
import { getReviewAgent } from "@/lib/auis-review/agents";
import {
  getReviewSkill,
  isReviewSkillAvailableToAgent,
} from "@/lib/auis-review/skills";
import { withBridgeErrors } from "../_errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The actionable queue for the dispatcher: open, user-authored comments that
// mention an agent the user has ENABLED in the Auis dot. Single lock — the
// toggle IS the permission: Auto Construct ON → "act" (run a skill, edit, send
// to review); else Live Response ON → "respond" (reply only). No directive in
// the comment text is needed. Encodes the gate ONCE, server-side, reusing the
// same parser the composer/chips use — so the dispatcher skill just executes
// the work.
//
// HIERARCHY: agents obey ONLY the admin. Command sources are exclusively
// messages whose effective author role is "admin" (the pin's text and replies)
// — an "@Claude" typed by a reviewer stays as text and NEVER enters the queue.
// A reviewer's pin can still dispatch, but only when the ADMIN replies on it
// mentioning the agent (the command is the admin's, the context is the reviewer's).

type DispatchMode = "respond" | "act";

interface DispatchItem {
  commentId: string;
  url: string;
  agentId: string;
  agentName: string;
  mode: DispatchMode;
  text: string;
  flowRef?: (Awaited<ReturnType<typeof listComments>>)[number]["flowRef"];
  skills: { slug: string; label: string; acts: boolean }[];
  createdAt: number;
}

async function handleGET(request: NextRequest) {
  // The queue is consumed by the dispatcher (agent token) or by the admin — a
  // reviewer has nothing to do here.
  const session = await getBridgeSession(request);
  if (session.role === "reviewer") {
    return NextResponse.json({ error: "forbidden_role" }, { status: 403 });
  }

  const url = request.nextUrl.searchParams.get("url") ?? undefined;
  const settings = await getAgentSettings();
  const open = await listComments({ status: "open", url });

  const items: DispatchItem[] = [];
  for (const c of open) {
    // No self-loop: agent-authored pins (e.g. Germano's suggestions, which often
    // say "have @Claude do it") never auto-trigger another agent. Only the
    // user's own directives dispatch.
    if (getReviewAgent(c.authorId)) continue;

    const replies = c.replies ?? [];

    // The user may address the pin and then follow up with an "@Claude" REPLY —
    // so the mention usually lives in a reply, not in c.text. Parse the ADMIN
    // stream (the body + every admin-authored reply) and merge mentions/skills
    // as the union. Agent replies are never command sources (that would let agents
    // drive each other), and reviewer replies never command (hierarchy gate).
    const userSources = [
      ...(effectiveAuthorRole(c) === "admin" ? [{ text: c.text, at: c.createdAt }] : []),
      ...replies
        .filter((r) => r.authorKind === "user" && effectiveAuthorRole(r) === "admin")
        .map((r) => ({ text: r.text, at: r.createdAt })),
    ];
    if (userSources.length === 0) continue;
    const latestUserAt = userSources.reduce((mx, u) => Math.max(mx, u.at), 0);
    const mentions: string[] = [];
    const skills: string[] = [];
    for (const u of userSources) {
      const p = parseReviewCommand(u.text);
      for (const id of p.mentions) if (!mentions.includes(id)) mentions.push(id);
      for (const sk of p.skills) if (!skills.includes(sk)) skills.push(sk);
    }
    if (mentions.length === 0) continue;

    for (const agentId of mentions) {
      const agent = getReviewAgent(agentId);
      if (!agent) continue;
      const s = settings[agentId] ?? { liveResponse: false, autoConstruct: false };

      // Single gate — the toggle IS the permission. Auto Construct wins over
      // Live Response (acting implies replying a summary anyway).
      let mode: DispatchMode | null = null;
      if (s.autoConstruct) mode = "act";
      else if (s.liveResponse) mode = "respond";
      if (!mode) continue;

      // Idempotency, timeline-aware: the agent is "done" only if it has replied
      // AFTER the user's most recent message. This keeps it from re-running a
      // comment it already answered, while still re-opening the item when the
      // user follows up with a fresh "@Claude" reply (a re-prompt).
      const latestAgentReplyAt = replies
        .filter((r) => r.authorKind === "agent" && r.authorId === agentId)
        .reduce((mx, r) => Math.max(mx, r.createdAt), -Infinity);
      if (latestAgentReplyAt > latestUserAt) continue;

      const routedSkills = skills.flatMap((slug) => {
        const skill = getReviewSkill(slug);
        if (!skill || !isReviewSkillAvailableToAgent(skill, agentId)) return [];
        return [skill.slug];
      });
      items.push({
        commentId: c.id,
        url: c.url,
        agentId,
        agentName: agent.name,
        mode,
        text: c.text,
        flowRef: c.flowRef,
        skills: routedSkills.map((slug) => {
          const skill = getReviewSkill(slug)!;
          return { slug, label: skill.label, acts: skill.acts };
        }),
        createdAt: c.createdAt,
      });
    }
  }

  items.sort((a, b) => a.createdAt - b.createdAt); // FIFO — oldest first
  return NextResponse.json({ items, settings });
}

export const GET = withBridgeErrors(handleGET);
