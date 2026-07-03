"use client"

import * as React from "react"
import { AuButton } from "@/components/ui/AuButton"
import { Icon } from "@/components/ui/Icon"
import { useReviewStore } from "@/lib/auis-review/store"
import { useCumulativeScrollOffset } from "@/lib/auis-review/scrollOffset"
import { useStopDismiss } from "@/lib/auis-review/useStopDismiss"
import { fileToHighResDataUrl } from "@/lib/auis-review/imageScale"
import {
  describeAnchorElement,
  type ReviewElementContext,
} from "@/lib/auis-review/elementContext"
import { useVoiceTranscription } from "@/lib/auis-review/useVoiceTranscription"
import { useInlineCompletion } from "@/lib/auis-review/useInlineCompletion"
import { useReviewCommandAutocomplete } from "@/lib/auis-review/useReviewCommandAutocomplete"
import { fetchRewrite } from "@/lib/auis-review/commentAssist"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"
import { ReviewCommandMenu } from "./ReviewCommandMenu"
import { ReviewMobbinPanel } from "./ReviewMobbinPanel"
import type { ReviewPoint } from "./types"

const POPOVER_WIDTH = 360
const POPOVER_OFFSET = 16
const MAX_IMAGES = 4

function extractImagesFromClipboard(items: DataTransferItemList): File[] {
  const files: File[] = []
  for (const item of Array.from(items)) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  return files
}

