/**
 * Metadados leves dos UX flows do styleguide (ZEROED).
 *
 * Os flows de exemplo do produto de origem foram removidos. Esta é a API do
 * engine com a lista vazia — popule conforme criar flows (ex.: via
 * `auis-create-ux-flow` / `auis-pg-create-flow`), adicionando uma entrada aqui
 * e a flow-data em `[slug]/flow-data.ts`.
 *
 * `screens` = contagem de telas (nós "screen"); `updatedAt` = última atualização.
 */

export type FlowGroup = string

export type FlowMeta = {
  slug: string
  title: string
  description: string
  group: FlowGroup
  /** Altura do canvas usada na página do styleguide — reaproveitada no viewer. */
  height: number
  /** Telas (nós "screen") no flow. */
  screens: number
  /** Última atualização registrada no `updates[]` da página. */
  updatedAt: string
}

export const FLOW_META: FlowMeta[] = []

export const FLOW_GROUPS: FlowGroup[] = []

export function getFlowMeta(slug: string): FlowMeta | undefined {
  return FLOW_META.find((f) => f.slug === slug)
}
