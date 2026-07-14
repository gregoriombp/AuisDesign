import type { Metadata } from "next"
import { DesignSystemTweaksClient } from "./_components/DesignSystemTweaksClient"

export const metadata: Metadata = {
  title: "Design System Tweaks",
  description: "Visual editor for the Auis design system's foundations.",
}

export default function DesignSystemTweaksPage() {
  return <DesignSystemTweaksClient />
}
