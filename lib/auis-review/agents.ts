// Registry of the AGENTS that operate on the Review Bridge — the ones a reviewer
// summons with "@" in a comment (Claude, Codex, Grok). Distinct from any agents
// the host product defines: these are the bridge operators, matching the
// ReviewActor identities the skills already post as (`{ kind: "agent", id, name }`).
//
// Single source of truth for: the "@" mention menu, the Agents panel on the
// floating Auis dot, the avatar mark and chip rendering for rendered mentions.
// What each agent can RUN (CLI, ceilings, models) lives in ./agentRuntime.

import type { AuMentionChipTone } from "@/components/ui/AuMentionChip"
import type { ReviewSkillSlug } from "./skills"
import {
  REVIEW_AGENT_IDENTITIES,
  type ReviewAgentId,
} from "./agentIdentity"

export type { ReviewAgentId } from "./agentIdentity"
export {
  canonicalReviewAgentActor,
  canBridgeSessionWriteAsAgent,
  canReviewAgentSubmitForApproval,
  isReservedReviewAgentIdentity,
} from "./agentIdentity"

export interface ReviewAgent {
  /** Matches ReviewActor.id — the identity the agent's skills post as. */
  id: ReviewAgentId
  /** Full display name (= ReviewActor.name). */
  name: string
  /** Token typed after "@" (no spaces). Case-insensitive on parse. */
  handle: string
  /** One-liner for the "@" menu row. */
  blurb: string
  /** Chip tone for rendered @mentions. */
  tone: AuMentionChipTone
  /** CSS var for the agent dot / icon tint. */
  accentVar: string
  /** Material Symbol glyph — the "agent" gesture, never a robot. */
  icon: string
  /** Official mark, served from public/assets/agents/ (ReviewAvatar, the "@" menu). */
  mark: string
  canSubmitForApproval: boolean
  /** Skills this agent can run under the Edit ceiling. */
  skillSlugs: ReviewSkillSlug[]
}

const EXECUTOR_SKILLS: ReviewSkillSlug[] = [
  "auis-review-bridge-solve",
  "auis-ux-writing",
  "auis-edit-bridge-solve",
]

const AGENT_CONFIG: Record<
  ReviewAgentId,
  Omit<ReviewAgent, "id" | "name" | "handle" | "canSubmitForApproval">
> = {
  claude: {
    blurb: "Answers, and applies changes to the interface.",
    tone: "purple",
    accentVar: "var(--au-purple-600)",
    icon: "agent",
    mark: "/assets/agents/claude.svg",
    skillSlugs: EXECUTOR_SKILLS,
  },
  codex: {
    blurb: "Answers, and applies changes to the interface.",
    tone: "teal",
    accentVar: "var(--au-teal-600)",
    icon: "agent",
    mark: "/assets/agents/openai.svg",
    skillSlugs: EXECUTOR_SKILLS,
  },
  grok: {
    blurb: "Answers, and applies changes to the interface.",
    tone: "inverse",
    accentVar: "var(--fg-primary)",
    icon: "agent",
    mark: "/assets/agents/grok.svg",
    skillSlugs: EXECUTOR_SKILLS,
  },
}

export const REVIEW_AGENTS: readonly ReviewAgent[] = REVIEW_AGENT_IDENTITIES.map(
  (identity) => ({ ...identity, ...AGENT_CONFIG[identity.id] }),
)

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
