import Link from "next/link"
import type { Metadata } from "next"
import { AuButton } from "@/components/ui/AuButton"
import { AuCard } from "@/components/ui/AuCard"
import { AuPill } from "@/components/ui/AuPill"
import { AuStatCard } from "@/components/ui/AuStatCard"
import {
  AuEmpty,
  AuEmptyHeader,
  AuEmptyMedia,
  AuEmptyTitle,
  AuEmptyDescription,
} from "@/components/ui/AuEmpty"
import { Icon } from "@/components/ui/Icon"
import { PROJECTS } from "./_data/projects"

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Flows imported from Figma — browse screen by screen and rebuild them in the design system.",
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export default function ProjectsIndex() {
  const totalScreens = PROJECTS.reduce((sum, p) => sum + p.screens.length, 0)

  return (
    <main className="min-h-screen bg-(--bg-canvas) text-(--fg-primary)">
      <div className="max-w-5xl mx-auto px-8 py-16">
        <Link href="/auis" className="no-underline">
          <AuButton variant="ghost" size="sm" iconLeft="arrow_back">
            Auis
          </AuButton>
        </Link>

        <header className="mt-6 mb-10">
          <p className="au-eyebrow mb-3">Projects</p>
          <h1 className="text-5xl font-semibold tracking-tight mb-3">Projects</h1>
          <p className="text-lg text-(--fg-secondary) max-w-2xl">
            Flows imported from Figma become navigable projects. Open one to go
            screen by screen, restyle a screen with the current design system or
            have the page built in the repo.
          </p>
        </header>

        {PROJECTS.length === 0 ? (
          <AuEmpty>
            <AuEmptyHeader>
              <AuEmptyMedia variant="icon">
                <Icon name="dashboard_customize" size={28} />
              </AuEmptyMedia>
              <AuEmptyTitle>No projects imported yet</AuEmptyTitle>
              <AuEmptyDescription>
                Run the <code>auis-import-figma-flow</code> skill with the URL of
                a Figma flow to bring its screens in here.
              </AuEmptyDescription>
            </AuEmptyHeader>
          </AuEmpty>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
              <AuStatCard
                icon="dashboard"
                label="Projects"
                value={PROJECTS.length}
              />
              <AuStatCard
                icon="web_asset"
                label="Screens imported"
                value={totalScreens}
              />
              <AuStatCard
                icon="design_services"
                label="Source"
                value="Figma"
                hint="Screenshots rendered via Figma MCP"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PROJECTS.map((p) => (
                <AuCard
                  key={p.slug}
                  interactive
                  className="p-6 flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between">
                    <span
                      className="inline-flex items-center justify-center rounded-md bg-(--bg-surface)"
                      style={{ width: 44, height: 44 }}
                    >
                      <Icon name="dashboard" size={24} />
                    </span>
                    <AuPill variant="neutral">
                      {p.screens.length} {p.screens.length === 1 ? "screen" : "screens"}
                    </AuPill>
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-xl font-semibold">{p.title}</h3>
                    <p className="text-sm text-(--fg-secondary) leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                  <div className="mt-auto pt-2 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-(--fg-tertiary)">
                      <Icon name="schedule" size={13} />
                      Imported on {formatDate(p.importedAt)}
                    </span>
                    <Link
                      href={`/auis/projects/${p.slug}`}
                      className="no-underline"
                    >
                      <AuButton variant="primary" iconRight="arrow_forward">
                        Open
                      </AuButton>
                    </Link>
                  </div>
                </AuCard>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
