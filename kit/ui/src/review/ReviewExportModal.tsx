"use client"

import * as React from "react"
import { Button } from "../primitives/Button"
import { Modal } from "../primitives/Modal"
import { Icon } from "../primitives/Icon"
import { useToast } from "../primitives/Toast"
import { useReviewStore } from "./store"
import { OVERLAY_DATA_ATTR, REVIEW_Z } from "./constants"
import type { ReviewExportPayload } from "@auis/core/types"

export function ReviewExportModal() {
  const open = useReviewStore((s) => s.exportOpen)
  const setExportOpen = useReviewStore((s) => s.setExportOpen)
  const storage = useReviewStore((s) => s.storage)
  const { push } = useToast()

  const [payload, setPayload] = React.useState<ReviewExportPayload | null>(null)
  const json = React.useMemo(
    () => (payload ? JSON.stringify(payload, null, 2) : ""),
    [payload]
  )

  React.useEffect(() => {
    if (!open) {
      setPayload(null)
      return
    }
    void storage.exportAll().then(setPayload)
  }, [open, storage])

  const copy = async () => {
    if (!json) return
    try {
      await navigator.clipboard.writeText(json)
      push({
        title: "Copied",
        description: "JSON is on the clipboard.",
        variant: "success",
      })
    } catch {
      push({
        title: "Could not copy",
        description: "Select the text manually.",
        variant: "error",
      })
    }
  }

  const download = () => {
    if (!json) return
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `auis-review-${new Date()
      .toISOString()
      .slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    push({
      title: "File downloaded",
      description: a.download,
      variant: "success",
    })
  }

  const count = payload?.comments.length ?? 0

  return (
    <Modal
      open={open}
      onClose={() => setExportOpen(false)}
      zIndex={REVIEW_Z.modal}
      title="Export comments"
      footer={
        <div
          {...{ [OVERLAY_DATA_ATTR]: "" }}
          className="flex items-center justify-between gap-2 w-full"
        >
          <span className="body-xs text-(--fg-tertiary)">
            {count} {count === 1 ? "comment" : "comments"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setExportOpen(false)}>
              Close
            </Button>
            <Button
              variant="secondary"
              iconLeft="content_copy"
              onClick={copy}
              disabled={!json}
            >
              Copy
            </Button>
            <Button
              variant="primary"
              iconLeft="download"
              onClick={download}
              disabled={!json}
            >
              Download .json
            </Button>
          </div>
        </div>
      }
    >
      <div
        {...{ [OVERLAY_DATA_ATTR]: "" }}
        className="flex flex-col gap-3"
      >
        <p className="body-sm text-(--fg-secondary) leading-relaxed flex items-start gap-2">
          <Icon
            name="info"
            size={16}
            className="text-(--fg-tertiary) mt-0.5"
          />
          <span>
            A full snapshot of the bridge (open, in review and archived
            comments). Import it on another checkout through the Review Bridge
            page to merge without duplicates.
          </span>
        </p>
        <pre className="rounded-sm bg-(--bg-muted) border border-(--border-subtle) p-3 max-h-[40vh] overflow-auto body-xs mono text-(--fg-primary) whitespace-pre">
          {json || "Loading…"}
        </pre>
      </div>
    </Modal>
  )
}
