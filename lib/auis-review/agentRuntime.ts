// The engine behind each Review Bridge agent: which CLI opens, which ceilings
// the Agents panel offers, which models and at what effort. The panel reads it
// to draw the row; the write routes, to decide whether a mention opens a
// process; the runner (scripts/mention-run.mjs), through GET /agent-settings,
// to build the command.
//
// RELATIVE import on purpose: this module runs under
// lib/__tests__/ts-extension-loader.mjs, which only resolves "./x" and "../x"
// (see agentIdentity.ts).
import { REVIEW_AGENT_IDENTITIES, type ReviewAgentId } from "./agentIdentity"

/** The agent's ceiling. The comment's wording can ask for less; never more. */
export type ReviewAgentPermission = "reply" | "edit"
export type ReviewAgentCli = "claude" | "grok"
export type ReviewAgentEffort = "low" | "medium" | "high" | "xhigh"

export interface ReviewAgentSettings {
  /** Off = a mention never opens a process. */
  enabled: boolean
  permission: ReviewAgentPermission
  /** Id handed to the CLI; always one of the runtime's `models` (null when there are none). */
  model: string | null
}

export type ReviewAgentSettingsMap = Record<string, ReviewAgentSettings>

export interface ReviewAgentModel {
  id: string
  label: string
}

export interface ReviewAgentRuntime {
  /** CLI the runner opens; null = no engine (the row shows, the toggle stays locked). */
  cli: ReviewAgentCli | null
  /** Status line shown when `cli` is null. */
  unavailable?: string
  /** Ceilings offered, in selector order. */
  permissions: readonly ReviewAgentPermission[]
  /** More than one → a selector in the row; exactly one → the runner uses it, the panel hides it. */
  models: readonly ReviewAgentModel[]
  /** Effort per ceiling; absent = the CLI gets no --effort (the model's default). */
  effort: Partial<Record<ReviewAgentPermission, ReviewAgentEffort>>
  defaults: ReviewAgentSettings
}

export const REVIEW_AGENT_RUNTIME: Record<ReviewAgentId, ReviewAgentRuntime> = {
  claude: {
    cli: "claude",
    permissions: ["reply", "edit"],
    models: [
      { id: "claude-opus-5-5", label: "Opus 5.5" },
      { id: "claude-fable-5-1", label: "Fable 5.1" },
      { id: "claude-sonnet-5", label: "Sonnet 5" },
    ],
    // Reply stays on the model's default effort. Edit goes up to high — the
    // level a real fix needs.
    effort: { edit: "high" },
    defaults: { enabled: true, permission: "edit", model: "claude-opus-5-5" },
  },
  codex: {
    cli: null,
    unavailable: "Under study — no CLI wired yet",
    permissions: ["reply", "edit"],
    models: [],
    effort: {},
    defaults: { enabled: false, permission: "reply", model: null },
  },
  grok: {
    cli: "grok",
    permissions: ["reply", "edit"],
    // The ids `grok models` lists for a grok.com account (Grok Build 1.0.41).
    models: [
      { id: "grok-4.7", label: "Grok 4.7" },
      { id: "grok-4.7-build-fast", label: "Grok 4.7 Fast" },
    ],
    effort: {},
    defaults: { enabled: false, permission: "reply", model: "grok-4.7" },
  },
}

export function getReviewAgentRuntime(id: string): ReviewAgentRuntime | undefined {
  return (REVIEW_AGENT_RUNTIME as Record<string, ReviewAgentRuntime | undefined>)[id]
}

/**
 * What is stored, in the shape the panel and the runner use without thinking.
 * The previous shape (liveResponse/autoConstruct) never governed the trigger,
 * so it falls back to the defaults.
 */
export function normalizeAgentSettings(
  id: string,
  raw: unknown,
): ReviewAgentSettings | undefined {
  const runtime = getReviewAgentRuntime(id)
  if (!runtime) return undefined
  const stored = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  if (typeof stored.enabled !== "boolean") return { ...runtime.defaults }
  const permission =
    runtime.permissions.find((p) => p === stored.permission) ?? runtime.defaults.permission
  const model =
    runtime.models.find((m) => m.id === stored.model)?.id ?? runtime.defaults.model
  return { enabled: runtime.cli !== null && stored.enabled, permission, model }
}

export function normalizeAgentSettingsMap(raw: unknown): ReviewAgentSettingsMap {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const out: ReviewAgentSettingsMap = {}
  for (const { id } of REVIEW_AGENT_IDENTITIES) {
    const settings = normalizeAgentSettings(id, source[id])
    if (settings) out[id] = settings
  }
  return out
}

/** Strict write: whatever does not fit the agent's runtime is refused, not corrected. */
export function validateAgentSettings(id: string, raw: unknown): ReviewAgentSettings | null {
  const runtime = getReviewAgentRuntime(id)
  if (!runtime || !raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.enabled !== "boolean") return null
  if (r.enabled && runtime.cli === null) return null
  const permission = runtime.permissions.find((p) => p === r.permission)
  if (!permission) return null
  const model =
    runtime.models.length === 0 ? null : runtime.models.find((m) => m.id === r.model)?.id
  if (model === undefined) return null
  return { enabled: r.enabled, permission, model }
}

/** Gate 5 of the mention trigger: only an agent with an engine, switched on, opens a process. */
export function runnableMentions(
  mentions: readonly string[],
  settings: ReviewAgentSettingsMap,
): string[] {
  return mentions.filter(
    (id) => getReviewAgentRuntime(id)?.cli != null && settings[id]?.enabled === true,
  )
}
