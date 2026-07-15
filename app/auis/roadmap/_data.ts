export type RoadmapStatus = "idea" | "todo" | "in-progress" | "done" | "dropped"
export type RoadmapPriority = "low" | "medium" | "high"
export type RoadmapCategory =
  | "styleguide"
  | "icons"
  | "skills"
  | "infrastructure"
  | "documentation"

export type RoadmapItem = {
  id: string
  title: string
  description: string
  status: RoadmapStatus
  priority: RoadmapPriority
  category: RoadmapCategory
  tags?: string[]
  createdAt: string
  note?: string
}

/**
 * A parking lot, not an authoritative delivery plan. Agents may append ideas
 * here when explicitly asked, but must never start building from this list on
 * their own.
 */
export const ROADMAP: RoadmapItem[] = []
