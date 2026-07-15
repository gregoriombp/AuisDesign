import Link from "next/link"
import type { Metadata } from "next"
import { RoadmapItemCard } from "./_components/RoadmapItemCard"
import { ROADMAP, type RoadmapStatus } from "./_data"
import { AuButton } from "@/components/ui/AuButton"
import {
  AuEmpty,
  AuEmptyContent,
  AuEmptyDescription,
  AuEmptyHeader,
  AuEmptyMedia,
  AuEmptyTitle,
} from "@/components/ui/AuEmpty"
import { Icon } from "@/components/ui/Icon"

export const metadata: Metadata = {
  title: "Roadmap",
  description: "A lightweight parking lot for ideas about the Auis builder.",
}

const STATUS_ORDER: RoadmapStatus[] = ["in-progress", "todo", "idea", "done", "dropped"]
const STATUS_LABEL: Record<RoadmapStatus, string> = {
  "in-progress": "In progress",
  todo: "To do",
  idea: "Ideas",
  done: "Done",
  dropped: "Dropped",
}

export default function RoadmapPage() {
  return (
    <main className="min-h-screen bg-canvas text-fg-primary">
      <div className="mx-auto max-w-5xl px-8 py-16">
        <AuButton asChild variant="ghost" size="sm" iconLeft="arrow_back">
          <Link href="/auis">Auis</Link>
        </AuButton>
        <header className="mb-10 mt-8 max-w-2xl">
          <p className="au-eyebrow mb-3">Auis</p>
          <h1 className="mb-3 text-5xl font-semibold tracking-tight">Roadmap</h1>
          <p className="text-lg leading-relaxed text-fg-secondary">
            A parking lot for builder ideas and follow-ups. It is not a delivery plan,
            and agents must not treat it as permission to start work.
          </p>
        </header>

        {ROADMAP.length === 0 ? (
          <AuEmpty>
            <AuEmptyHeader>
              <AuEmptyMedia variant="icon">
                <Icon name="flag" size={24} />
              </AuEmptyMedia>
              <AuEmptyTitle>No parked ideas</AuEmptyTitle>
              <AuEmptyDescription>
                Add an item to <code>app/auis/roadmap/_data.ts</code> when you want
                to keep a thought without turning it into a task.
              </AuEmptyDescription>
            </AuEmptyHeader>
            <AuEmptyContent>
              <AuButton asChild variant="secondary" iconLeft="home">
                <Link href="/auis">Back to hub</Link>
              </AuButton>
            </AuEmptyContent>
          </AuEmpty>
        ) : (
          <div className="flex flex-col gap-10">
            {STATUS_ORDER.map((status) => {
              const items = ROADMAP.filter((item) => item.status === status)
              if (items.length === 0) return null
              return (
                <section key={status}>
                  <h2 className="mb-4 text-xl font-semibold tracking-tight">
                    {STATUS_LABEL[status]}
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    {items.map((item) => (
                      <RoadmapItemCard key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
