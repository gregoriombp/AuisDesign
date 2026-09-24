"use client"

import * as React from "react"
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

import { ReviewAvatar } from "@/components/auis-review/ReviewAvatar"
import { AuSegmented } from "@/components/ui/AuSegmented"
import { AuToggle } from "@/components/ui/AuToggle"
import { Icon } from "@/components/ui/Icon"
import { REVIEW_AGENTS } from "@/lib/auis-review/agents"
import {
  getReviewAgentRuntime,
  type ReviewAgentPermission,
} from "@/lib/auis-review/agentRuntime"
import {
  agentSettingsOf,
  useAgentSettingsStore,
} from "@/lib/auis-review/agentSettingsStore"
import { cn } from "@/lib/utils"

const PERMISSION_LABEL: Record<ReviewAgentPermission, string> = {
  reply: "Reply",
  edit: "Edit",
}

const PERMISSION_HINT: Record<ReviewAgentPermission, string> = {
  reply: "Reads and answers in the thread. Never edits.",
  edit: "Edits, sends to review and answers.",
}

/**
 * The dot's Agents panel: one row per agent, always with the on/off switch and
 * a disclosure — off also shows the ceiling, so you can adjust it before
 * switching the agent on. It lives in a Popover, not inside the menu, because
 * a menu does not host controls.
 */
export function AgentsPanel() {
  const settings = useAgentSettingsStore((s) => s.settings)
  const triggerEnabled = useAgentSettingsStore((s) => s.triggerEnabled)
  const update = useAgentSettingsStore((s) => s.update)

  return (
    <div className="flex w-80 flex-col">
      <div className="flex flex-col gap-0.5 px-3 pb-2 pt-3">
        <p className="m-0 body-sm font-medium text-(--fg-primary)">Agents</p>
        <p className="m-0 body-xs text-(--fg-tertiary)">
          {triggerEnabled
            ? "A mention opens the agent on this machine."
            : "The trigger does not run here. Local dev only, with AUIS_MENTION_TRIGGER=1."}
        </p>
      </div>
      <div className="divide-y divide-(--border-default) border-t border-(--border-default)">
        {REVIEW_AGENTS.map((agent) => {
          const runtime = getReviewAgentRuntime(agent.id)
          if (!runtime) return null
          const s = agentSettingsOf(settings, agent.id)
          // Model only where there is a choice: an agent with one model (or
          // none) shows nothing, not even in the summary.
          const model =
            runtime.models.length > 1
              ? runtime.models.find((m) => m.id === s.model)
              : undefined
          const summary =
            runtime.unavailable ??
            (s.enabled
              ? [PERMISSION_LABEL[s.permission], model?.label].filter(Boolean).join(" · ")
              : "Off")
          return (
            <CollapsiblePrimitive.Root key={agent.id} defaultOpen={false}>
              <div className="flex items-center gap-2.5 px-3 py-2 hover:bg-(--bg-hover)">
                <CollapsiblePrimitive.Trigger asChild>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-(--ring-focus) focus-visible:ring-offset-2"
                  >
                    <ReviewAvatar
                      authorKind="agent"
                      authorId={agent.id}
                      authorName={agent.name}
                      colorToken={agent.accentVar}
                      size={24}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block body-sm font-medium text-(--fg-primary)">
                        {agent.name}
                      </span>
                      <span className="block truncate body-xs text-(--fg-tertiary)">
                        {summary}
                      </span>
                    </span>
                  </button>
                </CollapsiblePrimitive.Trigger>
                <AuToggle
                  checked={s.enabled}
                  disabled={runtime.cli === null}
                  label={`Switch ${agent.name} on`}
                  onChange={(enabled) => void update(agent.id, { enabled })}
                />
                <CollapsiblePrimitive.Trigger asChild>
                  <button
                    type="button"
                    aria-label={`Ceiling and model of ${agent.name}`}
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-(--fg-secondary) outline-hidden transition-transform hover:bg-(--bg-canvas) focus-visible:ring-2 focus-visible:ring-(--ring-focus) data-[state=open]:rotate-180",
                    )}
                  >
                    <Icon name="expand_more" size={15} />
                  </button>
                </CollapsiblePrimitive.Trigger>
              </div>
              <CollapsiblePrimitive.Content className="au-collapsible-content">
                <div className="flex flex-col gap-2 border-t border-(--border-default) px-3 pb-3 pt-2">
                  <AuSegmented
                    size="sm"
                    ariaLabel={`Ceiling of ${agent.name}`}
                    value={s.permission}
                    options={runtime.permissions.map((p) => ({
                      value: p,
                      label: PERMISSION_LABEL[p],
                      disabled: runtime.cli === null,
                    }))}
                    onChange={(permission) => void update(agent.id, { permission })}
                  />
                  <p className="m-0 body-xs text-(--fg-tertiary)">{PERMISSION_HINT[s.permission]}</p>
                  {runtime.models.length > 1 && (
                    <AuSegmented
                      size="sm"
                      ariaLabel={`Model of ${agent.name}`}
                      value={s.model ?? runtime.models[0].id}
                      options={runtime.models.map((m) => ({ value: m.id, label: m.label }))}
                      onChange={(next) => void update(agent.id, { model: next })}
                    />
                  )}
                </div>
              </CollapsiblePrimitive.Content>
            </CollapsiblePrimitive.Root>
          )
        })}
      </div>
    </div>
  )
}
