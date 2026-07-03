import { SCHEMA_VERSION } from "../constants"
import type { ReviewActor, ReviewComment, ReviewExportPayload } from "../types"

export function makeId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function formatResolutionSummary(actor: ReviewActor, at: number): string {
  const d = new Date(at)
  const day = pad2(d.getDate())
  const month = pad2(d.getMonth() + 1)
  const year = d.getFullYear()
  const hours = pad2(d.getHours())
  const minutes = pad2(d.getMinutes())
  const seconds = pad2(d.getSeconds())
  return `Resolvido por ${actor.name} em ${day}/${month}/${year} às ${hours}:${minutes}:${seconds}.`
}

export function isReviewComment(value: unknown): value is ReviewComment {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === "string" &&
    (v.schemaVersion === SCHEMA_VERSION || v.schemaVersion === 2) &&
    typeof v.authorId === "string" &&
    typeof v.text === "string" &&
    typeof v.url === "string" &&
    typeof v.anchor === "object"
  )
}

/** Migrate v2 comments (flat resolvedBy/resolvedAt) into v3 shape. */
export function migrateComment(raw: ReviewComment): ReviewComment {
  if (raw.schemaVersion === SCHEMA_VERSION && !("resolvedBy" in raw)) {
    return raw
  }
  const out: ReviewComment = { ...raw, schemaVersion: SCHEMA_VERSION as 3 }
  const legacyBy = (raw as { resolvedBy?: string }).resolvedBy
  const legacyAt = (raw as { resolvedAt?: number }).resolvedAt
  if (!out.resolution && legacyBy) {
    const actor: ReviewActor = { kind: "user", id: "legacy", name: legacyBy }
    const at = legacyAt ?? Date.now()
    out.resolution = {
      actor,
      at,
      summary: formatResolutionSummary(actor, at),
    }
  }
  delete (out as { resolvedBy?: string }).resolvedBy
  delete (out as { resolvedAt?: number }).resolvedAt
  return out
}

export function safeParseComments(raw: string | null): ReviewComment[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isReviewComment).map(migrateComment)
  } catch {
    return []
  }
}

export function safeParseExport(
  raw: string
): ReviewExportPayload | { error: string } {
  try {
    const parsed = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed.schemaVersion !== SCHEMA_VERSION && parsed.schemaVersion !== 2) ||
      !Array.isArray(parsed.comments)
    ) {
      return { error: "Payload inválido (schema desconhecido)." }
    }
    const comments: ReviewComment[] = parsed.comments
      .filter(isReviewComment)
      .map(migrateComment)
    const archivedComments: ReviewComment[] | undefined = Array.isArray(parsed.archivedComments)
      ? parsed.archivedComments.filter(isReviewComment).map(migrateComment)
      : undefined
    return {
      ...(parsed as ReviewExportPayload),
      schemaVersion: SCHEMA_VERSION as 3,
      comments,
      ...(archivedComments ? { archivedComments } : {}),
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "JSON inválido." }
  }
}