export function ReviewCommentPopover() {
  const pendingAnchor = useReviewStore((s) => s.pendingAnchor)
  const identity = useReviewStore((s) => s.identity)
  const saveComment = useReviewStore((s) => s.saveComment)
  const cancelPending = useReviewStore((s) => s.cancelPending)

  const [text, setText] = React.useState("")
  const [images, setImages] = React.useState<string[]>([])
  const [mobbinOpen, setMobbinOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [caretAtEnd, setCaretAtEnd] = React.useState(true)
  const [rewriting, setRewriting] = React.useState(false)
  const [assistError, setAssistError] = React.useState<string | null>(null)
  const [undoText, setUndoText] = React.useState<string | null>(null)
  const [elementCtx, setElementCtx] =
    React.useState<ReviewElementContext | null>(null)

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const mirrorRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const scroll = useCumulativeScrollOffset()
  const stopDismiss = useStopDismiss<HTMLDivElement>()

  // Voz → texto: anexa o reconhecido ao que já estiver escrito.
  const voice = useVoiceTranscription(
    React.useCallback((spoken: string) => {
      setText((prev) => (prev ? `${prev.trimEnd()} ${spoken}` : spoken))
      requestAnimationFrame(() => textareaRef.current?.focus())
    }, [])
  )

  // Refs estáveis pra encerrar a voz no unmount / clique-fora sem re-disparar
  // effects a cada render (o objeto do hook muda de identidade por render).
  // Sincronizados num effect — não se escreve ref durante o render.
  const voiceStatusRef = React.useRef(voice.status)
  const voiceCancelRef = React.useRef(voice.cancel)
  const pendingSubmitRef = React.useRef(false)
  React.useEffect(() => {
    voiceStatusRef.current = voice.status
    voiceCancelRef.current = voice.cancel
  })

  // Autocomplete de comandos (@agente, /skill, #now) — caixinha estilo Figma.
  const commands = useReviewCommandAutocomplete({
    textareaRef,
    value: text,
    setValue: setText,
  })

  // Autocomplete inline (ghost text). Só ativa com o cursor no fim do texto —
  // a continuação se cola no fim, como no Cursor. Cede a vez ao menu de
  // comandos pra não competirem pela mesma tecla (Tab/Enter).
  const { ghost, clear: clearGhost } = useInlineCompletion(
    text,
    elementCtx,
    pendingAnchor !== null && caretAtEnd && !rewriting && !commands.open
  )

  const syncScroll = React.useCallback(() => {
    const ta = textareaRef.current
    const m = mirrorRef.current
    if (ta && m) {
      m.scrollTop = ta.scrollTop
      m.scrollLeft = ta.scrollLeft
    }
  }, [])

  const acceptGhost = React.useCallback(() => {
    if (!ghost) return
    const next = text + ghost
    setText(next)
    clearGhost()
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (ta) {
        ta.focus()
        ta.setSelectionRange(next.length, next.length)
        setCaretAtEnd(true)
        syncScroll()
      }
    })
  }, [ghost, text, clearGhost, syncScroll])

  // Varinha mágica: reescreve o comentário inteiro (com desfazer).
  const handleRewrite = React.useCallback(async () => {
    if (rewriting || text.trim().length === 0) return
    setAssistError(null)
    setRewriting(true)
    clearGhost()
    const r = await fetchRewrite({ draft: text, element: elementCtx })
    setRewriting(false)
    if (r.status === 503) {
      setAssistError("Configure OPENAI_API_KEY para usar a varinha.")
      return
    }
    if (!r.ok || !r.text) {
      setAssistError("Não consegui melhorar agora. Tente de novo.")
      return
    }
    setUndoText(text)
    setText(r.text)
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (ta) {
        ta.focus()
        ta.setSelectionRange(r.text!.length, r.text!.length)
        setCaretAtEnd(true)
      }
    })
  }, [rewriting, text, elementCtx, clearGhost])

  const undoRewrite = React.useCallback(() => {
    if (undoText === null) return
    setText(undoText)
    setUndoText(null)
  }, [undoText])

  React.useEffect(() => {
    if (pendingAnchor) {
      setText("")
      setImages([])
      setMobbinOpen(false)
      setSubmitting(false)
      setCaretAtEnd(true)
      setUndoText(null)
      setAssistError(null)
      clearGhost()
      // Contexto do elemento ancorado — identidade estável pro hook de assist.
      setElementCtx(describeAnchorElement(pendingAnchor))
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [pendingAnchor, clearGhost])

  // #3 Salvar com voz ativa: encerra a gravação primeiro e só salva de fato
  // quando o texto transcrito assenta (status volta a "idle").
  React.useEffect(() => {
    if (!pendingSubmitRef.current || voice.status !== "idle") return
    pendingSubmitRef.current = false
    void (async () => {
      await saveComment(text, images.length > 0 ? images : undefined)
      setSubmitting(false)
    })()
  }, [voice.status, text, images, saveComment])

  // #4 Sair/clicar fora interrompe a voz (descarta). Unmount cobre Salvar/
  // Cancelar/Esc (fecham o popover); o pointerdown cobre clique fora de
  // qualquer superfície de review enquanto grava.
  React.useEffect(() => () => voiceCancelRef.current(), [])
  React.useEffect(() => {
    if (typeof document === "undefined") return
    const onDown = (e: PointerEvent) => {
      const t = e.target
      if (t instanceof Element && t.closest(`[${OVERLAY_DATA_ATTR}]`)) return
      if (voiceStatusRef.current === "recording") voiceCancelRef.current()
    }
    document.addEventListener("pointerdown", onDown, true)
    return () => document.removeEventListener("pointerdown", onDown, true)
  }, [])

  const addImages = React.useCallback(async (files: File[]) => {
    const eligible = files
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_IMAGES)
    if (eligible.length === 0) return
    const dataUrls = await Promise.all(eligible.map(fileToHighResDataUrl))
    setImages((prev) => [...prev, ...dataUrls].slice(0, MAX_IMAGES))
  }, [])

  const handlePaste = React.useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!e.clipboardData) return
      const files = extractImagesFromClipboard(e.clipboardData.items)
      if (files.length > 0) {
        e.preventDefault()
        await addImages(files)
      }
    },
    [addImages]
  )

  const handleFileChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      await addImages(files)
      if (fileInputRef.current) fileInputRef.current.value = ""
    },
    [addImages]
  )

  const removeImage = (idx: number) =>
    setImages((prev) => prev.filter((_, i) => i !== idx))

  if (!pendingAnchor || !identity) return null

  const point: ReviewPoint =
    pendingAnchor.kind === "pin" ? pendingAnchor.position : pendingAnchor.centroid

  const pxX = point.x - scroll.x
  const pxY = point.y - scroll.y

  const placeAbove = pxY > window.innerHeight * 0.55
  const top = placeAbove
    ? Math.max(8, pxY - POPOVER_OFFSET)
    : Math.min(window.innerHeight - 8, pxY + POPOVER_OFFSET)
  const translateY = placeAbove ? "-100%" : "0"
  const left = Math.min(
    Math.max(POPOVER_WIDTH / 2 + 8, pxX),
    window.innerWidth - POPOVER_WIDTH / 2 - 8
  )

  const canSubmit = (text.trim().length > 0 || images.length > 0) && !submitting

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (submitting) return
    // #3 Voz ativa: encerra primeiro; o effect salva quando o texto assenta.
    if (voice.status === "recording" || voice.status === "transcribing") {
      setSubmitting(true)
      pendingSubmitRef.current = true
      if (voice.status === "recording") voice.stop()
      return
    }
    if (!canSubmit) return
    setSubmitting(true)
    await saveComment(text, images.length > 0 ? images : undefined)
    setSubmitting(false)
  }

  const recording = voice.status === "recording"
  const transcribing = voice.status === "transcribing"

  return (
    <div
      {...{ [OVERLAY_DATA_ATTR]: "" }}
      ref={stopDismiss}
      className="fixed pointer-events-none"
      style={{
        zIndex: REVIEW_Z.popover,
        top,
        left,
        width: POPOVER_WIDTH,
        transform: `translate(-50%, ${translateY})`,
      }}
    >
      <form
        onSubmit={submit}
        className="pointer-events-auto rounded-lg bg-(--bg-raised) border border-(--border-subtle) shadow-lg flex flex-col overflow-hidden"
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-(--border-subtle)">
          <span
            className="h-5 w-5 rounded-full flex items-center justify-center body-xs font-semibold text-(--fg-on-inverse)"
            style={{ background: identity.colorToken }}
          >
            {identity.name.charAt(0).toUpperCase()}
          </span>
          <span className="body-xs font-medium text-(--fg-primary)">
            {identity.name}
          </span>
          <span className="body-xs text-(--fg-tertiary) ml-auto">
            {pendingAnchor.kind === "draw" ? "Marcação livre" : "Pino"}
          </span>
        </div>

        {/* Textarea + camada-espelho que desenha o ghost text à frente do
            cursor. O espelho fica ATRÁS (texto transparente só pra empurrar o
            ghost pra posição certa); o textarea, com fundo transparente, mostra
            o texto real por cima. Métricas idênticas mantêm tudo alinhado. */}
        <div className="relative">
          <div
            ref={mirrorRef}
            aria-hidden="true"
            className="absolute inset-0 px-3 py-2 body-sm whitespace-pre-wrap break-words overflow-hidden pointer-events-none select-none"
            style={{ color: "transparent" }}
          >
            {text}
            {ghost && <span className="text-(--fg-tertiary)">{ghost}</span>}
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setCaretAtEnd(
                e.target.selectionStart === e.target.value.length
              )
              if (undoText !== null) setUndoText(null)
            }}
            onSelect={(e) => {
              const ta = e.currentTarget
              setCaretAtEnd(
                ta.selectionStart === ta.value.length &&
                  ta.selectionEnd === ta.value.length
              )
              commands.sync()
            }}
            onScroll={syncScroll}
            onPaste={handlePaste}
            onBlur={() => commands.close()}
            onKeyDown={(e) => {
              if (commands.onKeyDown(e)) return
              if (e.key === "Tab" && ghost && !e.shiftKey) {
                e.preventDefault()
                acceptGhost()
              } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void submit()
              } else if (e.key === "Escape") {
                if (ghost) {
                  e.preventDefault()
                  e.stopPropagation()
                  clearGhost()
                }
                // sem ghost: deixa o provider tratar (cancela o pending)
              }
            }}
            placeholder="Escreva o feedback… cole uma imagem, ou dite por voz"
            rows={3}
            className="relative w-full resize-none px-3 py-2 bg-transparent body-sm text-(--fg-primary) placeholder:text-(--fg-tertiary) focus:outline-hidden"
            style={{ zIndex: 1 }}
          />
        </div>

        {assistError && (
          <p className="mx-3 mb-2 body-xs text-(--accent-danger)">
            {assistError}
          </p>
        )}
        {voice.error && (
          <p className="mx-3 mb-2 body-xs text-(--accent-danger)">
            {voice.error}
          </p>
        )}

        {images.length > 0 && (
          <div className="px-3 pb-2 flex flex-wrap gap-2">
            {images.map((src, idx) => (
              <div key={idx} className="relative group/thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-16 w-16 rounded-sm object-cover border border-(--border-subtle)"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-(--bg-raised) border border-(--border-subtle) flex items-center justify-center text-(--fg-tertiary) hover:text-(--fg-primary) opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                  aria-label="Remover imagem"
                >
                  <Icon name="close" size={9} />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-16 w-16 rounded-sm border border-dashed border-(--border-default) flex items-center justify-center text-(--fg-tertiary) hover:text-(--fg-primary) hover:border-(--border-strong) transition-colors"
                aria-label="Adicionar imagem"
              >
                <Icon name="add" size={16} />
              </button>
            )}
          </div>
        )}

        <div className="px-2 py-2 flex items-center justify-between gap-2 border-t border-(--border-subtle)">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover) transition-colors"
              aria-label="Anexar imagem"
              title="Anexar imagem (ou cole com ⌘V)"
              disabled={images.length >= MAX_IMAGES}
            >
              <Icon name="image" size={14} weight={600} />
            </button>
            <button
              type="button"
              onClick={voice.toggle}
              disabled={transcribing}
              aria-label={recording ? "Parar gravação" : "Ditar por voz"}
              aria-pressed={recording}
              title={recording ? "Parar gravação" : "Ditar por voz"}
              className={[
                "shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-sm transition-colors disabled:opacity-60",
                recording
                  ? "bg-(--accent-danger) text-(--fg-on-inverse)"
                  : "text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover)",
              ].join(" ")}
            >
              <Icon
                name={
                  recording ? "stop" : transcribing ? "progress_activity" : "mic"
                }
                size={14}
                fill={recording ? 1 : 0}
                weight={600}
                className={transcribing ? "animate-spin" : ""}
              />
            </button>
            <button
              type="button"
              onClick={handleRewrite}
              disabled={rewriting || text.trim().length === 0}
              aria-label="Melhorar o comentário"
              title="Melhorar o comentário (varinha mágica)"
              className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover) transition-colors disabled:opacity-50"
            >
              <Icon
                name={rewriting ? "progress_activity" : "auto_fix_high"}
                size={14}
                weight={600}
                className={rewriting ? "animate-spin" : ""}
              />
            </button>
            <button
              type="button"
              onClick={() => setMobbinOpen((v) => !v)}
              aria-label="Buscar designs parecidos no Mobbin"
              aria-pressed={mobbinOpen}
              title="Buscar designs parecidos no Mobbin"
              className={[
                "shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-sm transition-colors",
                mobbinOpen
                  ? "bg-(--bg-hover) text-(--fg-primary)"
                  : "text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover)",
              ].join(" ")}
            >
              <Icon name="image_search" size={14} weight={600} />
            </button>

            {recording ? (
              <span className="body-xs text-(--accent-danger) flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-(--accent-danger) animate-pulse" />
                Gravando
              </span>
            ) : transcribing ? (
              <span className="body-xs text-(--fg-tertiary) truncate min-w-0">
                Transcrevendo…
              </span>
            ) : rewriting ? (
              <span className="body-xs text-(--fg-tertiary) truncate min-w-0">Melhorando…</span>
            ) : undoText !== null ? (
              <button
                type="button"
                onClick={undoRewrite}
                className="body-xs text-(--fg-secondary) hover:text-(--fg-primary) underline underline-offset-2"
              >
                Desfazer
              </button>
            ) : ghost ? (
              <span className="body-xs text-(--fg-tertiary) truncate min-w-0">
                Tab para completar
              </span>
            ) : (
              <span className="body-xs text-(--fg-tertiary) flex items-center gap-1">
                <Icon name="keyboard_command_key" size={11} />
                ⌘↵
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <AuButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelPending}
            >
              Cancelar
            </AuButton>
            <AuButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={!canSubmit && !recording && !transcribing}
              loading={submitting}
            >
              Salvar
            </AuButton>
          </div>
        </div>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <ReviewMobbinPanel
        open={mobbinOpen}
        onClose={() => setMobbinOpen(false)}
        element={elementCtx}
        page={typeof window !== "undefined" ? window.location.pathname : ""}
        onAttach={(dataUrl) =>
          setImages((prev) => [...prev, dataUrl].slice(0, MAX_IMAGES))
        }
        canAttachMore={images.length < MAX_IMAGES}
        anchorCenterX={left}
        anchorWidth={POPOVER_WIDTH}
        anchorY={pxY}
      />

      <ReviewCommandMenu ac={commands} />
    </div>
  )
}
