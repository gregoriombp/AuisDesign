"use client"

import * as React from "react"

/**
 * Avatar dos atores do Review Mode. Quatro casos:
 *  · agente Claude   → círculo laranja (clay) com a marca sunburst branca
 *  · agente Germano  → círculo grafite (slate-900) com o monograma "GF"
 *  · usuário greg    → foto de perfil real (/assets/users/greg.jpg)
 *  · qualquer outro  → círculo na cor do autor com a inicial (comportamento antigo)
 */

const GREG_PHOTO = "/assets/users/greg.jpg"
const CLAUDE_CLAY = "#D97757"
const GERMANO_INK = "var(--au-slate-900)"

// `kind !== "user"` (em vez de `=== "agent"`) porque comments de topo não
// carregam authorKind — só replies carregam. Assim o avatar do AUTOR de um
// comentário criado por agente (ex.: pin de bonus do Germano) também resolve
// pelo id/name estável, sem falsar num revisor humano (kind === "user").
function isClaude(kind: string | undefined, id: string | undefined, name: string): boolean {
  return kind !== "user" && (id === "claude" || name.trim().toLowerCase() === "claude")
}

function isGermano(kind: string | undefined, id: string | undefined, name: string): boolean {
  return kind !== "user" && (id === "germano" || name.trim().toLowerCase().startsWith("germano"))
}

function isGreg(id: string | undefined, name: string): boolean {
  const n = name.trim().toLowerCase()
  return id === "u-greg" || n === "greg" || n.startsWith("greg")
}

/** Marca radial do Claude (sunburst de raios alternados) em branco. */
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
    // monograma "GF" em #fff literal (não --fg-on-inverse, que inverte no dark) sobre o grafite fixo
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

  if (isGreg(authorId, authorName)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={GREG_PHOTO}
        alt={label}
        title={label}
        className={base}
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
