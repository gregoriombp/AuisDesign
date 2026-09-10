// Registry of the AGENTS that operate on the Review Bridge — the ones a reviewer
// summons with "@" in a comment (Claude, Codex, Germano). Distinct from any
// agents the host product defines: these are the bridge operators, matching the
// ReviewActor identities the skills already post as (`{ kind: "agent", id, name }`).
//
// Single source of truth for: the "@" mention menu, the per-agent control panel
// on the floating Auis dot, and chip rendering for rendered mentions.

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

/**
 * What an agent may do when mentioned. Both gates default OFF and are toggled
 * per-agent in the Auis dot. The toggle IS the permission — there is no
 * "#now" directive.
 * - liveResponse: replies in-thread (talk only — never touches code).
 * - autoConstruct: may ACT (run a skill, edit the prototype, send to review).
 */
export type ReviewAgentCapabilityKey = "liveResponse" | "autoConstruct"

export interface ReviewAgentCapability {
  key: ReviewAgentCapabilityKey
  /** Per-agent label — the executors call autoConstruct "Auto Design", Germano "Auto Review". */
  label: string
  description: string
  icon: string
}

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
  canSubmitForApproval: boolean
  capabilities: ReviewAgentCapability[]
  /** Skills this agent can run under Auto Construct. */
  skillSlugs: ReviewSkillSlug[]
}

const EXECUTOR_CAPABILITIES: ReviewAgentCapability[] = [
  {
    key: "liveResponse",
    label: "Live Response",
    description: "When mentioned, replies in the thread in real time.",
    icon: "forum",
  },
  {
    key: "autoConstruct",
    label: "Auto Design",
    description:
      "When on, makes the change as soon as it is mentioned, shows the result and sends it to review.",
    icon: "auto_fix_high",
  },
]

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
    capabilities: EXECUTOR_CAPABILITIES,
    skillSlugs: EXECUTOR_SKILLS,
  },
  codex: {
    blurb: "Answers, and applies changes to the interface.",
    tone: "teal",
    accentVar: "var(--au-teal-600)",
    icon: "agent",
    capabilities: EXECUTOR_CAPABILITIES,
    skillSlugs: EXECUTOR_SKILLS,
  },
  germano: {
    blurb: "Critical analysis and UI/UX diagnosis.",
    tone: "blue",
    accentVar: "var(--au-blue-600)",
    icon: "agent",
    capabilities: [
      {
        key: "liveResponse",
        label: "Live Response",
        description: "When mentioned, replies with UX analysis and an opinion.",
        icon: "forum",
      },
      {
        key: "autoConstruct",
        label: "Auto Review",
        description:
          "When on, explores the whole page and analyzes it with both of his skills as soon as he is mentioned.",
        icon: "travel_explore",
      },
    ],
    skillSlugs: [
      "auis-review-bridge-germano-explore",
      "auis-review-bridge-germano-audit",
    ],
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
