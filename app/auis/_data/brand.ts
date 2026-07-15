import fs from "node:fs/promises"
import path from "node:path"

/**
 * The brand the Auis builder renders in its own chrome (the hub, the styleguide
 * shell, the floating dot). AuisDesign itself ships the DEFAULT below; once a
 * user seeds their brand through `/auis/welcome` (→ `/api/setup`), a runtime
 * file overlays it.
 *
 * The runtime overlay lives at `app/auis/_data/brand.runtime.json` and is
 * gitignored — a user's brand is their repo's data, and AuisDesign must keep
 * shipping the default. This module touches the filesystem, so only server
 * components and the serverless route may import its VALUES. Client components
 * (AuLogo and friends) import the `Brand` TYPE only (`import type`), which is
 * erased at build and never pulls `node:fs` into the client bundle.
 */
export type Brand = {
  name: string
  tagline: string
  logo: string
  configured: boolean
}

/** What AuisDesign ships out of the box, before any brand is configured. */
export const DEFAULT_BRAND: Brand = {
  name: "Auis",
  tagline: "",
  logo: "/assets/brand/auis-wordmark.svg",
  configured: false,
}

/** Gitignored runtime overlay — the user's own brand, written by /api/setup. */
export const BRAND_RUNTIME_FILE = path.join(
  process.cwd(),
  "app",
  "auis",
  "_data",
  "brand.runtime.json",
)

/**
 * Server-side brand reader: the default, overlaid with the runtime file when it
 * exists. Never throws — a missing or corrupt overlay falls back to the default
 * so the builder always renders.
 */
export async function getBrand(): Promise<Brand> {
  try {
    const raw = await fs.readFile(BRAND_RUNTIME_FILE, "utf8")
    const parsed = JSON.parse(raw) as Partial<Brand>
    const name =
      typeof parsed.name === "string" && parsed.name.trim()
        ? parsed.name
        : DEFAULT_BRAND.name
    const logo =
      typeof parsed.logo === "string" && parsed.logo.trim()
        ? parsed.logo
        : DEFAULT_BRAND.logo
    return {
      name,
      tagline: typeof parsed.tagline === "string" ? parsed.tagline : DEFAULT_BRAND.tagline,
      logo,
      configured: parsed.configured === true,
    }
  } catch {
    return DEFAULT_BRAND
  }
}

/** Persist a configured brand as the runtime overlay (used by /api/setup). */
export async function saveBrand(brand: Brand): Promise<void> {
  await fs.mkdir(path.dirname(BRAND_RUNTIME_FILE), { recursive: true })
  const tmp = `${BRAND_RUNTIME_FILE}.tmp`
  await fs.writeFile(tmp, JSON.stringify(brand, null, 2), "utf8")
  await fs.rename(tmp, BRAND_RUNTIME_FILE)
}
