"use client"

import { ToastProvider } from "./primitives/Toast"
import { ReviewModeProvider } from "./review/ReviewModeProvider"
import type { ReviewModeLink } from "./review/ReviewToolbar"

/**
 * The whole review chrome — the toolbar and everything Review Mode draws — in
 * one element for the host's root layout. It brings its own toast stack, so it
 * needs nothing from the host's providers.
 */
export function ReviewChrome({ modes }: { modes?: ReviewModeLink[] }) {
  return (
    <ToastProvider>
      <ReviewModeProvider modes={modes} />
    </ToastProvider>
  )
}
