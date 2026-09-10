"use client"

import * as React from "react"
import { AuButton } from "@/components/ui/AuButton"
import { AuSpinner } from "@/components/ui/AuSpinner"
import { Icon } from "@/components/ui/Icon"
import { useReviewStore } from "@/lib/auis-review/store"
import { useImageAttach } from "@/lib/auis-review/useImageAttach"
import { useReviewCommandAutocomplete } from "@/lib/auis-review/useReviewCommandAutocomplete"
import { useVoiceTranscription } from "@/lib/auis-review/useVoiceTranscription"
import { fetchRewrite } from "@/lib/auis-review/commentAssist"
import type { ReviewElementContext } from "@/lib/auis-review/elementContext"
import { ReviewCommandMenu } from "./ReviewCommandMenu"

/**
 * Reply composer with image attachments (paste or button), voice dictation and
 * "improve prompt" (wand) — the same toolbox as the pin composer, reused by the
 * drawer card and the anchored thread popover. Text OR image enables sending;
 * ⌘↵ sends.
 */
export function ReplyComposer({
  commentId,
  element = null,
  onDone,
  autoFocus,
}: {
  commentId: string
  /** Context of the comment's element — lets the wand know WHERE it is. */
  element?: ReviewElementContext | null
  onDone?: () => void
  autoFocus?: boolean
}) {
  const addReply = useReviewStore((s) => s.addReply)
  const identity = useReviewStore((s) => s.identity)
  const openIdentityModal = useReviewStore((s) => s.openIdentityModal)
  const sessionRole = useReviewStore((s) => s.sessionRole)
  const [text, setText] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [rewriting, setRewriting] = React.useState(false)
  const [assistError, setAssistError] = React.useState<string | null>(null)
  const [undoText, setUndoText] = React.useState<string | null>(null)
  const img = useImageAttach()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const taRef = React.useRef<HTMLTextAreaElement>(null)
  // A reviewer does not command agents — their "@" only suggests people.
  const commands = useReviewCommandAutocomplete({
    textareaRef: taRef,
    value: text,
    setValue: setText,
    allowAgents: sessionRole === "admin",
  })

  // Voice → text: appends what was recognized to whatever is already written.
  const voice = useVoiceTranscription(
    React.useCallback((spoken: string) => {
      setText((prev) => (prev ? `${prev.trimEnd()} ${spoken}` : spoken))
      requestAnimationFrame(() => taRef.current?.focus())
    }, [])
  )
  // Stops the voice on unmount (Cancel/close) without re-firing effects per render.
  const voiceCancelRef = React.useRef(voice.cancel)
  const pendingSubmitRef = React.useRef(false)
  React.useEffect(() => {
    voiceCancelRef.current = voice.cancel
  })
  React.useEffect(() => () => voiceCancelRef.current(), [])

  React.useEffect(() => {
    if (autoFocus) taRef.current?.focus()
  }, [autoFocus])

  const canSubmit = (text.trim().length > 0 || img.images.length > 0) && !submitting

  const doSubmit = React.useCallback(async () => {
    setSubmitting(true)
    try {
      await addReply(commentId, text, img.images.length > 0 ? img.images : undefined)
      setText("")
      img.reset()
      setUndoText(null)
      onDone?.()
    } finally {
      setSubmitting(false)
    }
  }, [addReply, commentId, text, img, onDone])

  // Sending with the voice active: stop the recording first and only send for
  // real once the transcribed text settles (status back to "idle").
  React.useEffect(() => {
    if (!pendingSubmitRef.current || voice.status !== "idle") return
    pendingSubmitRef.current = false
    void doSubmit()
  }, [voice.status, doSubmit])

  const submit = async () => {
    if (submitting) return
    // No identity (new person on a shared account): identify first — the typed
    // text stays intact; just pick the name and send again.
    if (!identity) {
      openIdentityModal("new")
      return
    }
    if (voice.status === "recording" || voice.status === "transcribing") {
      setSubmitting(true)
      pendingSubmitRef.current = true
      if (voice.status === "recording") voice.stop()
      return
    }
    if (!canSubmit) return
    await doSubmit()
  }

  const handleRewrite = React.useCallback(async () => {
    if (rewriting || text.trim().length === 0) return
    setAssistError(null)
    setRewriting(true)
    const r = await fetchRewrite({ draft: text, element })
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
    requestAnimationFrame(() => taRef.current?.focus())
  }, [rewriting, text, element])

  const undoRewrite = () => {
    if (undoText === null) return
    setText(undoText)
    setUndoText(null)
  }

  const cancel = () => {
    voiceCancelRef.current()
    setText("")
    img.reset()
    setUndoText(null)
    setAssistError(null)
    onDone?.()
  }

  const recording = voice.status === "recording"
  const transcribing = voice.status === "transcribing"

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (undoText !== null) setUndoText(null)
        }}
        onPaste={img.onPaste}
        placeholder="Write a reply… paste an image, or dictate"
        rows={2}
        className="w-full rounded-sm border border-(--border-subtle) bg-(--bg-surface) p-2 body-sm text-(--fg-primary) focus:outline-hidden focus:border-(--accent-brand) resize-none"
        onKeyDown={(e) => {
          if (commands.onKeyDown(e)) return
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit()
        }}
        onSelect={() => commands.sync()}
        onBlur={() => commands.close()}
      />

      <ReviewCommandMenu ac={commands} />

      {assistError && (
        <p className="m-0 body-xs text-(--accent-danger)">{assistError}</p>
      )}
      {voice.error && (
        <p className="m-0 body-xs text-(--accent-danger)">{voice.error}</p>
      )}

      {img.images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {img.images.map((src, idx) => (
            <div key={idx} className="relative group/thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-14 w-14 rounded-sm object-cover border border-(--border-subtle)"
              />
              <button
                type="button"
                onClick={() => img.remove(idx)}
                aria-label="Remove image"
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-(--bg-raised) border border-(--border-subtle) flex items-center justify-center text-(--fg-tertiary) hover:text-(--fg-primary) opacity-0 group-hover/thumb:opacity-100 transition-opacity"
              >
                <Icon name="close" size={9} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!img.canAddMore}
            aria-label="Attach image"
            title="Attach image (or paste with ⌘V)"
            className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover) transition-colors disabled:opacity-40"
          >
            <Icon name="image" size={14} weight={600} />
          </button>
          <button
            type="button"
            onClick={voice.toggle}
            disabled={transcribing}
            aria-label={recording ? "Stop recording" : "Dictate"}
            aria-pressed={recording}
            title={recording ? "Stop recording" : "Dictate"}
            className={[
              "shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-sm transition-colors disabled:opacity-60",
              recording
                ? "bg-(--accent-danger) text-(--fg-on-inverse)"
                : "text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover)",
            ].join(" ")}
          >
            {transcribing ? (
              <AuSpinner size="sm" aria-hidden="true" />
            ) : (
              <Icon
                name={recording ? "stop" : "mic"}
                size={14}
                fill={recording ? 1 : 0}
                weight={600}
              />
            )}
          </button>
          <button
            type="button"
            onClick={handleRewrite}
            disabled={rewriting || text.trim().length === 0}
            aria-label="Improve the reply"
            title="Improve the reply (magic wand)"
            className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-sm text-(--fg-tertiary) hover:text-(--fg-primary) hover:bg-(--bg-hover) transition-colors disabled:opacity-50"
          >
            {rewriting ? (
              <AuSpinner size="sm" aria-hidden="true" />
            ) : (
              <Icon name="auto_fix_high" size={14} weight={600} />
            )}
          </button>

          {recording ? (
            <span className="body-xs text-(--accent-danger) flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-(--accent-danger) animate-pulse" />
              Recording
            </span>
          ) : transcribing ? (
            <span className="body-xs text-(--fg-tertiary) truncate min-w-0">
              Transcribing…
            </span>
          ) : rewriting ? (
            <span className="body-xs text-(--fg-tertiary) truncate min-w-0">
              Improving…
            </span>
          ) : undoText !== null ? (
            <button
              type="button"
              onClick={undoRewrite}
              className="body-xs text-(--fg-secondary) hover:text-(--fg-primary) underline underline-offset-2"
            >
              Undo
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <AuButton variant="ghost" size="sm" onClick={cancel}>
            Cancel
          </AuButton>
          <AuButton
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={!canSubmit && !recording && !transcribing}
            onClick={() => void submit()}
          >
            Reply
          </AuButton>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          await img.add(Array.from(e.target.files ?? []))
          if (fileRef.current) fileRef.current.value = ""
        }}
      />
    </div>
  )
}
