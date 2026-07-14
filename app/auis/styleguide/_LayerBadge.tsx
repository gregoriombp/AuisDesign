"use client"

import { usePathname } from "next/navigation"
import { navigation } from "./navigation"
import { AuPill } from "@/components/ui/AuPill"

/**
 * "You are here" badge: derives the current page's layer from the `navigation`
 * section that contains the route. Renders only on the 4 component layers —
 * Foundations/Brand/Intro/Playground/UX Flows get no badge. No extra field on
 * NavItem: the section IS the source of truth for the layer.
 *
 * These must match the `title` of the sections you create in navigation.ts.
 */
const LAYER_TITLES = new Set(["Primitives", "Components", "Patterns", "Domain"])

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
