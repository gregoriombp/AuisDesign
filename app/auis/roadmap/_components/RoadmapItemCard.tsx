import { AuCard } from "@/components/ui/AuCard"
import { AuPill } from "@/components/ui/AuPill"
import { Icon } from "@/components/ui/Icon"
import type { RoadmapItem } from "../_data"

const STATUS_LABEL: Record<RoadmapItem["status"], string> = {
  idea: "Idea",
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
  dropped: "Dropped",
}

export function RoadmapItemCard({ item }: { item: RoadmapItem }) {
  return (
    <AuCard className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-lg font-semibold text-fg-primary">{item.title}</h3>
          <p className="text-sm leading-relaxed text-fg-secondary">{item.description}</p>
        </div>
        <AuPill variant={item.status === "done" ? "live" : "neutral"}>
          {STATUS_LABEL[item.status]}
        </AuPill>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-fg-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="category" size={14} />
          {item.category}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="priority_high" size={14} />
          {item.priority}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="calendar_today" size={14} />
          {item.createdAt}
        </span>
      </div>
      {item.note ? (
        <p className="rounded-md bg-muted p-3 text-xs leading-relaxed text-fg-secondary">
          {item.note}
        </p>
      ) : null}
    </AuCard>
  )
}
