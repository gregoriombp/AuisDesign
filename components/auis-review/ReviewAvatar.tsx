"use client"

import * as React from "react"
import { getReviewAgent, getReviewAgentByHandle } from "@/lib/auis-review/agents"

/**
 * Avatar for the Review Mode actors:
 *  · an agent   → its official mark (public/assets/agents/, from the registry)
 *  · any human  → circle in the author's color with their initial
 *
 * The human branch is token-only (no raw hex) so it survives every brand theme
 * Auis renders under.
 */

// `kind !== "user"` (rather than `=== "agent"`) preserves the visual identity of
// older records that do not carry authorKind yet: they are matched by id, then
// by the name the agent signed with. New comments and replies are stamped by
// the server.
function agentOf(kind: string | undefined, id: string | undefined, name: string) {
  if (kind === "user") return undefined
  return (id ? getReviewAgent(id) : undefined) ?? getReviewAgentByHandle(name.trim())
}

export function ReviewAvatar({
  authorKind,
  authorId,
  authorName,
  colorToken,
  size = 24,
  title,
  className,
}: {
  authorKind?: "agent" | "user"
  authorId?: string
  authorName: string
  colorToken: string
  size?: number
  title?: string
  className?: string
}) {
  const dim = { width: size, height: size }
  const base = `shrink-0 rounded-full inline-flex items-center justify-center overflow-hidden ${className ?? ""}`
  const label = title ?? authorName
  const agent = agentOf(authorKind, authorId, authorName)

  if (agent) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={agent.mark}
        alt={label}
        title={label}
        // The ring keeps a light mark (OpenAI's white tile) legible on a light surface.
        className={`${base} ring-1 ring-(--border-subtle)`}
        style={{ ...dim, objectFit: "cover" }}
      />
    )
  }

  return (
    <span
      className={`${base} font-semibold text-(--fg-on-inverse)`}
      style={{ ...dim, background: colorToken, fontSize: Math.round(size * 0.42) }}
      title={label}
      aria-label={label}
    >
      {authorName.charAt(0).toUpperCase()}
    </span>
  )
}
