"use client"

import { create } from "zustand"

/**
 * "Hide until refresh": takes the host's own launcher (the Auis dot, for one)
 * and the Review pill off the screen until the next page load. It lives in
 * memory only, on purpose: reloading is how both come back. Cmd+Shift+Y still
 * opens Review while hidden.
 */
type ChromeDismissState = {
  dismissed: boolean
  dismiss: () => void
}

export const useChromeDismissStore = create<ChromeDismissState>((set) => ({
  dismissed: false,
  dismiss: () => set({ dismissed: true }),
}))
