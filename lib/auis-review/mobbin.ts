"use client"

import { fileToHighResDataUrl } from "@/lib/auis-review/imageScale"
import type {
  MobbinSearch,
  MobbinScreenResult,
  ReviewElementContext,
} from "@/components/auis-review/types"

// Review Mode's Mobbin client. The app does NOT talk to Mobbin directly — the
// MCP lives in the agent's environment. So: queue the request on the
// review-bridge (the same channel comments use), wait for the agent to post
// back, then convert the chosen image into the same base64 data URL the file
// picker already produces. The bridge is the embedded serverless one —
// same-origin /api/review-bridge/* routes, no token, no env (it replaces the
// standalone Express server on port 9878).
const BRIDGE_URL = "/api/review-bridge"

const POLL_INTERVAL_MS = 1500

/** Always available now that the bridge is serverless (same-origin routes). */
export function mobbinBridgeReady(): boolean {
  return true
}

function headers(): HeadersInit {
  return { "Content-Type": "application/json" }
}

export interface RequestMobbinSearchInput {
  query: string
  element?: ReviewElementContext | null
  page?: string
}

export async function requestMobbinSearch(
  input: RequestMobbinSearchInput
): Promise<MobbinSearch> {
  const res = await fetch(`${BRIDGE_URL}/mobbin/searches`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      query: input.query,
      platform: "web",
      page: input.page ?? "",
      element: input.element ?? undefined,
    }),
  })
  if (!res.ok) throw new Error(`mobbin_request_failed_${res.status}`)
  const data = (await res.json()) as { search: MobbinSearch }
  return data.search
}

export async function getMobbinSearch(
  id: string
): Promise<MobbinSearch | null> {
  const res = await fetch(
    `${BRIDGE_URL}/mobbin/searches/${encodeURIComponent(id)}`,
    { headers: headers() }
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`mobbin_get_failed_${res.status}`)
  const data = (await res.json()) as { search: MobbinSearch }
  return data.search
}

/**
 * Waits for the agent to resolve the search. Polls the bridge — which covers the
 * case where the agent resolved it before we started watching. `onResolved` gets
 * the search already `done` or `error` (the panel decides what to show). Returns
 * a cleanup function.
 */
export function waitForMobbinResults(
  id: string,
  onResolved: (search: MobbinSearch) => void
): () => void {
  let settled = false
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const cleanup = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const finish = (search: MobbinSearch) => {
    if (settled) return
    settled = true
    cleanup()
    onResolved(search)
  }

  // No SSE on the serverless bridge — polling covers the resolution.
  pollTimer = setInterval(() => {
    if (settled) return
    void getMobbinSearch(id)
      .then((search) => {
        if (search && search.status !== "pending") finish(search)
      })
      .catch(() => {
        // transient — keep trying
      })
  }, POLL_INTERVAL_MS)

  return cleanup
}

/**
 * Fetches the Mobbin image through the same-origin proxy (dodging CORS / canvas
 * taint) and converts it into the same base64 data URL the file picker produces
 * — ready to drop into the comment's `images[]`.
 */
export async function attachMobbinImage(imageUrl: string): Promise<string> {
  const res = await fetch(
    `/api/review/mobbin-image?url=${encodeURIComponent(imageUrl)}`
  )
  if (!res.ok) throw new Error(`mobbin_image_failed_${res.status}`)
  const blob = await res.blob()
  const type = blob.type || "image/jpeg"
  const ext = type.includes("png")
    ? "png"
    : type.includes("webp")
      ? "webp"
      : "jpg"
  const file = new File([blob], `mobbin-${Date.now()}.${ext}`, { type })
  return fileToHighResDataUrl(file)
}

export type { MobbinSearch, MobbinScreenResult }
