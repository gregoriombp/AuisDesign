"use client"

import * as React from "react"
import { Icon } from "@/components/ui/Icon"
import { getProjectSections, type Project } from "../_data/projects"
import { ScreenGrid } from "./ScreenGrid"
import { ProjectFlow } from "./ProjectFlow"

/**
 * Alterna entre as duas vistas do projeto: "Telas" (galeria agrupada por seção)
 * e "Fluxo" (diagrama ReactFlow com as telas ligadas pelas setas inferidas dos
 * conectores do Figma). O toggle de Fluxo só aparece se o projeto tem `edges`.
 */
export function ProjectViews({ project }: { project: Project }) {
  const hasFlow = (project.edges?.length ?? 0) > 0
  const [view, setView] = React.useState<"telas" | "fluxo">("telas")
  const sections = getProjectSections(project)
  const showFlow = hasFlow && view === "fluxo"

  return (
    <>
      {hasFlow && (
        <div className="mb-8 inline-flex rounded-full border border-(--border-default) p-1">
          <ViewToggle
            active={view === "telas"}
            onClick={() => setView("telas")}
            icon="grid_view"
            label="Telas"
          />
          <ViewToggle
            active={view === "fluxo"}
            onClick={() => setView("fluxo")}
            icon="account_tree"
            label="Fluxo"
          />
        </div>
      )}

      {showFlow ? (
        <ProjectFlow project={project} />
      ) : (
        sections.map(({ section, screens }) => (
          <section key={section} className="mb-12">
            <div className="mb-4 flex items-baseline gap-3 border-b border-(--border-subtle) pb-2">
              <h2 className="text-lg font-semibold tracking-tight">{section}</h2>
              <span className="text-xs text-(--fg-tertiary)">
                {screens.length} {screens.length === 1 ? "tela" : "telas"}
              </span>
            </div>
            <ScreenGrid
              projectSlug={project.slug}
              figmaFileKey={project.figmaFileKey}
              screens={screens}
            />
          </section>
        ))
      )}
    </>
  )
}

function ViewToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: string
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-full bg-(--bg-inverse) px-3.5 py-1.5 text-xs font-medium text-(--fg-on-inverse)"
          : "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-(--fg-secondary) hover:text-(--fg-primary)"
      }
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  )
}
