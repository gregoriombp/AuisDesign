import type { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    default: "Auis",
    template: "%s · Auis",
  },
  description:
    "Product Builder — design system, page builder and UX flow builder in one place.",
}

export default function AuisLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
