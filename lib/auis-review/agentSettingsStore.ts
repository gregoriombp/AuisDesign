"use client"

// Client store for the per-agent Live Response / Auto Construct toggles shown in
// the floating Auis dot. Hydrates once from the serverless bridge and
// writes each toggle through optimistically (reverting on failure). The bridge
// file is the source of truth — the /loop dispatcher reads it directly.

import { create } from "zustand"
import type {
  ReviewAgentSettings,
  ReviewAgentSettingsMap,
} from "@/components/auis-review/types"

const ENDPOINT = "/api/review-bridge/agent-settings"
const OFF: ReviewAgentSettings = { liveResponse: false, autoConstruct: false }

interface AgentSettingsState {
  settings: ReviewAgentSettingsMap
  hydrated: boolean
  hydrate: () => Promise<void>
  toggle: (agentId: string, key: keyof ReviewAgentSettings) => Promise<void>
}

export const useAgentSettingsStore = create<AgentSettingsState>()((set, get) => ({
  settings: {},
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return
    try {
      const res = await fetch(ENDPOINT)
      if (res.ok) {
        const data = (await res.json()) as { settings?: ReviewAgentSettingsMap }
        set({ settings: data.settings ?? {}, hydrated: true })
        return
      }
    } catch {
      // offline / no bridge — fall back to all-off, still usable.
    }
    set({ hydrated: true })
  },
  toggle: async (agentId, key) => {
    const prev = get().settings[agentId] ?? OFF
    const next: ReviewAgentSettings = { ...prev, [key]: !prev[key] }
    set((s) => ({ settings: { ...s.settings, [agentId]: next } }))
    try {
      const res = await fetch(ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, settings: next }),
      })
      if (!res.ok) throw new Error("put_failed")
    } catch {
      // Revert ONLY this key off the CURRENT state — a concurrent toggle of the
      // agent's other key (rapid clicks; the menu stays open) must survive.
      set((s) => {
        const current = s.settings[agentId] ?? OFF
        return {
          settings: { ...s.settings, [agentId]: { ...current, [key]: prev[key] } },
        }
      })
    }
  },
}))

/** Settings for an agent, defaulting to all-off when never toggled. */
export function agentSettingsOf(
  map: ReviewAgentSettingsMap,
  agentId: string,
): ReviewAgentSettings {
  return map[agentId] ?? OFF
}
