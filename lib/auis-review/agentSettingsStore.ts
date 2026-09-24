"use client"

// State of the Agents panel (on · ceiling · model per agent). Hydrates once
// from the bridge and writes every change optimistically, reverting only the
// keys that failed. The bridge is the source of truth: the write routes and the
// mention runner read it from there, not from here.

import { create } from "zustand"
import {
  normalizeAgentSettings,
  type ReviewAgentSettings,
  type ReviewAgentSettingsMap,
} from "./agentRuntime"

const ENDPOINT = "/api/review-bridge/agent-settings"
const OFF: ReviewAgentSettings = { enabled: false, permission: "reply", model: null }

interface AgentSettingsState {
  settings: ReviewAgentSettingsMap
  /** Does the mention trigger run on this machine? null until hydrated. */
  triggerEnabled: boolean | null
  hydrated: boolean
  hydrate: () => Promise<void>
  update: (agentId: string, patch: Partial<ReviewAgentSettings>) => Promise<void>
}

export const useAgentSettingsStore = create<AgentSettingsState>()((set, get) => ({
  settings: {},
  triggerEnabled: null,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return
    try {
      const res = await fetch(ENDPOINT)
      if (res.ok) {
        const data = (await res.json()) as {
          settings?: ReviewAgentSettingsMap
          triggerEnabled?: boolean
        }
        set({
          settings: data.settings ?? {},
          triggerEnabled: data.triggerEnabled ?? false,
          hydrated: true,
        })
        return
      }
    } catch {
      // offline / no bridge — keep the runtime defaults, still usable.
    }
    set({ hydrated: true })
  },
  update: async (agentId, patch) => {
    const prev = agentSettingsOf(get().settings, agentId)
    set((s) => ({ settings: { ...s.settings, [agentId]: { ...prev, ...patch } } }))
    try {
      const res = await fetch(ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, settings: patch }),
      })
      if (!res.ok) throw new Error("put_failed")
    } catch {
      // Revert ONLY this patch's keys off the CURRENT state — another click on
      // the same agent (the panel stays open) must survive.
      set((s) => {
        const current = agentSettingsOf(s.settings, agentId)
        const reverted = {
          ...current,
          ...Object.fromEntries(
            Object.keys(patch).map((k) => [k, prev[k as keyof ReviewAgentSettings]]),
          ),
        } as ReviewAgentSettings
        return { settings: { ...s.settings, [agentId]: reverted } }
      })
    }
  },
}))

/** Settings for an agent; with nothing stored, the runtime defaults. */
export function agentSettingsOf(
  map: ReviewAgentSettingsMap,
  agentId: string,
): ReviewAgentSettings {
  return map[agentId] ?? normalizeAgentSettings(agentId, undefined) ?? OFF
}
