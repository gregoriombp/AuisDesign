import type { Metadata } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "Auis",
  description:
    "Product Builder — design system, page builder and UX flow builder in one place.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Auis fonts — loaded via <link> because Next.js/Turbopack strips CSS
         * @import (see the note at the top of globals.css). One typographic
         * voice: Geist; Geist Mono strictly for code. Material Symbols Rounded
         * is the icon system — the axis ranges must cover Icon.tsx's
         * opsz/wght/FILL/GRAD usage (wght 100–700). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400..700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-25..200&display=block"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
