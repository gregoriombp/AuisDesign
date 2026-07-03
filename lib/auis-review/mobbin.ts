"use client"

import { fileToHighResDataUrl } from "@/lib/auis-review/imageScale"
import type {
  MobbinSearch,
  MobbinScreenResult,
  ReviewElementContext,
} from "@/components/auis-review/types"

// Cliente do Review Mode pro Mobbin. O app NÃO fala com o Mobbin direto — o MCP
// vive no ambiente do agente. Então: enfileira o pedido no review-bridge (mesmo
// canal dos comentários), espera o agente devolver, e converte a imagem
// escolhida no mesmo data URL base64 que o seletor de arquivos já produz.
// Bridge serverless embutido — rotas same-origin /api/review-bridge/*. Sem
// token, sem env (substitui o servidor Express avulso na 9878).
const BRIDGE_URL = "/api/review-bridge"

const POLL_INTERVAL_MS = 1500

/** Sempre disponível agora que o bridge é serverless (rotas same-origin). */
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
 * Aguarda o agente resolver a busca. Ouve o SSE do bridge (`mobbin.resolved`) e
 * faz polling de reforço — cobre o caso de o evento se perder ou de o agente ter
 * resolvido antes de a gente assinar. `onResolved` recebe a busca já `done` ou
 * `error` (o painel decide o que mostrar). Retorna um cleanup.
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

  // Sem SSE no bridge serverless — o polling de reforço cobre a resolução.
  pollTimer = setInterval(() => {
    if (settled) return
    void getMobbinSearch(id)
      .then((search) => {
        if (search && search.status !== "pending") finish(search)
      })
      .catch(() => {
        // transitório — segue tentando
      })
  }, POLL_INTERVAL_MS)

  return cleanup
}

/**
 * Busca a imagem do Mobbin pelo proxy same-origin (driblando CORS / canvas
 * taint) e converte no mesmo data URL base64 do seletor de arquivos — pronto pra
 * cair no `images[]` do comentário.
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
