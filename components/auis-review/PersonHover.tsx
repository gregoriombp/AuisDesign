"use client"

import * as React from "react"
import { useReviewers } from "@/lib/auis-review/reviewers"
import type { ReviewAuthorRole } from "./types"

/**
 * Human identity with hover detail — the "name up front, e-mail on hover"
 * pattern of the Review Bridge. Used in the comment/reply headers and on
 * rendered @mentions. Native `title` tooltip: it works above every review
 * surface (popover/sheet/modal) with no portal or z-index bookkeeping.
 */

const ROLE_LABEL: Record<ReviewAuthorRole, string> = {
  admin: "Admin",
  reviewer: "Guest",
}

/** Friendly display name: older records stored the E-MAIL as the name
 *  ("jane@company.com") — try to resolve the real name through the reviewer
 *  directory; otherwise use the local part of the e-mail. */
export function useAuthorDisplay(input: { name: string; email?: string }): {
  name: string
  email?: string
} {
  const reviewers = useReviewers()
  return React.useMemo(() => {
    const rawName = input.name?.trim() ?? ""
    const looksLikeEmail = rawName.includes("@") && !rawName.includes(" ")
    if (!looksLikeEmail) return { name: rawName || "Reviewer", email: input.email }
    const match = reviewers.find(
      (r) => r.email?.toLowerCase() === rawName.toLowerCase(),
    )
    return {
      name: match?.name ?? rawName.split("@")[0],
      email: input.email ?? rawName,
    }
  }, [input.name, input.email, reviewers])
}

export function personHoverText({
  email,
  role,
  detail,
}: {
  email?: string
  role?: ReviewAuthorRole
  detail?: string
}): string | undefined {
  const lines = [email, [role ? ROLE_LABEL[role] : null, detail].filter(Boolean).join(" · ")]
    .filter((l): l is string => !!l && l.length > 0)
  return lines.length > 0 ? lines.join("\n") : undefined
}

export function PersonHover({
  email,
  role,
  detail,
  children,
}: {
  email?: string
  /** Stamped role (admin/guest) — becomes a line of the hover text. */
  role?: ReviewAuthorRole
  /** Free extra line (e.g. "via shared account"). */
  detail?: string
  children: React.ReactNode
}) {
  const text = personHoverText({ email, role, detail })
  if (!text) return <>{children}</>
  return (
    <span title={text} className="inline-flex min-w-0 max-w-full">
      {children}
    </span>
  )
}

/** Author name with e-mail/role hover — a discreet dotted underline on hover
 *  signals there is more information there. */
export function AuthorName({
  name,
  email,
  role,
  className,
}: {
  name: string
  email?: string
  role?: ReviewAuthorRole
  className?: string
}) {
  const display = useAuthorDisplay({ name, email })
  return (
    <PersonHover email={display.email} role={role}>
      <span
        className={[
          "cursor-default hover:underline decoration-dotted underline-offset-2",
          className ?? "",
        ].join(" ")}
      >
        {display.name}
      </span>
    </PersonHover>
  )
}
