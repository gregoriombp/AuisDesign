import * as React from "react"
import type { Brand } from "@/app/auis/_data/brand"

export type AuLogoProps = {
  variant?: "wordmark" | "mark" | "horizontal"
  height?: number
  className?: string
  style?: React.CSSProperties
  "aria-label"?: string
  /**
   * The configured brand, resolved server-side with `getBrand()`. When it
   * carries a custom uploaded logo, that image is rendered instead of the
   * built-in Auis geometry. Omitted (the default) → the Auis mark, so the
   * builder's own chrome and any client component keep working unchanged.
   */
  brand?: Brand
}

/**
 * The Auis mark — the brand of the *builder itself*, not of the design system
 * it generates. It belongs to Auis's own chrome (`/auis/*`: the hub, the
 * styleguide shell, the floating dot) and must never be hardcoded into a
 * component that ships into the user's product. Components that need a brand
 * expose a `logo` slot the consumer fills instead.
 *
 * Inside the app, use the `<AuLogo />` component below: inline SVG with
 * `fill="currentColor"`, so it inherits the color of its context and needs no
 * light/dark asset pair.
 *
 * The single static export is for contexts where `currentColor` does not work
 * (email, decks, favicon, CSS `mask-image`). It is the only brand file this
 * repo ships, and it is the only path listed here.
 */
export const AU_LOGO_ASSET = "/assets/brand/auis-wordmark.svg"

/** Renders the configured brand's own uploaded logo as an image. */
function isCustomLogo(brand?: Brand): brand is Brand {
  return (
    !!brand &&
    brand.configured &&
    typeof brand.logo === "string" &&
    brand.logo.trim().length > 0 &&
    brand.logo !== AU_LOGO_ASSET
  )
}

// Neutral typeset wordmark generated from the established name. The previous
// geometry encoded private-product marks despite being labelled as Auis.
const AUIS_WORDMARK_PATH = "M15.86 144.84H-.23L43.75 30.31h16.33l46.87 114.53H89.69l-13.36-34.68H28.44l-12.58 34.68Zm29.53-80.62L32.81 97.81h38.83L59.69 66.09q-5.47-14.45-8.13-23.75-2.18 11.02-6.17 21.88ZM184.22 144.84h-12.58v-12.18q-9.69 14.06-26.33 14.06-7.34 0-13.71-2.81-6.37-2.82-9.45-7.07-3.09-4.26-4.34-10.43-.86-4.14-.86-13.13v-51.4h14.07v46.01q0 11.02.86 14.84 1.32 5.55 5.62 8.72 4.3 3.16 10.63 3.16 6.32 0 11.87-3.24 5.55-3.24 7.85-8.83 2.31-5.59 2.31-16.21V61.88h14.06v82.96ZM220.39 46.48h-14.06V30.31h14.06v16.17Zm0 98.36h-14.06V61.88h14.06v82.96Zm15.78-24.76 13.91-2.19q1.17 8.36 6.52 12.81 5.35 4.46 14.96 4.46 9.69 0 14.38-3.95 4.69-3.94 4.69-9.26 0-4.76-4.15-7.5-2.89-1.87-14.37-4.76-15.47-3.91-21.45-6.76-5.97-2.85-9.06-7.89-3.08-5.04-3.08-11.13 0-5.55 2.53-10.28 2.54-4.72 6.92-7.85 3.28-2.42 8.94-4.1 5.67-1.68 12.15-1.68 9.77 0 17.15 2.81 7.38 2.82 10.9 7.62 3.52 4.8 4.84 12.85l-13.75 1.88q-.93-6.41-5.43-10-4.49-3.6-12.69-3.6-9.69 0-13.83 3.21-4.14 3.2-4.14 7.5 0 2.73 1.72 4.92 1.72 2.26 5.39 3.75 2.11.78 12.42 3.59 14.92 3.99 20.82 6.52 5.9 2.54 9.26 7.39 3.36 4.84 3.36 12.03 0 7.03-4.1 13.24-4.1 6.21-11.84 9.61-7.73 3.4-17.5 3.4-16.17 0-24.65-6.72-8.47-6.72-10.82-19.92Z"
const AUIS_MARK_PATH = "M15.86 144.84H-.23L43.75 30.31h16.33l46.87 114.53H89.69l-13.36-34.68H28.44l-12.58 34.68Zm29.53-80.62L32.81 97.81h38.83L59.69 66.09q-5.47-14.45-8.13-23.75-2.18 11.02-6.17 21.88Z"

/** Auis logo. Fill is currentColor so it adapts to light/dark surfaces. */
export function AuLogo({
  variant = "wordmark",
  height = 20,
  className,
  style,
  "aria-label": ariaLabel = "Auis",
  brand,
}: AuLogoProps) {
  // A configured brand ships a single uploaded asset — render it for every
  // variant (there is no mark/wordmark split for a user's own logo).
  if (isCustomLogo(brand)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.logo}
        alt={brand.name || ariaLabel}
        height={height}
        style={{ height, width: "auto", ...style }}
        className={className}
      />
    )
  }

  if (variant === "mark") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-1 25 108 127"
        height={height}
        style={{ height, width: "auto", ...style }}
        className={className}
        role="img"
        aria-label={ariaLabel}
        fill="currentColor"
      >
        <path d={AUIS_MARK_PATH} fillRule="evenodd" />
      </svg>
    )
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-1 25 313 127"
      height={height}
      style={{ height, width: "auto", ...style }}
      className={className}
      role="img"
      aria-label={ariaLabel}
      fill="currentColor"
    >
      <path d={AUIS_WORDMARK_PATH} fillRule="evenodd" />
    </svg>
  )
}
