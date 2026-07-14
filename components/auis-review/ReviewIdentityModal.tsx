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
  const setIdentity = useReviewStore((s) => s.setIdentity)
  const closeIdentityModal = useReviewStore((s) => s.closeIdentityModal)

  const [name, setName] = React.useState(identity?.name ?? "")
  const [colorToken, setColorToken] = React.useState(
    identity?.colorToken ?? REVIEW_PALETTE[0].token
  )

  React.useEffect(() => {
    if (open) {
      setName(identity?.name ?? "")
      setColorToken(identity?.colorToken ?? REVIEW_PALETTE[0].token)
    }
  }, [open, identity])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await setIdentity(name, colorToken)
  }

  return (
    <AuModal
      open={open}
      onClose={closeIdentityModal}
      zIndex={REVIEW_Z.modal}
      title={identity ? "Edit reviewer" : "Who is reviewing?"}
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
            {identity ? "Save" : "Start"}
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
          Your name shows up on every comment and in the agent replies. It is
          stored only in your browser.
        </p>

        <label className="flex flex-col gap-2">
          <span className="body-xs font-medium text-(--fg-secondary)">
            Name
          </span>
          <AuInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            autoFocus
            maxLength={40}
          />
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
