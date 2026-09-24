"use client"

import { useCallback, useState } from "react"
import { useSearchParams } from "next/navigation"

/**
 * Pattern A with a mirror: a screen whose real flow writes its own step into
 * the URL, and whose scenarios the State Mode toolbar picks through the same
 * URL (a wizard).
 *
 * The two authors want opposite outcomes — a picked scenario is seeded from
 * scratch, the mirrored step must not remount the work the person built. A
 * `key` derived on the server only told them apart while the requested
 * scenario differed from the last navigation: changing a secondary axis or
 * going back through the toolbar to the scenario the screen opened with
 * changed the URL and not the screen.
 *
 * Here the separation is by authorship. The mirror writes with
 * `replaceState(null, …)` — the router follows, without a fetch and without
 * remounting — and notes the signature it wrote. When the router shows a
 * signature nobody here wrote, the change came from outside (the toolbar, the
 * mode's exit, a Review permalink) and `key` advances, with `seed` carrying the
 * params to seed. `?ge=` and the Review params stay out of the signature: an
 * interaction never remounts.
 *
 * `params` must be stable (a module constant).
 */
export type MirroredScenario = {
  key: number
  seed: URLSearchParams
  mirror: (mutate: (params: URLSearchParams) => void) => void
}

type Mount = {
  key: number
  seed: URLSearchParams
  /** The signature the router showed on the last render. */
  seen: string
  /** What the mirror wrote and the router has not shown yet, in order. */
  inFlight: string[]
}

function signature(search: URLSearchParams, params: readonly string[]): string {
  return params.map((param) => `${param}=${search.get(param) ?? ""}`).join("&")
}

export function useMirroredScenario(params: readonly string[]): MirroredScenario {
  const searchParams = useSearchParams()
  const current = signature(searchParams, params)
  const [mount, setMount] = useState<Mount>(() => ({
    key: 0,
    seed: new URLSearchParams(searchParams.toString()),
    seen: current,
    inFlight: [],
  }))

  if (current !== mount.seen) {
    const echo = mount.inFlight.indexOf(current)
    setMount(
      echo >= 0
        ? { ...mount, seen: current, inFlight: mount.inFlight.slice(echo + 1) }
        : {
            key: mount.key + 1,
            seed: new URLSearchParams(searchParams.toString()),
            seen: current,
            inFlight: [],
          },
    )
  }

  const mirror = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const url = new URL(window.location.href)
      const before = signature(url.searchParams, params)
      mutate(url.searchParams)
      if (url.href === window.location.href) return
      const after = signature(url.searchParams, params)
      if (after !== before) {
        setMount((m) => ({ ...m, inFlight: [...m.inFlight, after] }))
      }
      window.history.replaceState(null, "", url)
    },
    [params],
  )

  return { key: mount.key, seed: mount.seed, mirror }
}
