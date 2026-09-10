"use client"

import * as React from "react"
import { AuButton } from "@/components/ui/AuButton"
import { AuInput } from "@/components/ui/AuInput"
import { AuModal } from "@/components/ui/AuModal"
import { useReviewStore } from "@/lib/auis-review/store"
import { OVERLAY_DATA_ATTR, REVIEW_PALETTE, REVIEW_Z } from "./constants"

export function ReviewIdentityModal() {
  const open = useReviewStore((s) => s.identityModalOpen)
  const identity = useReviewStore((s) => s.identity)
  const draftMode = useReviewStore((s) => s.identityDraftMode)
  const sessionShared = useReviewStore((s) => s.sessionShared)
  const setIdentity = useReviewStore((s) => s.setIdentity)
  const closeIdentityModal = useReviewStore((s) => s.closeIdentityModal)

  // In "new" (Add account) the form starts blank, even when a current identity
  // already exists.
  const isNew = draftMode === "new"

  const [name, setName] = React.useState(identity?.name ?? "")
  const [email, setEmail] = React.useState(identity?.email ?? "")
  const [colorToken, setColorToken] = React.useState(
    identity?.colorToken ?? REVIEW_PALETTE[0].token
  )

  React.useEffect(() => {
    if (open) {
      setName(isNew ? "" : identity?.name ?? "")
      setEmail(isNew ? "" : identity?.email ?? "")
      setColorToken(
        isNew ? REVIEW_PALETTE[0].token : identity?.colorToken ?? REVIEW_PALETTE[0].token
      )
    }
  }, [open, identity, isNew])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await setIdentity(name, colorToken, email)
  }

  return (
    <AuModal
      open={open}
      onClose={closeIdentityModal}
      zIndex={REVIEW_Z.modal}
      title={
        isNew
          ? "Add account"
          : identity
            ? "Edit reviewer"
            : "Who is reviewing?"
      }
      footer={
        <div
          {...{ [OVERLAY_DATA_ATTR]: "" }}
          className="flex items-center justify-end gap-2"
        >
          <AuButton variant="ghost" onClick={closeIdentityModal}>
            Cancel
          </AuButton>
          <AuButton
            variant="primary"
            onClick={submit}
            disabled={!name.trim()}
          >
            {isNew ? "Add" : identity ? "Save" : "Start"}
          </AuButton>
        </div>
      }
    >
      <form
        {...{ [OVERLAY_DATA_ATTR]: "" }}
        onSubmit={submit}
        className="flex flex-col gap-5"
      >
        <p className="body-sm text-(--fg-secondary) leading-relaxed">
          {sessionShared
            ? "This login is shared between people — identify yourself so every comment goes out under YOUR name. Saved only in this browser."
            : "Your name shows on every comment and on the agent replies. Saved only in your browser."}
        </p>

        <label className="flex flex-col gap-2">
          <span className="body-xs font-medium text-(--fg-secondary)">
            Name
          </span>
          <AuInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane"
            autoFocus
            maxLength={40}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="body-xs font-medium text-(--fg-secondary)">
            Personal e-mail <span className="text-(--fg-tertiary)">(optional)</span>
          </span>
          <AuInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            maxLength={80}
          />
          <span className="body-xs text-(--fg-tertiary)">
            Shows on hover of your name and of your @mention.
          </span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="body-xs font-medium text-(--fg-secondary) mb-1">
            Your marker color
          </legend>
          <div className="flex flex-wrap gap-2">
            {REVIEW_PALETTE.map((c) => {
              const selected = colorToken === c.token
              return (
                <button
                  key={c.token}
                  type="button"
                  onClick={() => setColorToken(c.token)}
                  aria-label={c.label}
                  aria-pressed={selected}
                  className="h-9 w-9 rounded-full border-2 transition-all hover:scale-110"
                  style={{
                    background: c.token,
                    borderColor: selected
                      ? "var(--fg-primary)"
                      : "transparent",
                  }}
                  title={c.label}
                />
              )
            })}
          </div>
        </fieldset>

        <button type="submit" hidden />
      </form>
    </AuModal>
  )
}
