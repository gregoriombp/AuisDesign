// Mention trigger: when the ADMIN writes "@Claude …" in a pin or a reply, the
// very route that stored it opens a headless run of that agent's CLI. The write
// IS the event — no queue being watched, no process asking "any work?" (a
// polling loop costs one agent turn per tick, almost always to find an empty
// queue).
//
// This runs ONLY on the developer's own machine. A route that opens a process
// must not even be attempted on a public server — see `mentionTriggerEnabled`.
//
// Division of labour: only the gates and the detached spawn live here; all the
// logic (lock, watchdog, failure reply) lives in `scripts/mention-run.mjs`,
// which survives the dev server's HMR. A supervisor inside Next would die on
// the first file edit and the failure reply would never go out.
//
// Five gates: the four below plus the Agents panel — the agent has to be
// switched on and have a CLI (lib/auis-review/agentRuntime.ts).

import path from "node:path";
import { parseReviewCommand } from "@/lib/auis-review/commandParse";
import { runnableMentions } from "@/lib/auis-review/agentRuntime";
import type { ReviewAuthorRole } from "@/components/auis-review/types";
import { effectiveAuthorRole } from "./_session";
import { getAgentSettings } from "./_store";

const RUNNER = "scripts/mention-run.mjs";

/** Author of the write, in the shape the comment and the reply already carry. */
export interface MentionAuthor {
  authorKind?: "agent" | "user";
  authorRole?: ReviewAuthorRole;
  authorEmail?: string;
}

/**
 * Gate 1 — never in production, and not in dev without an explicit opt-in.
 * `NODE_ENV` alone would cover a deployment, but the opt-in is what lets you
 * run `npm run dev` normally without a "@Claude" opening a process.
 */
export function mentionTriggerEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.AUIS_MENTION_TRIGGER === "1"
  );
}

/**
 * Gates 2 and 3, in the order they matter:
 *
 * - **Never an agent.** Without this, Claude replies "done, @Grok check it",
 *   Grok replies "@Claude fix it" and the two feed each other forever. Same
 *   care as the anti-self-loop in `dispatch-queue/route.ts`.
 * - **Admin only.** Same hierarchy as the queue: a reviewer typing "@Claude"
 *   stays text, and never opens a process on anyone's machine.
 *
 * Exported apart from the spawn so it is testable without spawning anything.
 */
export function mentionedAgents(text: string, author: MentionAuthor): string[] {
  if (author.authorKind === "agent") return [];
  if (effectiveAuthorRole(author) !== "admin") return [];
  return parseReviewCommand(text).mentions;
}

/**
 * Fire and forget. Never throws: a broken trigger must not take down the
 * comment write the browser is waiting for.
 *
 * Gate 4 ("only on creation") belongs to the caller — the `PUT` both creates
 * and edits, and re-saving an old comment that already says "@Claude" must not
 * fire again.
 */
export function triggerMentionRun(
  commentId: string,
  text: string,
  author: MentionAuthor,
): void {
  try {
    if (!mentionTriggerEnabled()) return;
    const mentioned = mentionedAgents(text, author);
    if (mentioned.length === 0) return;
    void (async () => {
      // Gate 5 — the Agents panel. Off does not open a process, not even to fail.
      const agentIds = runnableMentions(mentioned, await getAgentSettings());
      if (agentIds.length === 0) {
        console.log(
          `[mention-trigger] ${commentId} → ${mentioned.join(", ")} switched off in the Agents panel`,
        );
        return;
      }
      await spawnRunner(commentId, agentIds);
    })().catch((err) => {
      console.error("[mention-trigger] could not read the agent settings:", err);
    });
  } catch (err) {
    console.error("[mention-trigger] could not evaluate the mention:", err);
  }
}

async function spawnRunner(commentId: string, agentIds: string[]) {
  try {
    // Dynamic import, and AFTER the gate: in production this module is never
    // loaded, so there is no `child_process` reachable from a published route.
    const { spawn } = await import("node:child_process");
    const child = spawn(
      // The same node that runs Next — launchd/PATH do not enter the story.
      process.execPath,
      [path.join(process.cwd(), RUNNER), commentId, agentIds.join(",")],
      { cwd: process.cwd(), detached: true, stdio: "ignore" },
    );
    child.unref();
    console.log(
      `[mention-trigger] ${commentId} → ${agentIds.join(", ")} (pid ${child.pid})`,
    );
  } catch (err) {
    console.error("[mention-trigger] could not open the runner:", err);
  }
}
