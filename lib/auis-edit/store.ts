"use client"

import { create } from "zustand"
import { useReviewStore } from "@/lib/auis-review/store"
import type { PageEditAnchor, PageEditOp, PageEditOpType } from "./types"

// Edit Mode persists to the serverless /api/page-edits route (same-origin, no
// token, always available under `npm run dev` — same model as flow-bridge), so
// the store is a thin HTTP client over a bit of UI state. No local/bridge
// storage abstraction needed.

const BASE = "/api/page-edits"

async function apiList(route: string): Promise<PageEditOp[]> {
  try {
    const res = await fetch(`${BASE}?route=${encodeURIComponent(route)}`, {
      cache: "no-store",
    })
    if (!res.ok) return []
    const data = (await res.json()) as { ops?: PageEditOp[] }
    return Array.isArray(data.ops) ? data.ops : []
  } catch {
    return []
  }
}

async function apiCreate(input: {
  route: string
  type: PageEditOpType
  anchor: PageEditAnchor
  payload: PageEditOp["payload"]
  authorName?: string
}): Promise<PageEditOp | null> {
  try {
    const res = await fetch(BASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!res.ok) return null
    return ((await res.json()) as { op: PageEditOp }).op
  } catch {
    return null
  }
}

/** Whoever the user said they are in the Review identity modal. Edit Mode and
 *  Review Mode attribute to the same person; falls back to a neutral actor when
 *  the identity hasn't been set yet. */
function currentActor(): { kind: "user"; id: string; name: string } {
  const identity = useReviewStore.getState().identity
  return identity
    ? { kind: "user", id: identity.id, name: identity.name }
    : { kind: "user", id: "user", name: "You" }
}

