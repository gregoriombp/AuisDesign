"use client"

import * as React from "react"
import type { Brand } from "./brand"

// Inlined so this client module never imports the fs-touching `brand.ts` value
// side (which would pull `node:fs` into the client bundle). The server always
// passes a real brand via `value`; this is only the context seed.
const CLIENT_DEFAULT_BRAND: Brand = {
  name: "Auis",
  tagline: "",
  logo: "/assets/brand/auis-wordmark.svg",
  configured: false,
}

/**
 * Makes the configured brand available to CLIENT components in the builder
 * chrome (the styleguide shell, the floating dot) that cannot call `getBrand()`
 * themselves — it reads the filesystem and is Node-only.
 *
 * The server layout (`app/auis/layout.tsx`) resolves the brand once with
 * `getBrand()` and passes it here as `value`, so the first render already has
 * the right logo — no fetch, no flash of the default. Server components that
 * can call `getBrand()` directly (the hub) don't need this.
 */
const BrandContext = React.createContext<Brand>(CLIENT_DEFAULT_BRAND)

export function BrandProvider({
  value,
  children,
}: {
  value: Brand
  children: React.ReactNode
}) {
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}

/** The configured brand, for client chrome. Falls back to the Auis default. */
export function useBrand(): Brand {
  return React.useContext(BrandContext)
}
