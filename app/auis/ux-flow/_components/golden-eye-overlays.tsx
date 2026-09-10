"use client"

import * as React from "react"
import { ReviewCommandMenu } from "@/components/auis-review/ReviewCommandMenu"
import { AuButton } from "@/components/ui/AuButton"
import { AuModal } from "@/components/ui/AuModal"
import { AuSegmented } from "@/components/ui/AuSegmented"
import { AuSheet } from "@/components/ui/AuSheet"
import { AuTextarea } from "@/components/ui/AuTextarea"
import { useReviewStore } from "@/lib/auis-review/store"
import { useReviewCommandAutocomplete } from "@/lib/auis-review/useReviewCommandAutocomplete"

export type GoldenEyeScreenVariant = {
  label: string
  href: string
}

export type GoldenEyeScreenTarget = {
  title: string
  variants: GoldenEyeScreenVariant[]
}

export type GoldenEyeCommentTarget = {
  id: string
  title: string
}

export type GoldenEyeComment = {
  id: string
  text: string
  at: number
  /** Old flow-suggestion record kept visible during the compatibility window. */
  legacy?: boolean
}

export function GoldenEyeScreenPreview({
  open,
  screen,
  activeVariant,
  onActiveVariantChange,
  onClose,
}: {
  open: boolean
  screen: GoldenEyeScreenTarget | null
  activeVariant: number
  onActiveVariantChange: (index: number) => void
  onClose: () => void
}) {
  const active = screen?.variants[activeVariant] ?? screen?.variants[0]
  const hasVariants = (screen?.variants.length ?? 0) > 1
  const options =
    screen?.variants.map((variant, index) => ({
      value: String(index),
      label: variant.label,
    })) ?? []

  return (
    <AuSheet
      open={open && active != null}
      onClose={onClose}
      size="xwide"
      title={screen?.title ?? "Screen preview"}
      meta={active?.href}
      tabs={
        hasVariants ? (
          <div className="max-w-full overflow-x-auto py-2">
            <AuSegmented
              options={options}
              value={String(activeVariant)}
              onChange={(value) => onActiveVariantChange(Number(value))}
              ariaLabel="Screen variant"
              size="sm"
            />
          </div>
        ) : undefined
      }
      bodyClassName="overflow-hidden! p-0!"
      footer={
        active ? (
          <AuButton asChild variant="secondary" size="sm" iconRight="open_in_new">
            <a href={active.href} target="_blank" rel="noreferrer">
              Open in a new tab
            </a>
          </AuButton>
        ) : undefined
      }
    >
      {active && (
        <iframe
          key={`${active.href}:${active.label}`}
          src={active.href}
          title={`${screen?.title ?? "Screen"} · ${active.label}`}
          className="h-full w-full bg-white"
        />
      )}
    </AuSheet>
  )
}

export function GoldenEyeCommentComposer({
  open,
  target,
  comments,
  draft,
  onDraftChange,
  sending,
  onSend,
  onClose,
  placeholder,
}: {
  open: boolean
  target: GoldenEyeCommentTarget | null
  comments: GoldenEyeComment[]
  draft: string
  onDraftChange: (value: string) => void
  sending: boolean
  onSend: () => void | Promise<void>
  onClose: () => void
  placeholder: string
}) {
  const sessionRole = useReviewStore((state) => state.sessionRole)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const commands = useReviewCommandAutocomplete({
    textareaRef,
    value: draft,
    setValue: onDraftChange,
    enabled: open && target != null,
    allowAgents: sessionRole === "admin",
  })

  return (
    <AuModal
      open={open && target != null}
      onClose={onClose}
      size="sm"
      title="Comment on the card"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="caption text-(--fg-tertiary)">Goes to the Review Bridge</span>
          <AuButton
            variant="primary"
            size="sm"
            disabled={!draft.trim()}
            loading={sending}
            onClick={() => void onSend()}
          >
            Send comment
          </AuButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {target && (
          <p className="m-0 truncate text-sm font-medium text-(--fg-primary)">
            {target.title}
            <span className="ml-1 font-normal text-(--fg-tertiary)">· the note lands on this card</span>
          </p>
        )}

        {comments.length > 0 && (
          <div className="flex max-h-48 flex-col gap-2 overflow-auto rounded-md border border-(--border-default) bg-(--bg-canvas) p-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-md border border-(--border-default) bg-(--bg-raised) px-3 py-2 text-xs text-(--fg-secondary)"
              >
                <p className="m-0 whitespace-pre-wrap">{comment.text}</p>
                {comment.legacy && (
                  <span className="mt-1 inline-flex text-2xs text-(--fg-tertiary)">
                    Legacy comment · read-only
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <AuTextarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={placeholder}
          rows={3}
          resize="none"
          autoFocus
          onKeyDown={(event) => {
            if (commands.onKeyDown(event)) return
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault()
              void onSend()
            }
          }}
          onSelect={() => commands.sync()}
          onBlur={() => commands.close()}
        />
        <ReviewCommandMenu ac={commands} />
      </div>
    </AuModal>
  )
}
