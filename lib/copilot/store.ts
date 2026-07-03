import { create } from "zustand"

/**
 * Open state for the Copilot (Cortex) drawer.
 *
 * The drawer itself lives in DashboardLayout, but the toggle needs to be
 * reachable from anywhere — the topbar orb and feature pages alike — so the
 * state is lifted into this tiny store instead of DashboardLayout's useState.
 */
type CopilotDrawerState = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useCopilotDrawer = create<CopilotDrawerState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}))
