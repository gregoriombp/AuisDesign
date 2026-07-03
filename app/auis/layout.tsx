import type { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    default: "Auis",
    template: "%s · Auis",
  },
  description:
    "Product Builder — design system, page builder e UX flow builder em um só lugar.",
}

export default function AuisLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
