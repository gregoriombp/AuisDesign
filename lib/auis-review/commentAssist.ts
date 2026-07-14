import type { ReviewElementContext } from "@/lib/auis-review/elementContext"

// Calls to /api/review/suggest. Two modes: "complete" (inline autocomplete,
// ghost text) and "rewrite" (magic wand). Both target an AI agent that will
// implement the change, so the output is specific and actionable.
export interface AssistArgs {
  draft: string
  element: ReviewElementContext | null
  signal?: AbortSignal
}

export interface AssistResult {
  ok: boolean
  /** 0 when the request never completed (abort/network). */
  status: number
  text?: string
}

async function callAssist(
  mode: "complete" | "rewrite",
  { draft, element, signal }: AssistArgs
): Promise<AssistResult> {
  try {
    const res = await fetch("/api/review/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        draft,
        element: element ?? undefined,
        page:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
      signal,
    })
    if (!res.ok) return { ok: false, status: res.status }
    const data = await res.json().catch(() => ({}))
    return {
      ok: true,
      status: res.status,
      text: (data?.suggestion as string | undefined)?.trim(),
    }
  } catch {
    return { ok: false, status: 0 }
  }
}

/** Inline continuation (ghost text) of what the reviewer is typing. */
export const fetchCompletion = (args: AssistArgs) => callAssist("complete", args)

/** Full rewrite of the comment (magic wand). */
export const fetchRewrite = (args: AssistArgs) => callAssist("rewrite", args)
