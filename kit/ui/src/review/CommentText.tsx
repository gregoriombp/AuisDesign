"use client"

import * as React from "react"
import { getReviewAgent } from "@auis/core/agents"
import { getReviewSkill } from "@auis/core/skills"
import { parseReviewCommand } from "@auis/core/commandParse"
import { useReviewers } from "./reviewers"
import { PersonHover } from "./PersonHover"
import { ReviewAvatar } from "./ReviewAvatar"

/**
 * A Review Bridge comment or reply body. @agent becomes amber text with the
 * agent's mark, /skill becomes purple text and @person a link-toned mention
 * (hover shows the full name and e-mail). Everything else comes out as written,
 * line breaks included through the caller's whitespace-pre-wrap: the
 * segmentation loses no character, it only lights up the commands. The text
 * runs without boxes in the middle of a sentence.
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

  // <div>, not <p>: callers pass block layout.
  return (
    <div className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <React.Fragment key={i}>{seg.value}</React.Fragment>
        }
        if (seg.type === "mention") {
          const agent = getReviewAgent(seg.agentId)
          return (
            <span
              key={i}
              className="whitespace-nowrap text-(--au-amber-700) dark:text-(--au-amber-400)"
            >
              <ReviewAvatar
                authorKind="agent"
                authorId={seg.agentId}
                authorName={agent?.name ?? seg.value}
                colorToken="var(--au-amber-700)"
                size={16}
                className="mr-1 align-middle"
              />
              {agent?.name ?? seg.value}
            </span>
          )
        }
        if (seg.type === "mentionUser") {
          // A PERSON mention becomes link-looking text (not a chip): brand color,
          // underline on hover, hover text with the e-mail — the raw "@devs" is
          // replaced by a readable "@Dev Team".
          const person = byHandle.get(seg.handle)
          return (
            <PersonHover key={i} email={person?.email}>
              <span className="text-(--auis-accent-brand) font-medium cursor-default hover:underline underline-offset-2">
                @{person?.name ?? seg.handle}
              </span>
            </PersonHover>
          )
        }
        // skill (/slug)
        const skill = getReviewSkill(seg.slug)
        return (
          <span
            key={i}
            title={skill?.label}
            className="text-(--au-purple-600) dark:text-(--au-purple-400)"
          >
            {seg.value}
          </span>
        )
      })}
    </div>
  )
}