async function apiTransition(
  route: string,
  id: string,
  transition: "in_review" | "apply" | "discard" | "reject",
): Promise<void> {
  try {
    await fetch(`${BASE}/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        route,
        transition,
        actor: currentActor(),
      }),
    })
  } catch {
    /* offline / no dev server — overlay stays in memory only */
  }
}

async function apiDelete(route: string, id: string): Promise<void> {
  try {
    await fetch(`${BASE}/${id}?route=${encodeURIComponent(route)}`, {
      method: "DELETE",
    })
  } catch {
    /* noop */
  }
}

type EditState = {
  /** Authoring on/off. The APPLY half runs regardless (see EditModeProvider). */
  active: boolean
  /** Current page pathname; set by the provider on mount + route change. */
  route: string | null
  /** Open + in_review ops for the current route (applied/discarded are archived). */
  ops: PageEditOp[]
  /** Element the inspector is bound to. */
  selectedAnchor: PageEditAnchor | null
  inspectorOpen: boolean

  toggleActive: () => void
  setActive: (active: boolean) => void
  setRoute: (route: string) => Promise<void>
  refresh: () => Promise<void>

  selectElement: (anchor: PageEditAnchor | null) => void
  closeInspector: () => void

  saveText: (anchor: PageEditAnchor, text: string, prevText?: string) => Promise<void>
  saveStyle: (
    anchor: PageEditAnchor,
    prop: string,
    token: string,
    opts?: {
      prevToken?: string
      offSpec?: boolean
      offSpecComponent?: string
      custom?: boolean
    },
  ) => Promise<void>
  saveHide: (anchor: PageEditAnchor, mode: "hide" | "remove") => Promise<void>
  saveVariant: (
    anchor: PageEditAnchor,
    payload: { axis: string; value: string; label?: string; remove: string[]; add: string },
  ) => Promise<void>
  saveClass: (
    anchor: PageEditAnchor,
    payload: { group: string; label?: string; remove: string[]; add: string },
  ) => Promise<void>
  saveIcon: (anchor: PageEditAnchor, name: string, prevName?: string) => Promise<void>
  saveIconStyle: (
    anchor: PageEditAnchor,
    variation: { fill: number; weight: number; grade: number; opticalSize: number },
  ) => Promise<void>
  saveToken: (token: string, value: string, prevValue?: string) => Promise<void>
  saveMove: (anchor: PageEditAnchor, order: string[]) => Promise<void>

  transition: (
    id: string,
    transition: "in_review" | "apply" | "discard" | "reject",
  ) => Promise<void>
  removeOp: (id: string) => Promise<void>
}

export const useEditStore = create<EditState>()((set, get) => ({
  active: false,
  route: null,
  ops: [],
  selectedAnchor: null,
  inspectorOpen: false,

  toggleActive: () => get().setActive(!get().active),

  setActive: (active) => {
    if (active) {
      // Mutual exclusion: Review Mode also captures clicks — never both at once.
      useReviewStore.getState().setActive(false)
      set({ active: true })
      void get().refresh()
    } else {
      set({ active: false, selectedAnchor: null, inspectorOpen: false })
    }
  },

  setRoute: async (route) => {
    if (get().route === route) return
    set({ route, ops: [], selectedAnchor: null, inspectorOpen: false })
    await get().refresh()
  },

  refresh: async () => {
    const route = get().route
    if (!route) return
    const ops = await apiList(route)
    // Guard against a route change that landed mid-flight.
    if (get().route === route) set({ ops })
  },

  selectElement: (anchor) =>
    set({ selectedAnchor: anchor, inspectorOpen: !!anchor }),
  closeInspector: () => set({ selectedAnchor: null, inspectorOpen: false }),

  saveText: async (anchor, text, prevText) => {
    const route = get().route
    if (!route) return
    await apiCreate({
      route,
      type: "text",
      anchor,
      payload: { kind: "text", text, ...(prevText ? { prevText } : {}) },
    })
    await get().refresh()
  },

  saveStyle: async (anchor, prop, token, opts) => {
    const route = get().route
    if (!route) return
    await apiCreate({
      route,
      type: "style",
      anchor,
      payload: {
        kind: "style",
        prop,
        token,
        ...(opts?.prevToken ? { prevToken: opts.prevToken } : {}),
        ...(opts?.custom ? { custom: true } : {}),
        ...(opts?.offSpec
          ? {
              offSpec: true,
              ...(opts.offSpecComponent
                ? { offSpecComponent: opts.offSpecComponent }
                : {}),
            }
          : {}),
      },
    })
    await get().refresh()
  },

  saveHide: async (anchor, mode) => {
    const route = get().route
    if (!route) return
    await apiCreate({
      route,
      type: "hide",
      anchor,
      payload: { kind: "hide", mode },
    })
    await get().refresh()
  },

  saveVariant: async (anchor, payload) => {
    const route = get().route
    if (!route) return
    await apiCreate({
      route,
      type: "variant",
      anchor,
      payload: { kind: "variant", ...payload },
    })
    await get().refresh()
  },

  saveClass: async (anchor, payload) => {
    const route = get().route
    if (!route) return
    await apiCreate({
      route,
      type: "class",
      anchor,
      payload: { kind: "class", ...payload },
    })
    await get().refresh()
  },

  saveIcon: async (anchor, name, prevName) => {
    const route = get().route
    if (!route) return
    await apiCreate({
      route,
      type: "icon",
      anchor,
      payload: { kind: "icon", name, ...(prevName ? { prevName } : {}) },
    })
    await get().refresh()
  },

  saveIconStyle: async (anchor, variation) => {
    const route = get().route
    if (!route) return
    await apiCreate({
      route,
      type: "iconStyle",
      anchor,
      payload: { kind: "iconStyle", ...variation },
    })
    await get().refresh()
  },

  saveToken: async (token, value, prevValue) => {
    const route = get().route
    if (!route) return
    await apiCreate({
      route,
      type: "token",
      anchor: { selector: ":root" },
      payload: { kind: "token", token, value, ...(prevValue ? { prevValue } : {}) },
    })
    await get().refresh()
  },

  saveMove: async (anchor, order) => {
    const route = get().route
    if (!route) return
    await apiCreate({
      route,
      type: "move",
      anchor,
      payload: { kind: "move", order },
    })
    await get().refresh()
  },

  transition: async (id, transition) => {
    const route = get().route
    if (!route) return
    await apiTransition(route, id, transition)
    await get().refresh()
  },

  removeOp: async (id) => {
    const route = get().route
    if (!route) return
    await apiDelete(route, id)
    await get().refresh()
  },
}))
