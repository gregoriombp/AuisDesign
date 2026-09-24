"use client"

import * as React from "react"
import type { ReviewComment, ReviewPoint } from "./types"

type Props = {
  position: ReviewPoint
  comment: ReviewComment
  selected: boolean
  onClick: (e: React.MouseEvent) => void
}

function initialOf(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  return trimmed.charAt(0).toUpperCase()
}

const PIN_RADIUS = 12
const PIN_STROKE = 2
const TEXT_SIZE = 11

export function ReviewPinMarker({
  position,
  comment,
  selected,
  onClick,
}: Props) {
  const resolved = comment.status === "resolved"
  const glyph = initialOf(comment.authorName)
  return (
    <g
      transform={`translate(${position.x} ${position.y})`}
      onClick={onClick}
      style={{
        cursor: "pointer",
        opacity: resolved ? 0.4 : 1,
        pointerEvents: "auto",
      }}
    >
      {selected && (
        <circle
          r={PIN_RADIUS + 6}
          fill="none"
          stroke={comment.authorColorToken}
          strokeWidth={2}
          opacity={0.5}
        >
          <animate
            attributeName="r"
            from={PIN_RADIUS + 4}
            to={PIN_RADIUS + 12}
            dur="1.4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            from="0.6"
            to="0"
            dur="1.4s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      <circle r={PIN_RADIUS} fill={comment.authorColorToken} />
      <circle
        r={PIN_RADIUS}
        fill="none"
        stroke="var(--bg-canvas)"
        strokeWidth={PIN_STROKE}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={TEXT_SIZE}
        fontFamily="Geist, sans-serif"
        fontWeight="600"
        fill="var(--fg-on-inverse)"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {glyph}
      </text>
    </g>
  )
}
