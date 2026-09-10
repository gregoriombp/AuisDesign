// Pure parser that turns a Review Bridge comment's raw text into structured
// command data + render segments. Shared by: the read views (render @mention and
// /skill as chips), the store (persist the parsed mentions/skills on save) and
// the /loop dispatcher (decide what each agent runs).
//
// The composer is a plain <textarea>, so commands live in the text literally as
// the human types them: "@Claude", "/auis-ux-writing". Only KNOWN agents/skills
// become tokens; an unknown @foo or /bar stays plain text. There is no "#now"
// directive: whether an agent acts is decided ONLY by its Auto Construct toggle
// in the Auis dot (see ReviewAgentSettings).
//
// @mentions of a PERSON (a human reviewer, see ./reviewers) are recognized only
// when the CALLER passes `opts.userHandles` — without it, a "@jane" that matches
// no agent stays plain text. That is deliberate: the /loop dispatcher
// (app/api/review-bridge/dispatch-queue/route.ts) calls parseReviewCommand(text)
// without opts and must only fire on agent mentions — a @person can never turn
// into a dispatch.

import { getReviewAgentByHandle } from "./agents"
import { isReviewSkillSlug } from "./skills"

export type ReviewCommandSegment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; agentId: string }
  | { type: "mentionUser"; value: string; handle: string }
  | { type: "skill"; value: string; slug: string }

export interface ParsedReviewCommand {
  segments: ReviewCommandSegment[]
  /** Distinct agent ids mentioned, in order of first appearance. */
  mentions: string[]
  /** Distinct skill slugs referenced, in order of first appearance. */
  skills: string[]
}

export interface ParseReviewCommandOptions {
  /** Handles (lowercase) of valid human reviewers — enables @mentionUser. */
  userHandles?: string[]
}

// One pass: @handle | /slug. The leading group keeps tokens from false-triggering
// mid-word (an email's "@", a path's "/"): the sigil must sit at the start or
// after a non-word, non-sigil char.
const TOKEN_RE = /(^|[^\w/@])([@/])([A-Za-z][\w-]*)/g

export function parseReviewCommand(
  text: string,
  opts?: ParseReviewCommandOptions,
): ParsedReviewCommand {
  const segments: ReviewCommandSegment[] = []
  const mentions: string[] = []
  const skills: string[] = []
  // Case-insensitive comparison set — built once per call, not per token
  // (avoids O(n²) on a comment with many mentions).
  const userHandleSet = opts?.userHandles
    ? new Set(opts.userHandles.map((h) => h.toLowerCase()))
    : null
  let lastIndex = 0

  for (const m of text.matchAll(TOKEN_RE)) {
    const lead = m[1]
    const sigil = m[2]
    const word = m[3]
    const tokenStart = (m.index ?? 0) + lead.length
    const tokenText = sigil + word

    let seg: ReviewCommandSegment | null = null
    if (sigil === "@") {
      // Agents take precedence: a handle is never ambiguous in practice (the
      // registries are distinct), but if one ever collides, the agent wins.
      const agent = getReviewAgentByHandle(word)
      if (agent) {
        seg = { type: "mention", value: tokenText, agentId: agent.id }
        if (!mentions.includes(agent.id)) mentions.push(agent.id)
      } else if (userHandleSet?.has(word.toLowerCase())) {
        seg = { type: "mentionUser", value: tokenText, handle: word.toLowerCase() }
      }
    } else if (sigil === "/") {
      if (isReviewSkillSlug(word)) {
        seg = { type: "skill", value: tokenText, slug: word }
        if (!skills.includes(word)) skills.push(word)
      }
    }

    if (!seg) continue // unknown token → leave it inside the surrounding text

    if (tokenStart > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, tokenStart) })
    }
    segments.push(seg)
    lastIndex = tokenStart + tokenText.length
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) })
  }

  return { segments, mentions, skills }
}

/** Quick predicate: does this text address any agent at all? */
export function hasAgentMention(text: string): boolean {
  return parseReviewCommand(text).mentions.length > 0
}
