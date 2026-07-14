/**
 * Projects — flows imported (e.g. from Figma) as screen-by-screen navigable projects (ZEROED).
 *
 * The origin product's sample projects were removed. This is the engine's API
 * with an empty list — the `auis-import-figma-flow` skill populates `PROJECTS`
 * (a static manifest) and writes the screenshots to /public/projects/<slug>/.
 * The per-screen actions write requests to /api/project-builds; `auis-project-build-solve`
 * updates `status`/`builtRoute` here when it applies them.
 */

export type ScreenStatus = "imported" | "restyled" | "built"

export type ProjectScreen = {
  id: string
  name: string
  step: string
  section: string
  order: number
  figmaNodeId: string
  thumbnail: string
  w: number
  h: number
  status: ScreenStatus
  builtRoute?: string
}

export type ProjectEdge = {
  source: string
  target: string
  branch?: boolean
}

export type Project = {
  slug: string
  title: string
  description: string
  figmaFileKey: string
  figmaNodeId: string
  figmaUrl: string
  importedAt: string
  updatedAt: string
  screens: ProjectScreen[]
  edges?: ProjectEdge[]
}

export const PROJECTS: Project[] = []

export function getProject(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug)
}

export function getScreen(slug: string, screenId: string): ProjectScreen | undefined {
  return getProject(slug)?.screens.find((s) => s.id === screenId)
}

export type ProjectSection = { section: string; screens: ProjectScreen[] }

/** Groups the screens by section, preserving the (`order`) of first appearance. */
export function getProjectSections(project: Project): ProjectSection[] {
  const order: string[] = []
  const map = new Map<string, ProjectScreen[]>()
  for (const s of [...project.screens].sort((a, b) => a.order - b.order)) {
    if (!map.has(s.section)) {
      map.set(s.section, [])
      order.push(s.section)
    }
    map.get(s.section)!.push(s)
  }
  return order.map((section) => ({ section, screens: map.get(section)! }))
}
