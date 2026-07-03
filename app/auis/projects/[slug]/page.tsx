import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AuButton } from "@/components/ui/AuButton"
import { Icon } from "@/components/ui/Icon"
import {
  PROJECTS,
  getProject,
  getProjectSections,
} from "../_data/projects"
import { ProjectViews } from "../_components/ProjectViews"

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const project = getProject(slug)
  return { title: project ? `${project.title} · Projetos` : "Projetos" }
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export default async function ProjectViewer({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const project = getProject(slug)
  if (!project) notFound()

  const sections = getProjectSections(project)

  return (
    <main className="min-h-screen bg-(--bg-canvas) text-(--fg-primary)">
      <div className="max-w-[1400px] mx-auto px-8 py-12">
        <Link href="/auis/projects" className="no-underline">
          <AuButton variant="ghost" size="sm" iconLeft="arrow_back">
            Projetos
          </AuButton>
        </Link>

        <header className="mt-6 mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="au-eyebrow mb-2">{project.title}</p>
            <h1 className="text-4xl font-semibold tracking-tight">Telas</h1>
            <p className="mt-2 max-w-2xl leading-relaxed text-(--fg-secondary)">
              {project.description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-(--fg-tertiary)">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="web_asset" size={13} />
                {project.screens.length} telas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="account_tree" size={13} />
                {sections.length} seções
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="schedule" size={13} />
                Importado em {formatDate(project.importedAt)}
              </span>
            </div>
          </div>
          <a
            href={project.figmaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline shrink-0"
          >
            <AuButton variant="ghost" size="sm" iconRight="open_in_new">
              Ver no Figma
            </AuButton>
          </a>
        </header>

        <ProjectViews project={project} />
      </div>
    </main>
  )
}
