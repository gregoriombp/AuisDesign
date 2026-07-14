"use client"

import * as React from "react"

/**
 * Avatar for the Review Mode actors. Three cases:
 *  · Claude agent   → clay-orange circle with the white sunburst mark
 *  · Germano agent  → graphite circle (slate-900) with the "GF" monogram
 *  · any human      → circle in the author's color with their initial
 */

const CLAUDE_CLAY = "#D97757"
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

/** Claude's radial mark (sunburst of alternating rays), in white. */
function ClaudeMark({ size }: { size: number }) {
  const c = 12
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180
    const outer = i % 2 === 0 ? 9 : 6.1
    const inner = 2.3
    return {
      x1: c + inner * Math.cos(a),
      y1: c + inner * Math.sin(a),
      x2: c + outer * Math.cos(a),
      y2: c + outer * Math.sin(a),
    }
  })
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {rays.map((r, i) => (
        <line
          key={i}
          x1={r.x1}
          y1={r.y1}
          x2={r.x2}
          y2={r.y2}
          stroke="#fff"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
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
        className={base}
        style={{ ...dim, background: CLAUDE_CLAY }}
        title={label}
        aria-label={label}
      >
        <ClaudeMark size={Math.round(size * 0.64)} />
      </span>
    )
  }

  if (isGermano(authorKind, authorId, authorName)) {
    // "GF" monogram in literal #fff (not --fg-on-inverse, which flips in dark) on the fixed graphite
    return (
      <span
        className={`${base} font-semibold tracking-tight`}
        style={{ ...dim, background: GERMANO_INK, color: "#fff", fontSize: Math.round(size * 0.36) }}
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
