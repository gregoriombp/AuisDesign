import { createHash } from "node:crypto"

export type FlowActor = {
  kind: "agent" | "user"
  id: string
  name: string
}

export type FlowSnapshot = {
  nodes: unknown[]
  edges: unknown[]
}

export type FlowMaterializationReceiptInput = {
  baseRevision: string
  baseHash: string
  files: string[]
  validations: string[]
  summary: string
}

type FlowSession = {
  role: "admin" | "reviewer" | "agent"
  email: string | null
  authEnabled: boolean
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}

function canonicalCollection(items: unknown[]): unknown[] {
  return structuredClone(items).sort((a, b) => {
    const aRecord = a && typeof a === "object" ? (a as Record<string, unknown>) : null
    const bRecord = b && typeof b === "object" ? (b as Record<string, unknown>) : null
    const aId = typeof aRecord?.id === "string" ? aRecord.id : ""
    const bId = typeof bRecord?.id === "string" ? bRecord.id : ""
    return aId.localeCompare(bId) || stableJson(a).localeCompare(stableJson(b))
  })
}

/**
 * Canonical source captured when a structural suggestion is created. Ordering
 * nodes or edges in the editor does not create a different base revision.
 */
export function canonicalizeFlowSnapshot(
  nodes: unknown[],
  edges: unknown[],
): FlowSnapshot {
  return {
    nodes: canonicalCollection(nodes),
    edges: canonicalCollection(edges),
  }
}

export function hashFlowSnapshot(nodes: unknown[], edges: unknown[]): string {
  const snapshot = canonicalizeFlowSnapshot(nodes, edges)
  return createHash("sha256").update(stableJson(snapshot)).digest("hex")
}

export function canonicalFlowRevision(flow: string, hash: string): string {
  return `flow:${flow}@${hash.slice(0, 12)}`
}

export function hasCanonicalBase(input: {
  flow: string
  baseRevision?: string
  baseHash?: string
  baseSnapshot?: FlowSnapshot
}): boolean {
  if (!input.baseSnapshot || !input.baseHash || !input.baseRevision) return false
  const computedHash = hashFlowSnapshot(
    input.baseSnapshot.nodes,
    input.baseSnapshot.edges,
  )
  return (
    computedHash === input.baseHash &&
    input.baseRevision === canonicalFlowRevision(input.flow, computedHash)
  )
}

/** Actor persisted by flow-suggestion writes. Never accepts client input. */
export function flowActorForSession(session: FlowSession): FlowActor {
  if (session.role === "agent") {
    return { kind: "agent", id: "claude", name: "Claude" }
  }
  if (session.email) {
    return {
      kind: "user",
      id: `user:${session.email.toLowerCase()}`,
      name: session.email,
    }
  }
  return session.authEnabled
    ? { kind: "user", id: "authenticated-user", name: "Signed-in user" }
    : { kind: "user", id: "local-admin", name: "Local admin" }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || !value.every(nonEmptyString)) {
    return null
  }
  return value.map((item) => item.trim())
}

export function parseFlowMaterializationReceipt(
  value: unknown,
): FlowMaterializationReceiptInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const files = stringList(record.files)
  const validations = stringList(record.validations)
  if (
    !nonEmptyString(record.baseRevision) ||
    !nonEmptyString(record.baseHash) ||
    !nonEmptyString(record.summary) ||
    !files ||
    !validations
  ) {
    return null
  }
  return {
    baseRevision: record.baseRevision.trim(),
    baseHash: record.baseHash.trim(),
    files,
    validations,
    summary: record.summary.trim(),
  }
}
