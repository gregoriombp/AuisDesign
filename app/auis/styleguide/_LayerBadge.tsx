"use client"

import { usePathname } from "next/navigation"
import { navigation } from "./navigation"
import { AuPill } from "@/components/ui/AuPill"

/**
 * Selo "você está aqui": deriva a camada da página atual a partir da seção do
 * `navigation` que contém a rota. Renderiza só nas 4 camadas de componente —
 * Foundations/Brand/Intro/Playground/UX Flows não recebem selo. Sem campo extra
 * em NavItem: a seção JÁ é a fonte de verdade da camada.
 */
const LAYER_TITLES = new Set(["Primitivos", "Componentes", "Padrões", "Domínio"])

export function LayerBadge() {
  const pathname = usePathname()
  const section = navigation.find((s) =>
    s.items.some((item) => item.href === pathname)
  )
  if (!section || !LAYER_TITLES.has(section.title)) return null
  return (
    <AuPill variant="neutral" dot={false}>
      {section.title}
    </AuPill>
  )
}
