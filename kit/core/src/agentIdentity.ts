// The bridge operators — the identities the Review Bridge agents write as.
// Auis ships three executors that share the same contracts: Claude and Grok
// have a CLI the mention trigger can open; Codex is registered but has no
// engine yet (see ./agentRuntime). Adding an executor means a row here, a row
// in ./agents, a runtime in ./agentRuntime and a case in ReviewAvatar.
export const REVIEW_AGENT_IDENTITIES = [
  {
    id: "claude",
    name: "Claude",
    handle: "Claude",
    canSubmitForApproval: true,
  },
  {
    id: "codex",
    name: "Codex",
    handle: "Codex",
    canSubmitForApproval: true,
  },
  {
    id: "grok",
    name: "Grok",
    handle: "Grok",
    canSubmitForApproval: true,
  },
] as const

export type ReviewAgentId = (typeof REVIEW_AGENT_IDENTITIES)[number]["id"]

export interface CanonicalReviewAgentActor {
  kind: "agent"
  id: ReviewAgentId
  name: string
}

export function getReviewAgentIdentity(id: string | null | undefined) {
  if (!id) return undefined
  return REVIEW_AGENT_IDENTITIES.find((agent) => agent.id === id)
}

export function canonicalReviewAgentActor(
  id: string | null | undefined,
): CanonicalReviewAgentActor | undefined {
  const agent = getReviewAgentIdentity(id)
  if (!agent) return undefined
  return { kind: "agent", id: agent.id, name: agent.name }
}

export function canReviewAgentSubmitForApproval(
  id: string | null | undefined,
): boolean {
  return getReviewAgentIdentity(id)?.canSubmitForApproval ?? false
}

/** Behind an auth layer an agent write needs the agent token; the local dev
 *  server (no auth) accepts the explicit agent header as is. */
export function canBridgeSessionWriteAsAgent(session: {
  role: "admin" | "reviewer" | "agent"
  authEnabled: boolean
}): boolean {
  return session.role === "agent" || !session.authEnabled
}

/**
 * Agent identities never belong in the human reviewer picker — a person who
 * named their local account after an agent must not shadow it.
 */
export function isReservedReviewAgentIdentity(identity: {
  id?: string
  name?: string
}): boolean {
  const id = identity.id?.trim().toLowerCase()
  const name = identity.name?.trim().toLowerCase()
  return REVIEW_AGENT_IDENTITIES.some(
    (agent) =>
      id === agent.id ||
      name === agent.name.toLowerCase() ||
      name === agent.handle.toLowerCase(),
  )
}
