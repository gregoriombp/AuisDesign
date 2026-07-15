import type { Metadata } from "next"
import { getBrand } from "./_data/brand"
import { BrandProvider } from "./_data/BrandProvider"

export const metadata: Metadata = {
  title: {
    default: "Auis",
    template: "%s · Auis",
  },
  description:
    "Product Builder — design system, page builder and UX flow builder in one place.",
}

export default async function AuisLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Resolve the brand once, server-side, and hand it to the client chrome
  // (styleguide shell, floating dot) that can't read the filesystem itself.
  const brand = await getBrand()
  return <BrandProvider value={brand}>{children}</BrandProvider>
}
