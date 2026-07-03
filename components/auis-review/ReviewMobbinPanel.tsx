"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { AuButton } from "@/components/ui/AuButton"
import { Icon } from "@/components/ui/Icon"
import { useStopDismiss } from "@/lib/auis-review/useStopDismiss"
import {
  attachMobbinImage,
  mobbinBridgeReady,
  requestMobbinSearch,
  waitForMobbinResults,
} from "@/lib/auis-review/mobbin"
import type {
  MobbinScreenResult,
  ReviewElementContext,
} from "./types"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"

const PANEL_WIDTH = 380
const GAP = 12
const MIN_PANEL_HEIGHT = 280
const SEARCH_TIMEOUT_MS = 120_000

type Phase = "idle" | "searching" | "results" | "error"

interface ReviewMobbinPanelProps {
  open: boolean
  onClose: () => void
  element: ReviewElementContext | null
  page: string
  onAttach: (dataUrl: string) => void
  canAttachMore: boolean
  /** Composer center x (viewport px). */
  anchorCenterX: number
  /** Composer width (viewport px). */
  anchorWidth: number
  /** Pin position y (viewport px) — the panel follows it on scroll. */
  anchorY: number
}

/** Prefill: o texto/rótulo do elemento; senão, a última parte da rota. */
function buildDefaultQuery(
  el: ReviewElementContext | null,
  page: string
): string {
  const primary = (el?.label || el?.text || "").trim().replace(/\s+/g, " ")
  if (primary) return primary.slice(0, 80)
  const seg = page.split(/[/?]/).filter(Boolean).pop()
  return seg ? seg.replace(/-/g, " ") : ""
}

function contextHint(el: ReviewElementContext | null, page: string): string {
  const bits: string[] = []
  if (el?.tag) bits.push(el.tag)
  const named = (el?.label || el?.text || "").trim().replace(/\s+/g, " ")
  if (named) bits.push(`"${named.slice(0, 40)}"`)
  const where = page ? page : ""
  const left = bits.join(" · ")
  if (left && where) return `${left} — ${where}`
  return left || where
}

