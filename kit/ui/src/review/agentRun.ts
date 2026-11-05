import type { ReviewAgentRun, ReviewComment } from "@auis/core/types"

/**
 * A mark older than this came from a runner that died without clearing it (the
 * dev server restarted, the process was killed). The queue waits up to 45 min
 * for the lock, and a run gets a fresh mark when it starts, with a 30 min ceiling.
 */
const STALE_AFTER_MS = 50 * 60 * 1000

export function liveAgentRun(
  comment: ReviewComment,
  now: number = Date.now(),
): ReviewAgentRun | null {
  const run = comment.agentRun
  if (!run) return null
  return now - run.startedAt > STALE_AFTER_MS ? null : run
}

export function agentRunLabel(run: ReviewAgentRun): string {
  return run.phase === "running" ? "Working…" : "Queued: waiting for another agent to finish"
}
