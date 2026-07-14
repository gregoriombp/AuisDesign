"use client"

import * as React from "react"
import { Icon } from "@/components/ui/Icon"
import { getProjectSections, type Project } from "../_data/projects"
import { ScreenGrid } from "./ScreenGrid"
import { ProjectFlow } from "./ProjectFlow"

/**
 * Switches between the project's two views: "Screens" (gallery grouped by
 * section) and "Flow" (a ReactFlow diagram wiring the screens together with the
 * arrows inferred from the Figma connectors). The Flow toggle only shows up when
 * the project has `edges`.
 */
export function ProjectViews({ project }: { project: Project }) {
  const hasFlow = (project.edges?.length ?? 0) > 0
  const [view, setView] = React.useState<"screens" | "flow">("screens")
  const sections = getProjectSections(project)
  const showFlow = hasFlow && view === "flow"

  return (
    <>
      {hasFlow && (
        <div className="mb-8 inline-flex rounded-full border border-(--border-default) p-1">
          <ViewToggle
            active={view === "screens"}
            onClick={() => setView("screens")}
            icon="grid_view"
            label="Screens"
          />
          <ViewToggle
            active={view === "flow"}
            onClick={() => setView("flow")}
            icon="account_tree"
            label="Flow"
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
                {screens.length} {screens.length === 1 ? "screen" : "screens"}
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
