"use client"

import * as React from "react"
import { Icon } from "../primitives/Icon"
import { useReviewStore } from "./store"
import { useCumulativeScrollOffset } from "../scrollHooks"
import { useStopDismiss } from "./useStopDismiss"
import { fileToHighResDataUrl } from "./imageScale"
import { ATTACH_ACCEPT, isAttachableImage } from "./useImageAttach"
import {
  describeAnchorElement,
  type ReviewElementContext,
} from "@auis/core/elementContext"
import { useVoiceTranscription } from "./useVoiceTranscription"
import { useInlineCompletion } from "./useInlineCompletion"
import { useReviewCommandAutocomplete } from "./useReviewCommandAutocomplete"
import { fetchRewrite } from "./commentAssist"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"
import { ReviewCommandMenu } from "./ReviewCommandMenu"
import {
  COMPOSER_SHELL_CLASS,
  COMPOSER_TEXTAREA_CLASS,
  ComposerRecording,
  ComposerSendButton,
  ComposerThumbnails,
  ComposerToolButton,
  useComposerAutosize,
} from "./ComposerControls"
import type { ReviewPoint } from "@auis/core/types"

const POPOVER_WIDTH = 360
const POPOVER_OFFSET = 16
const MAX_IMAGES = 4

function extractImagesFromClipboard(items: DataTransferItemList): File[] {
  const files: File[] = []
  for (const item of Array.from(items)) {
    if (isAttachableImage(item.type)) {
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
  const sessionRole = useReviewStore((s) => s.sessionRole)
  const sessionShared = useReviewStore((s) => s.sessionShared)
  const openIdentityModal = useReviewStore((s) => s.openIdentityModal)
  const isAdmin = sessionRole === "admin"

  const [text, setText] = React.useState("")
  const [images, setImages] = React.useState<string[]>([])
  const [adminsOnly, setAdminsOnly] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [caretAtEnd, setCaretAtEnd] = React.useState(true)
  const [rewriting, setRewriting] = React.useState(false)
  const [assistError, setAssistError] = React.useState<string | null>(null)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [undoText, setUndoText] = React.useState<string | null>(null)
  const [elementCtx, setElementCtx] =
    React.useState<ReviewElementContext | null>(null)

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const mirrorRef = React.useRef<HTMLDivElement>(null)
  const shellRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  useComposerAutosize(textareaRef, shellRef, text)
  const scroll = useCumulativeScrollOffset()
  const stopDismiss = useStopDismiss<HTMLDivElement>()

  // Voice → text: appends what was recognized to whatever is already written.
  const voice = useVoiceTranscription(
    React.useCallback((spoken: string) => {
      setText((prev) => (prev ? `${prev.trimEnd()} ${spoken}` : spoken))
      requestAnimationFrame(() => textareaRef.current?.focus())
    }, [])
  )

  // Stable refs to stop the voice on unmount / click-outside without re-firing
  // effects every render (the hook's object changes identity per render).
  // Synced inside an effect — never write a ref during render.
  const voiceStatusRef = React.useRef(voice.status)
  const voiceCancelRef = React.useRef(voice.cancel)
  const pendingSubmitRef = React.useRef(false)
  React.useEffect(() => {
    voiceStatusRef.current = voice.status
    voiceCancelRef.current = voice.cancel
  })

  // Command autocomplete (@agent, /skill) — Figma-style box. A reviewer does
  // not command agents: only people suggestions.
  const commands = useReviewCommandAutocomplete({
    textareaRef,
    value: text,
    setValue: setText,
    allowAgents: isAdmin,
  })

  // Inline autocomplete (ghost text). Only active with the caret at the end of
  // the text — the continuation glues to the end. Yields to the command menu so
  // they never compete for the same key (Tab/Enter).
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

  // Magic wand: rewrites the whole comment (with undo).
  const handleRewrite = React.useCallback(async () => {
    if (rewriting || text.trim().length === 0) return
    setAssistError(null)
    setRewriting(true)
    clearGhost()
    const r = await fetchRewrite({ draft: text, element: elementCtx })
    setRewriting(false)
    if (r.status === 503) {
      setAssistError("Set OPENAI_API_KEY to use the wand.")
      return
    }
    if (!r.ok || !r.text) {
      setAssistError("Could not improve it right now. Try again.")
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
      setAdminsOnly(false)
      setSubmitting(false)
      setCaretAtEnd(true)
      setUndoText(null)
      setAssistError(null)
      setSaveError(null)
      clearGhost()
      // Context of the anchored element — stable identity for the assist hook.
      setElementCtx(describeAnchorElement(pendingAnchor))
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [pendingAnchor, clearGhost])

  // Actually saves. The `finally` is mandatory: without it a bridge error
  // (bridge down, expired session, large payload) left the button spinning
  // forever — and, since `canSubmit` looks at `submitting`, without even
  // allowing a retry. Now the error shows and the text stays in the box.
  const runSave = React.useCallback(async () => {
    setSaveError(null)
    try {
      await saveComment(
        text,
        images.length > 0 ? images : undefined,
        adminsOnly ? { visibility: "admins" } : undefined
      )
    } catch (err) {
      setSaveError(
        err instanceof Error && err.message
          ? `Not saved: ${err.message}`
          : "Could not save the comment. Try again."
      )
    } finally {
      setSubmitting(false)
    }
  }, [saveComment, text, images, adminsOnly])

  // Saving with the voice active: stop the recording first and only save for
  // real once the transcribed text settles (status back to "idle").
  React.useEffect(() => {
    if (!pendingSubmitRef.current || voice.status !== "idle") return
    pendingSubmitRef.current = false
    void runSave()
  }, [voice.status, runSave])

  // Leaving/clicking outside interrupts the voice (discards). Unmount covers
  // Save/Cancel/Esc (they close the popover); the pointerdown covers a click
  // outside any review surface while recording.
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
      .filter((f) => isAttachableImage(f.type))
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
    // Voice active: stop first; the effect saves once the text settles.
    if (voice.status === "recording" || voice.status === "transcribing") {
      setSubmitting(true)
      pendingSubmitRef.current = true
      if (voice.status === "recording") voice.stop()
      return
    }
    if (!canSubmit) return
    setSubmitting(true)
    await runSave()
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
        className="pointer-events-auto flex flex-col gap-1.5 p-2 rounded-(--auis-radius-xl) bg-(--auis-bg-raised) border border-(--auis-border-subtle) shadow-lg"
      >
        <ComposerThumbnails
          images={images}
          onRemove={removeImage}
          onAdd={() => fileInputRef.current?.click()}
          canAdd={images.length < MAX_IMAGES}
        />

        <div ref={shellRef} className={COMPOSER_SHELL_CLASS}>
          {recording && (
            <ComposerRecording
              stream={voice.stream}
              onDiscard={voice.cancel}
              onStop={voice.stop}
            />
          )}
          {/* Textarea + mirror layer that draws the ghost text ahead of the
              caret. The mirror sits BEHIND (transparent text only to push the
              ghost into position); the textarea, with a transparent background,
              shows the real text on top. Identical metrics keep it aligned. */}
          <div className={recording ? "hidden" : "relative flex-1 min-w-0"}>
            <div
              ref={mirrorRef}
              aria-hidden="true"
              className="absolute inset-0 py-1 body-sm whitespace-pre-wrap break-words overflow-hidden pointer-events-none select-none"
              style={{ color: "transparent" }}
            >
              {text}
              {ghost && <span className="text-(--auis-fg-tertiary)">{ghost}</span>}
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
                  // no ghost: let the provider handle it (cancels the pending anchor)
                }
              }}
              placeholder="Write the feedback…"
              aria-label="Comment"
              rows={1}
              className={`relative ${COMPOSER_TEXTAREA_CLASS}`}
              style={{ zIndex: 1 }}
            />
          </div>
          {!recording && (
            <>
              <ComposerToolButton
                icon="image"
                label="Attach image (or paste with ⌘V)"
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= MAX_IMAGES}
              />
              <ComposerToolButton
                icon="mic"
                label="Dictate"
                onClick={voice.toggle}
                busy={transcribing}
              />
              <ComposerToolButton
                icon="auto_fix_high"
                label="Improve the comment"
                onClick={() => void handleRewrite()}
                disabled={text.trim().length === 0}
                busy={rewriting}
              />
              <ComposerSendButton
                type="submit"
                label="Save comment"
                disabled={!canSubmit && !transcribing}
                loading={submitting}
              />
            </>
          )}
        </div>

        {(saveError || assistError || voice.error) && (
          <p className="m-0 px-2 body-xs text-(--auis-accent-danger)">
            {saveError ?? assistError ?? voice.error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pl-0.5 pr-1.5 body-xs text-(--auis-fg-tertiary)">
          <div className="flex items-center gap-1 min-w-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setAdminsOnly((v) => !v)}
                aria-pressed={adminsOnly}
                title={
                  adminsOnly
                    ? "Private: only admins see it — click to open it to the team"
                    : "Visible to the team — click to keep it between admins"
                }
                className={[
                  "shrink-0 h-6 inline-flex items-center gap-1 px-1.5 rounded-xs transition-colors hover:bg-(--auis-bg-hover) hover:text-(--auis-fg-primary)",
                  adminsOnly ? "text-(--auis-fg-primary) font-medium" : "",
                ].join(" ")}
              >
                <Icon name={adminsOnly ? "lock" : "lock_open"} size={16} />
                Private
              </button>
            )}
            {sessionShared && (
              <button
                type="button"
                onClick={() => openIdentityModal("new")}
                title="Shared account — comment as someone else"
                className="h-6 min-w-0 truncate px-1.5 rounded-xs transition-colors hover:bg-(--auis-bg-hover) hover:text-(--auis-fg-primary)"
              >
                As {identity.name} · Switch
              </button>
            )}
          </div>
          <span className="shrink-0">
            {transcribing ? (
              "Transcribing…"
            ) : rewriting ? (
              "Improving the text…"
            ) : undoText !== null ? (
              <button
                type="button"
                onClick={undoRewrite}
                className="text-(--auis-fg-secondary) hover:text-(--auis-fg-primary) underline underline-offset-2"
              >
                Undo
              </button>
            ) : ghost ? (
              "Tab to complete"
            ) : isAdmin ? (
              "@ agent · / skill · ⌘↵ sends"
            ) : (
              "⌘↵ sends · Esc cancels"
            )}
          </span>
        </div>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        accept={ATTACH_ACCEPT}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <ReviewCommandMenu ac={commands} />
    </div>
  )
}
