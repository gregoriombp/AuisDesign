"use client"

import { create } from "zustand"
import { useReviewStore } from "@/lib/auis-review/store"
import { useEditStore } from "@/lib/auis-edit/store"

// Ephemeral flag (off after a reload). The screen state lives in the URL; the
// store never navigates. Explicit exit: `exitRequested` → StatesModeProvider
// clears the params.

type StatesState = {
  active: boolean
  /**
   * Explicit exit (X, ⌘⇧S, Escape). `setActive(false)` is silent and keeps
   * the URL — you can pin a scenario and open Review on top of it.
   */
  exitRequested: boolean

  toggleActive: () => void
  setActive: (active: boolean) => void
  requestExit: () => void
}

export const useStatesStore = create<StatesState>()((set, get) => ({
  active: false,
  exitRequested: false,

  toggleActive: () => {
    if (get().active) get().requestExit()
    else get().setActive(true)
  },

  setActive: (active) => {
    if (active) {
      // Mutual exclusion. The reverse direction (review/edit turning states
      // off) lives in StatesModeProvider, to avoid an import cycle.
      useReviewStore.getState().setActive(false)
      useEditStore.getState().setActive(false)
      set({ active: true, exitRequested: false })
    } else {
      set({ active: false, exitRequested: false })
    }
  },

  requestExit: () => {
    if (get().active) set({ exitRequested: true })
  },
}))
