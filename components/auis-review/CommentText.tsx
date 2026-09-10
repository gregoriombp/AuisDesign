"use client"

import * as React from "react"
import { AuMentionChip } from "@/components/ui/AuMentionChip"
import { getReviewAgent } from "@/lib/auis-review/agents"
import { getReviewSkill } from "@/lib/auis-review/skills"
import { parseReviewCommand } from "@/lib/auis-review/commandParse"
import { useReviewers } from "@/lib/auis-review/reviewers"
import { PersonHover } from "./PersonHover"

/**
 * Renders a Review Bridge comment/reply body, painting @agent and /skill as
 * AuMentionChips and @person as an inline link-toned mention (hover shows the
 * full name + e-mail), while leaving every other character verbatim (newlines
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
  const reviewers = useReviewers()
  // Known handles enable the @mentionUser segment in the parser — without the
  // list (still loading, or the route is down) an "@jane" stays plain text,
  // exactly as before (see commandParse.ts).
  const userHandles = React.useMemo(
    () => reviewers.map((r) => r.handle),
    [reviewers],
  )
  const byHandle = React.useMemo(
    () => new Map(reviewers.map((r) => [r.handle, r])),
    [reviewers],
  )
  const segments = React.useMemo(
    () => parseReviewCommand(text, { userHandles }).segments,
    [text, userHandles],
  )

  return (
    <p className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <React.Fragment key={i}>{seg.value}</React.Fragment>
        }
        if (seg.type === "mention") {
          const agent = getReviewAgent(seg.agentId)
          return (
            <AuMentionChip
              key={i}
              tone={agent?.tone ?? "neutral"}
              icon={agent?.icon ?? "agent"}
            >
              {agent?.handle ?? seg.value}
            </AuMentionChip>
          )
        }
        if (seg.type === "mentionUser") {
          // A PERSON mention becomes link-looking text (not a chip): brand color,
          // underline on hover, hover text with the e-mail — the raw "@devs" is
          // replaced by a readable "@Dev Team".
          const person = byHandle.get(seg.handle)
          return (
            <PersonHover key={i} email={person?.email}>
              <span className="text-(--accent-brand) font-medium cursor-default hover:underline underline-offset-2">
                @{person?.name ?? seg.handle}
              </span>
            </PersonHover>
          )
        }
        // skill (/slug)
        const skill = getReviewSkill(seg.slug)
        return (
          <AuMentionChip key={i} tone="neutral" icon={skill?.icon ?? "bolt"}>
            {skill?.label ?? seg.value}
          </AuMentionChip>
        )
      })}
    </p>
  )
}
