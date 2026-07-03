"use client"

import * as React from "react"
import { AuCheckpointChip } from "@/components/ui/AuCheckpointChip"
import { getReviewAgent } from "@/lib/auis-review/agents"
import { getReviewSkill } from "@/lib/auis-review/skills"
import { parseReviewCommand } from "@/lib/auis-review/commandParse"

/**
 * Renders a Review Bridge comment/reply body, painting @agent, /skill and #now
 * as AuCheckpointChips while leaving every other character verbatim (newlines
 * included, via the caller's whitespace-pre-wrap class). The segmentation is
 * lossless, so the text reads exactly as authored — only the commands light up.
 */
export function CommentText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const segments = React.useMemo(() => parseReviewCommand(text).segments, [text])

  return (
    <p className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <React.Fragment key={i}>{seg.value}</React.Fragment>
        }
        if (seg.type === "mention") {
          const agent = getReviewAgent(seg.agentId)
          return (
            <AuCheckpointChip
              key={i}
              tone={agent?.tone ?? "neutral"}
              icon={agent?.icon ?? "agent"}
            >
              {agent?.handle ?? seg.value}
            </AuCheckpointChip>
          )
        }
        if (seg.type === "skill") {
          const skill = getReviewSkill(seg.slug)
          return (
            <AuCheckpointChip key={i} tone="neutral" icon={skill?.icon ?? "bolt"}>
              {skill?.label ?? seg.value}
            </AuCheckpointChip>
          )
        }
        // directive (#now) — the "go" signal that lets an agent act.
        return (
          <AuCheckpointChip key={i} tone="amber" icon="bolt">
            {seg.value}
          </AuCheckpointChip>
        )
      })}
    </p>
  )
}
