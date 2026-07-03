import type { ReviewElementContext } from "@/lib/auis-review/elementContext"

// Chamadas ao /api/review/suggest. Dois modos: "complete" (autocomplete inline,
// ghost text) e "rewrite" (varinha mágica). Os dois miram um agente de IA que
// vai implementar a mudança, então a saída é específica e acionável.
export interface AssistArgs {
  draft: string
  element: ReviewElementContext | null
  signal?: AbortSignal
}

export interface AssistResult {
  ok: boolean
  /** 0 quando a requisição nem completou (abort/rede). */
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

/** Continuação inline (ghost text) do que o revisor está digitando. */
export const fetchCompletion = (args: AssistArgs) => callAssist("complete", args)

/** Reescrita completa do comentário (varinha mágica). */
export const fetchRewrite = (args: AssistArgs) => callAssist("rewrite", args)
