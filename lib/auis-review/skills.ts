// Curated registry of the agent skills a reviewer can reference inline with "/"
// in a Review Bridge comment. Single source of truth for the "/" autocomplete
// menu AND documentation of which skills each agent (see ./agents) may run.
//
// Intentionally a small, hand-picked subset of `.claude/skills/auis-*` —
// only the ones meaningful as a *live command* inside a comment. The full skill
// catalog lives on disk; this list is the product-facing surface.

export type ReviewSkillSlug =
  | "auis-review-bridge-solve"
  | "auis-ux-writing"
  | "auis-edit-bridge-solve"
  | "auis-review-bridge-germano-explore"
  | "auis-review-bridge-germano-audit"

export interface ReviewSkill {
  /** Exact skill name under `.claude/skills` — what "/" inserts into the text. */
  slug: ReviewSkillSlug
  /** Short human label for the picker row. */
  label: string
  /** Material Symbol glyph. */
  icon: string
  /** One-liner shown as the picker blurb. */
  blurb: string
  /** Agent that owns/runs this skill (see ./agents), or null if generic. */
  ownerId: "claude" | "germano" | null
  /** True when running it mutates the prototype (gated behind #now + Auto Construct). */
  acts: boolean
}

export const REVIEW_SKILLS: readonly ReviewSkill[] = [
  {
    slug: "auis-review-bridge-solve",
    label: "Resolve comments",
    icon: "checklist",
    blurb: "Reads the page's comments and implements the fixes, leaving each one in review.",
    ownerId: "claude",
    acts: true,
  },
  {
    slug: "auis-ux-writing",
    label: "UX Writing",
    icon: "edit_note",
    blurb: "Reviews the interface copy against the product voice and applies the rewrites.",
    ownerId: "claude",
    acts: true,
  },
  {
    slug: "auis-edit-bridge-solve",
    label: "Materialize edits",
    icon: "handyman",
    blurb: "Turns Live Edit Mode edits into real code.",
    ownerId: "claude",
    acts: true,
  },
  {
    slug: "auis-review-bridge-germano-explore",
    label: "Germano · Explore",
    icon: "travel_explore",
    blurb: "Patrols the page, tests states and pins UI/UX suggestions.",
    ownerId: "germano",
    acts: true,
  },
  {
    slug: "auis-review-bridge-germano-audit",
    label: "Germano · Audit review",
    icon: "rule",
    blurb: "Gives a second opinion on the items already in review.",
    ownerId: "germano",
    acts: true,
  },
]

const BY_SLUG = new Map<string, ReviewSkill>(REVIEW_SKILLS.map((s) => [s.slug, s]))

export function getReviewSkill(slug: string): ReviewSkill | undefined {
  return BY_SLUG.get(slug)
}

export function isReviewSkillSlug(slug: string): slug is ReviewSkillSlug {
  return BY_SLUG.has(slug)
}