export function ReviewMobbinPanel({
  open,
  onClose,
  element,
  page,
  onAttach,
  canAttachMore,
  anchorCenterX,
  anchorWidth,
  anchorY,
}: ReviewMobbinPanelProps) {
  const stopDismiss = useStopDismiss<HTMLDivElement>()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const cleanupRef = React.useRef<(() => void) | null>(null)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const [query, setQuery] = React.useState("")
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [results, setResults] = React.useState<MobbinScreenResult[]>([])
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [attachingId, setAttachingId] = React.useState<string | null>(null)
  const [attachedIds, setAttachedIds] = React.useState<Set<string>>(
    () => new Set()
  )

  const cancelPending = React.useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Ao abrir: prefill + foco. Ao fechar: cancela qualquer espera pendente.
  React.useEffect(() => {
    if (open) {
      setQuery((prev) => prev || buildDefaultQuery(element, page))
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      cancelPending()
    }
  }, [open, element, page, cancelPending])

  React.useEffect(() => cancelPending, [cancelPending])

  const runSearch = React.useCallback(() => {
    const q = query.trim()
    if (!q || phase === "searching") return
    if (!mobbinBridgeReady()) {
      setPhase("error")
      setErrorMsg(
        "A busca no Mobbin precisa do review-bridge ligado. Rode `npm run dev`."
      )
      return
    }
    cancelPending()
    setErrorMsg(null)
    setResults([])
    setPhase("searching")

    requestMobbinSearch({ query: q, element, page })
      .then((search) => {
        cleanupRef.current = waitForMobbinResults(search.id, (resolved) => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
          if (resolved.status === "error") {
            setPhase("error")
            setErrorMsg(
              resolved.error || "O agente não conseguiu buscar agora."
            )
            return
          }
          setResults(resolved.results)
          if (resolved.results.length === 0) {
            setPhase("error")
            setErrorMsg("Nenhum design parecido encontrado. Refine a busca.")
          } else {
            setPhase("results")
          }
        })
        timeoutRef.current = setTimeout(() => {
          cancelPending()
          setPhase("error")
          setErrorMsg(
            "A busca demorou demais. O agente está conectado a este review?"
          )
        }, SEARCH_TIMEOUT_MS)
      })
      .catch(() => {
        setPhase("error")
        setErrorMsg("Não consegui enfileirar a busca no review-bridge.")
      })
  }, [query, phase, element, page, cancelPending])

  const handleAttach = React.useCallback(
    (result: MobbinScreenResult) => {
      if (attachingId || attachedIds.has(result.id) || !canAttachMore) return
      setAttachingId(result.id)
      attachMobbinImage(result.imageUrl)
        .then((dataUrl) => {
          onAttach(dataUrl)
          setAttachedIds((prev) => new Set(prev).add(result.id))
        })
        .catch(() => {
          setErrorMsg("Não consegui anexar essa imagem. Tente outra.")
        })
        .finally(() => setAttachingId(null))
    },
    [attachingId, attachedIds, canAttachMore, onAttach]
  )

  if (!open || typeof document === "undefined") return null

  // Horizontal: à direita do composer; sem espaço, à esquerda; senão, encosta.
  let left = anchorCenterX + anchorWidth / 2 + GAP
  if (left + PANEL_WIDTH > window.innerWidth - 8) {
    const leftSide = anchorCenterX - anchorWidth / 2 - GAP - PANEL_WIDTH
    left = leftSide >= 8 ? leftSide : Math.max(8, window.innerWidth - 8 - PANEL_WIDTH)
  }
  // Vertical: perto do pino, garantindo um mínimo visível; rola por dentro.
  let top = Math.max(8, anchorY - 180)
  top = Math.min(top, Math.max(8, window.innerHeight - 8 - MIN_PANEL_HEIGHT))
  const maxHeight = window.innerHeight - top - 8

  const hint = contextHint(element, page)

  return createPortal(
    <div
      {...{ [OVERLAY_DATA_ATTR]: "" }}
      ref={stopDismiss}
      role="dialog"
      aria-label="Buscar designs parecidos no Mobbin"
      className="fixed pointer-events-auto rounded-lg bg-(--bg-raised) border border-(--border-subtle) shadow-lg flex flex-col overflow-hidden"
      style={{ zIndex: REVIEW_Z.modal, left, top, width: PANEL_WIDTH, maxHeight }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-(--border-subtle)">
        <Icon name="image_search" size={16} className="text-(--fg-secondary)" />
        <span className="body-sm font-medium text-(--fg-primary)">
          Designs parecidos
        </span>
        <span className="body-xs text-(--fg-tertiary)">no Mobbin</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="ml-auto h-6 w-6 inline-flex items-center justify-center rounded-sm text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover) transition-colors"
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      {/* Busca */}
      <div className="px-3 pt-2.5 pb-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                runSearch()
              }
            }}
            placeholder="Descreva a tela parecida…"
            className="flex-1 min-w-0 rounded-sm border border-(--border-default) bg-(--bg-canvas) px-2.5 py-1.5 body-sm text-(--fg-primary) placeholder:text-(--fg-tertiary) focus:outline-hidden focus:border-(--border-strong)"
          />
          <AuButton
            type="button"
            variant="primary"
            size="sm"
            onClick={runSearch}
            disabled={query.trim().length === 0 || phase === "searching"}
          >
            Buscar
          </AuButton>
        </div>
        {hint && (
          <p className="body-xs text-(--fg-tertiary) truncate">
            Parecido com: {hint}
          </p>
        )}
      </div>

      {/* Corpo */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {phase === "idle" && (
          <p className="body-xs text-(--fg-tertiary) py-6 text-center">
            Refine a descrição e toque em Buscar para ver telas parecidas do
            Mobbin.
          </p>
        )}

        {phase === "searching" && (
          <div className="py-8 flex flex-col items-center gap-2 text-center">
            <Icon
              name="progress_activity"
              size={20}
              className="animate-spin text-(--fg-secondary)"
            />
            <p className="body-xs text-(--fg-secondary)">
              Procurando designs parecidos no Mobbin…
            </p>
            <button
              type="button"
              onClick={() => {
                cancelPending()
                setPhase("idle")
              }}
              className="body-xs text-(--fg-tertiary) hover:text-(--fg-primary) underline underline-offset-2"
            >
              Cancelar
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="py-6 flex flex-col items-center gap-2 text-center">
            <Icon name="error" size={18} className="text-(--fg-tertiary)" />
            <p className="body-xs text-(--fg-secondary)">{errorMsg}</p>
            <button
              type="button"
              onClick={runSearch}
              className="body-xs text-(--fg-secondary) hover:text-(--fg-primary) underline underline-offset-2"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {phase === "results" && (
          <>
            {!canAttachMore && (
              <p className="body-xs text-(--accent-warning) pb-2">
                Limite de imagens atingido. Remova uma para anexar outra.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {results.map((r) => {
                const attached = attachedIds.has(r.id)
                const busy = attachingId === r.id
                const disabled = busy || attached || !canAttachMore
                return (
                  <div
                    key={r.id}
                    className="group/card relative rounded-sm border border-(--border-subtle) overflow-hidden bg-(--bg-canvas)"
                  >
                    <button
                      type="button"
                      onClick={() => handleAttach(r)}
                      disabled={disabled}
                      title={
                        attached
                          ? "Imagem anexada"
                          : canAttachMore
                            ? "Anexar ao comentário"
                            : "Limite de imagens atingido"
                      }
                      className="block w-full text-left disabled:cursor-default"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.imageUrl}
                        alt={r.appName ? `${r.appName} — Mobbin` : "Mobbin"}
                        loading="lazy"
                        className="w-full h-28 object-cover object-top"
                      />
                      <span
                        className={[
                          "absolute inset-0 flex items-center justify-center transition-opacity",
                          attached
                            ? "opacity-100 bg-(--bg-raised)/70"
                            : busy
                              ? "opacity-100 bg-(--bg-raised)/60"
                              : "opacity-0 group-hover/card:opacity-100 bg-(--bg-raised)/60",
                        ].join(" ")}
                      >
                        {busy ? (
                          <Icon
                            name="progress_activity"
                            size={16}
                            className="animate-spin text-(--fg-primary)"
                          />
                        ) : attached ? (
                          <span className="inline-flex items-center gap-1 body-xs font-medium text-(--fg-primary)">
                            <Icon name="check" size={13} /> Anexada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 body-xs font-medium text-(--fg-primary)">
                            <Icon name="add_photo_alternate" size={13} /> Anexar
                          </span>
                        )}
                      </span>
                    </button>

                    <div className="flex items-center gap-1 px-1.5 py-1">
                      <span className="body-xs text-(--fg-tertiary) truncate">
                        {r.appName || "Mobbin"}
                      </span>
                      <a
                        href={r.mobbinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Abrir no Mobbin"
                        title="Abrir no Mobbin"
                        className="ml-auto shrink-0 h-5 w-5 inline-flex items-center justify-center rounded-sm text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover) transition-colors"
                      >
                        <Icon name="open_in_new" size={12} />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
            {errorMsg && (
              <p className="body-xs text-(--accent-danger) pt-2">{errorMsg}</p>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
