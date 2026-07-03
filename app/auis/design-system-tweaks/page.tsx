import type { Metadata } from "next"
import { DesignSystemTweaksClient } from "./_components/DesignSystemTweaksClient"

export const metadata: Metadata = {
  title: "Design System Tweaks",
  description: "Editor visual de foundations do design system Auis.",
}

export default function DesignSystemTweaksPage() {
  return <DesignSystemTweaksClient />
}
