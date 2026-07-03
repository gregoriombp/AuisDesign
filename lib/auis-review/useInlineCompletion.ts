"use client"

import * as React from "react"
import type { ReviewElementContext } from "@/lib/auis-review/elementContext"
import { fetchCompletion } from "@/lib/auis-review/commentAssist"

const MIN_CHARS = 6
const DEBOUNCE_MS = 450

/**
 * Autocomplete inline estilo Cursor: enquanto o revisor digita, busca uma
 * continuação curta e a expõe como `ghost` (texto fantasma que o card desenha
 * à frente do cursor; Tab aceita). Debounced, cancela requisições em voo e se
 * desliga sozinho se a chave da OpenAI não estiver configurada (503).
 *
 * `element` precisa ter identidade estável (memoize no chamador).
 */
export function useInlineCompletion(
  draft: string,
  element: ReviewElementContext | null,
  enabled: boolean
) {
  const [ghost, setGhost] = React.useState("")
  const disabledRef = React.useRef(false) // 503 → para de tentar nesta sessão
  const abortRef = React.useRef<AbortController | null>(null)

  const clear = React.useCallback(() => setGhost(""), [])

  React.useEffect(() => {
    if (!enabled || disabledRef.current) {
      setGhost("")
      return
    }
    if (draft.trim().length < MIN_CHARS) {
      setGhost("")
      return
    }
    // O texto mudou → o ghost atual ficou obsoleto.
    setGhost("")
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const r = await fetchCompletion({ draft, element, signal: ctrl.signal })
      if (r.status === 503) {
        disabledRef.current = true
        return
      }
      if (!r.ok || !r.text) return
      let g = r.text
      // Espaçamento natural ao colar logo depois do texto digitado.
      if (draft && !/\s$/.test(draft) && !/^[\s.,;:!?)\]]/.test(g)) {
        g = " " + g
      }
      setGhost(g)
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [draft, element, enabled])

  return { ghost, clear }
}
