import { Icon } from "@/components/ui/Icon"
import type { ReviewFlowRef } from "./types"

/**
 * Marks a review comment that was authored on a styleguide UX-flow diagram,
 * distinguishing it from normal page comments in the review inbox/thread.
 * Purple to tie it visually to the flow editor's cross-flow accent.
 */
export function UxFlowChip({ flowRef }: { flowRef?: ReviewFlowRef }) {
  const title = flowRef
    ? `Flow: ${flowRef.flow}${flowRef.nodeLabel ? ` · ${flowRef.nodeLabel}` : ""}`
    : "Comentário de UX flow"
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-xs bg-(--au-purple-100) px-1.5 py-0.5 body-xs font-medium text-(--au-purple-700)"
      title={title}
    >
      <Icon name="account_tree" size={10} />
      UX Flow
    </span>
  )
}
