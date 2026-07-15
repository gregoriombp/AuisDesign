"use client"

import * as React from "react"
import { Icon } from "@/components/ui/Icon"

/**
 * Avatar for the Review Mode actors. Three cases:
 *  · Claude agent   → amber circle with a neutral agent glyph
 *  · Germano agent  → graphite circle (slate-900) with the "GF" monogram
 *  · any human      → circle in the author's color with their initial
 */

const GERMANO_INK = "var(--au-slate-900)"

// `kind !== "user"` (rather than `=== "agent"`) because top-level comments do
// not carry authorKind — only replies do. That way the avatar of the AUTHOR of a
// comment created by an agent (e.g. a bonus pin from Germano) also resolves
// through the stable id/name, without misfiring on a human reviewer
// (kind === "user").
function isClaude(kind: string | undefined, id: string | undefined, name: string): boolean {
  return kind !== "user" && (id === "claude" || name.trim().toLowerCase() === "claude")
}

function isGermano(kind: string | undefined, id: string | undefined, name: string): boolean {
  return kind !== "user" && (id === "germano" || name.trim().toLowerCase().startsWith("germano"))
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

  if (isGermano(authorKind, authorId, authorName)) {
    return (
      <span
        className={`${base} font-semibold tracking-tight`}
        style={{ ...dim, background: GERMANO_INK, color: "var(--fg-on-inverse)", fontSize: Math.round(size * 0.36) }}
        title={label}
        aria-label={label}
      >
        GF
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
