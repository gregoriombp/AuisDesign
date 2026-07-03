// Registry of the AGENTS that operate on the Review Bridge — the ones a reviewer
// summons with "@" in a comment (Claude, Germano). Distinct from the user's
// product agents (Agent Studio) and from the "claude" integration: these are the
// bridge operators, matching the ReviewActor identities the skills already post
// as (`{ kind: "agent", id, name }`).
//
// Single source of truth for: the "@" mention menu, the per-agent control panel
// on the floating Auis dot, and chip rendering for rendered mentions.

import type { AuCheckpointChipTone } from "@/components/ui/AuCheckpointChip"
import type { ReviewSkillSlug } from "./skills"

/**
 * What an agent may do when mentioned. Both gates default OFF and are toggled
 * per-agent in the Auis dot.
 * - liveResponse: replies in-thread (talk only — never touches code).
 * - autoConstruct: may ACT (run a skill, edit the prototype, send to review).
 *   Always double-gated — needs this toggle ON *and* a "#now" in the comment.
 */
export type ReviewAgentCapabilityKey = "liveResponse" | "autoConstruct"

export interface ReviewAgentCapability {
  key: ReviewAgentCapabilityKey
  /** Per-agent label — Claude calls autoConstruct "Auto Design", Germano "Auto Review". */
  label: string
  description: string
  icon: string
}

export interface ReviewAgent {
  /** Matches ReviewActor.id — the identity the agent's skills post as. */
  id: "claude" | "germano"
  /** Full display name (= ReviewActor.name). */
  name: string
  /** Token typed after "@" (no spaces). Case-insensitive on parse. */
  handle: string
  /** One-liner for the "@" menu row. */
  blurb: string
  /** Chip tone for rendered @mentions. */
  tone: AuCheckpointChipTone
  /** CSS var for the agent dot / icon tint. */
  accentVar: string
  /** Material Symbol glyph — the "agent" gesture, never a robot. */
  icon: string
  capabilities: ReviewAgentCapability[]
  /** Skills this agent can run under Auto Construct. */
  skillSlugs: ReviewSkillSlug[]
}

export const REVIEW_AGENTS: readonly ReviewAgent[] = [
  {
    id: "claude",
    name: "Claude",
    handle: "Claude",
    blurb: "Responde e executa ajustes na interface.",
    tone: "purple",
    accentVar: "var(--au-purple-600)",
    icon: "agent",
    capabilities: [
      {
        key: "liveResponse",
        label: "Live Response",
        description: "Quando mencionado, responde no thread em tempo real.",
        icon: "forum",
      },
      {
        key: "autoConstruct",
        label: "Auto Design",
        description:
          "Com #now, executa o ajuste, mostra o resultado e manda pra revisão.",
        icon: "auto_fix_high",
      },
    ],
    skillSlugs: [
      "auis-review-bridge-solve",
      "auis-ux-writing",
      "auis-edit-bridge-solve",
    ],
  },
  {
    id: "germano",
    name: "Germano Faccio",
    handle: "Germano",
    blurb: "Análise crítica e diagnóstico de UI/UX.",
    tone: "blue",
    accentVar: "var(--au-blue-600)",
    icon: "agent",
    capabilities: [
      {
        key: "liveResponse",
        label: "Live Response",
        description: "Quando mencionado, responde com análise e opinião de UX.",
        icon: "forum",
      },
      {
        key: "autoConstruct",
        label: "Auto Review",
        description:
          "Com #now, explora a página inteira e analisa com as 2 skills dele.",
        icon: "travel_explore",
      },
    ],
    skillSlugs: [
      "auis-review-bridge-germano-explore",
      "auis-review-bridge-germano-audit",
    ],
  },
]

const BY_ID = new Map<string, ReviewAgent>(REVIEW_AGENTS.map((a) => [a.id, a]))
const BY_HANDLE = new Map<string, ReviewAgent>(
  REVIEW_AGENTS.map((a) => [a.handle.toLowerCase(), a]),
)

export function getReviewAgent(id: string): ReviewAgent | undefined {
  return BY_ID.get(id)
}

/** Resolve a typed "@handle" (case-insensitive) to its agent, if known. */
export function getReviewAgentByHandle(handle: string): ReviewAgent | undefined {
  return BY_HANDLE.get(handle.toLowerCase())
}
