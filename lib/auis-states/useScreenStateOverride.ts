"use client"

import { useSearchParams } from "next/navigation"

/**
 * Pattern B: read the query param during render — never copy it into
 * `useState`. `parse` maps absent/unknown → default. Client pages that use it
 * must render inside `<Suspense>`.
 */
export function useScreenStateOverride<T extends string>(
  param: string,
  parse: (raw: string | undefined) => T,
): T {
  const searchParams = useSearchParams()
  return parse(searchParams.get(param) ?? undefined)
}
