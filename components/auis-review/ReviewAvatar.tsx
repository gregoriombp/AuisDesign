"use client"

import * as React from "react"
import { Icon } from "@/components/ui/Icon"

/**
 * Avatar for the Review Mode actors:
 *  · Claude agent   → amber circle with the asterisk glyph
 *  · Codex agent    → teal circle with the terminal glyph
 *  · Grok agent     → inverse circle with the bolt glyph
 *  · any human      → circle in the author's color with their initial
 *
 * Token-only (no raw hex, no inline SVG marks, no brand assets) so it survives
 * every brand theme Auis renders under.
 */

// `kind !== "user"` (rather than `=== "agent"`) preserves the visual identity of
// older records that do not carry authorKind yet. New comments and replies are
// stamped by the server.
function isClaude(kind: string | undefined, id: string | undefined, name: string): boolean {
  return kind !== "user" && (id === "claude" || name.trim().toLowerCase() === "claude")
}

function isCodex(kind: string | undefined, id: string | undefined, name: string): boolean {
  return kind !== "user" && (id === "codex" || name.trim().toLowerCase() === "codex")
}

function isGrok(kind: string | undefined, id: string | undefined, name: string): boolean {
  return kind !== "user" && (id === "grok" || name.trim().toLowerCase() === "grok")
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

  if (isClaude(authorKind, authorId, authorName)) {
    return (
      <span
        className={`${base} bg-au-amber-600 text-fg-on-inverse`}
        style={dim}
        title={label}
        aria-label={label}
      >
        <Icon name="asterisk" size={Math.round(size * 0.64)} weight={500} />
      </span>
    )
  }

  if (isCodex(authorKind, authorId, authorName)) {
    return (
      <span
        className={`${base} bg-au-teal-600 text-fg-on-inverse`}
        style={dim}
        title={label}
        aria-label={label}
      >
        <Icon name="terminal" size={Math.round(size * 0.6)} weight={500} />
      </span>
    )
  }

  if (isGrok(authorKind, authorId, authorName)) {
    return (
      <span
        className={`${base} bg-(--bg-inverse) text-(--fg-on-inverse)`}
        style={dim}
        title={label}
        aria-label={label}
      >
        <Icon name="bolt" size={Math.round(size * 0.6)} weight={500} />
      </span>
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
