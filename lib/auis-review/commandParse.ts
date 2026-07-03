// Pure parser that turns a Review Bridge comment's raw text into structured
// command data + render segments. Shared by: the read views (render @mention,
// /skill and #now as chips), the store (persist the parsed mentions/skills/act
// on save) and — later — the /loop dispatcher (decide what each agent runs).
//
// The composer is a plain <textarea>, so commands live in the text literally as
// the human types them: "@Claude", "/auis-ux-writing", "#now". Only KNOWN
// agents/skills become tokens; an unknown @foo or /bar stays plain text.

import { getReviewAgentByHandle } from "./agents"
import { isReviewSkillSlug } from "./skills"

export type ReviewCommandSegment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; agentId: string }
  | { type: "skill"; value: string; slug: string }
  | { type: "directive"; value: string }

export interface ParsedReviewCommand {
  segments: ReviewCommandSegment[]
  /** Distinct agent ids mentioned, in order of first appearance. */
  mentions: string[]
  /** Distinct skill slugs referenced, in order of first appearance. */
  skills: string[]
  /** True when the comment carries the "#now" action directive. */
  act: boolean
}

// One pass: @handle | /slug | #now. The leading group keeps tokens from
// false-triggering mid-word (an email's "@", a path's "/"): the sigil must sit
// at the start or after a non-word, non-sigil char.
const TOKEN_RE = /(^|[^\w/@#])([@/#])([A-Za-z][\w-]*)/g

export function parseReviewCommand(text: string): ParsedReviewCommand {
  const segments: ReviewCommandSegment[] = []
  const mentions: string[] = []
  const skills: string[] = []
  let act = false
  let lastIndex = 0

  for (const m of text.matchAll(TOKEN_RE)) {
    const lead = m[1]
    const sigil = m[2]
    const word = m[3]
    const tokenStart = (m.index ?? 0) + lead.length
    const tokenText = sigil + word

    let seg: ReviewCommandSegment | null = null
    if (sigil === "@") {
      const agent = getReviewAgentByHandle(word)
      if (agent) {
        seg = { type: "mention", value: tokenText, agentId: agent.id }
        if (!mentions.includes(agent.id)) mentions.push(agent.id)
      }
    } else if (sigil === "/") {
      if (isReviewSkillSlug(word)) {
        seg = { type: "skill", value: tokenText, slug: word }
        if (!skills.includes(word)) skills.push(word)
      }
    } else if (sigil === "#" && word.toLowerCase() === "now") {
      seg = { type: "directive", value: tokenText }
      act = true
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

  return { segments, mentions, skills, act }
}

/** Quick predicate: does this text address any agent at all? */
export function hasAgentMention(text: string): boolean {
  return parseReviewCommand(text).mentions.length > 0
}
