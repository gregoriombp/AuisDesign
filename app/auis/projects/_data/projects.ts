/**
 * Projetos — flows importados (ex.: do Figma) como projetos navegáveis tela-a-tela (ZEROED).
 *
 * Os projetos de exemplo do produto de origem foram removidos. Esta é a API do
 * engine com a lista vazia — o skill `auis-import-figma-flow` popula `PROJECTS`
 * (manifest estático) e grava os screenshots em /public/projects/<slug>/.
 * As ações por tela gravam pedidos em /api/project-builds; `auis-project-build-solve`
 * atualiza `status`/`builtRoute` aqui ao aplicar.
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

/** Agrupa as telas por seção, preservando a ordem (`order`) de primeira aparição. */
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
