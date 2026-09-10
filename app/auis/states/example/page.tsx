"use client"

import * as React from "react"
import Link from "next/link"

import { AuAlert } from "@/components/ui/AuAlert"
import { AuButton } from "@/components/ui/AuButton"
import { AuCard } from "@/components/ui/AuCard"
import {
  AuEmpty,
  AuEmptyContent,
  AuEmptyDescription,
  AuEmptyHeader,
  AuEmptyMedia,
  AuEmptyTitle,
} from "@/components/ui/AuEmpty"
import { AuModal } from "@/components/ui/AuModal"
import { AuPill } from "@/components/ui/AuPill"
import { AuSheet, AuSheetRow } from "@/components/ui/AuSheet"
import { AuSpinner } from "@/components/ui/AuSpinner"
import { AuStatCard } from "@/components/ui/AuStatCard"
import { AuTable } from "@/components/ui/AuTable"
import { AuInput } from "@/components/ui/AuInput"
import { Icon } from "@/components/ui/Icon"
import { useScreenStateOverride } from "@/lib/auis-states/useScreenStateOverride"
import { parseExamplePlan, parseExampleState } from "./state"

/**
 * State Mode demo screen (Pattern B, client): every scenario is addressable
 * through the URL — `?state=empty|loading|error|permission` and `?plan=pro` —
 * and read during render with `useScreenStateOverride`. Nothing is copied into
 * `useState`, so flipping the pill (or editing the URL) re-renders the right
 * scenario instantly. The two overlays are reached through interactions
 * (`?ge=t:New item`, `?ge=t:Open details`) replayed by the FlowStateDriver.
 */

const ITEMS = [
  { id: "inv-1042", name: "Onboarding checklist", owner: "Jane", status: "live" },
  { id: "inv-1041", name: "Billing settings", owner: "Sam", status: "draft" },
  { id: "inv-1040", name: "Team invitations", owner: "Ana", status: "live" },
  { id: "inv-1039", name: "Notification rules", owner: "Lee", status: "beta" },
] as const

export default function StatesExamplePage() {
  return (
    <React.Suspense fallback={null}>
      <StatesExampleScreen />
    </React.Suspense>
  )
}

function StatesExampleScreen() {
  const state = useScreenStateOverride("state", parseExampleState)
  const plan = useScreenStateOverride("plan", parseExamplePlan)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const readOnly = state === "permission"

  return (
    <main className="min-h-screen bg-(--bg-canvas) text-(--fg-primary)">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <Link href="/auis/states" className="no-underline">
          <AuButton variant="ghost" size="sm" iconLeft="arrow_back">
            State Mode
          </AuButton>
        </Link>

        <header className="mt-6 mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="au-eyebrow mb-2">Demo screen</p>
            <h1 className="text-4xl font-semibold tracking-tight">Items</h1>
            <p className="mt-2 text-(--fg-secondary) max-w-2xl leading-relaxed">
              A small inventory screen whose scenarios live in the URL. Press{" "}
              <kbd className="font-mono text-xs">⌘⇧S</kbd> to flip them from the pill,
              or open the matrix to see them all side by side.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AuPill variant={plan === "pro" ? "ai" : "neutral"} dot={false}>
              {plan === "pro" ? "Pro plan" : "Free plan"}
            </AuPill>
            {plan === "pro" && (
              <AuButton variant="secondary" size="sm" iconLeft="download" disabled={readOnly}>
                Export
              </AuButton>
            )}
            <AuButton
              variant="primary"
              size="sm"
              iconLeft="add"
              disabled={readOnly}
              onClick={() => setModalOpen(true)}
            >
              New item
            </AuButton>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <AuStatCard size="sm" icon="inventory_2" label="Items" value={state === "default" ? ITEMS.length : 0} />
          <AuStatCard size="sm" icon="bolt" label="Live" value={state === "default" ? 2 : 0} />
          <AuStatCard size="sm" icon="group" label="Owners" value={state === "default" ? 4 : 0} />
        </div>

        {state === "loading" && (
          <div className="flex items-center justify-center gap-3 rounded-lg border border-(--border-subtle) bg-(--bg-raised) py-16 text-(--fg-secondary)">
            <AuSpinner size="md" label="Loading items" />
            <span className="body-sm">Loading items…</span>
          </div>
        )}

        {state === "error" && (
          <AuAlert variant="danger" title="The list failed to load">
            The items service did not answer. Try again in a moment.
          </AuAlert>
        )}

        {state === "empty" && (
          <AuEmpty>
            <AuEmptyHeader>
              <AuEmptyMedia variant="icon">
                <Icon name="inventory_2" size={24} />
              </AuEmptyMedia>
              <AuEmptyTitle>No items yet</AuEmptyTitle>
              <AuEmptyDescription>
                Create the first item and it shows up here with its owner and status.
              </AuEmptyDescription>
            </AuEmptyHeader>
            <AuEmptyContent>
              <AuButton variant="primary" iconLeft="add" onClick={() => setModalOpen(true)}>
                New item
              </AuButton>
            </AuEmptyContent>
          </AuEmpty>
        )}

        {state === "permission" && (
          <AuEmpty>
            <AuEmptyHeader>
              <AuEmptyMedia variant="icon">
                <Icon name="lock" size={24} />
              </AuEmptyMedia>
              <AuEmptyTitle>Read-only access</AuEmptyTitle>
              <AuEmptyDescription>
                Your role can see the summary but cannot create or export items.
                Ask an admin to change it.
              </AuEmptyDescription>
            </AuEmptyHeader>
          </AuEmpty>
        )}

        {state === "default" && (
          <AuCard className="p-0 overflow-hidden">
            <AuTable>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th className="text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {ITEMS.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="font-medium">{item.name}</span>
                      <span className="block font-mono text-xs text-(--fg-tertiary)">{item.id}</span>
                    </td>
                    <td>{item.owner}</td>
                    <td>
                      <AuPill variant={item.status === "live" ? "live" : item.status === "beta" ? "beta" : "draft"}>
                        {item.status}
                      </AuPill>
                    </td>
                    <td className="text-right">
                      <AuButton variant="ghost" size="sm" onClick={() => setSheetOpen(true)}>
                        Open details
                      </AuButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AuTable>
          </AuCard>
        )}

        <AuModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="New item"
          footer={
            <div className="flex justify-end gap-2">
              <AuButton variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </AuButton>
              <AuButton variant="primary" onClick={() => setModalOpen(false)}>
                Create
              </AuButton>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <AuInput placeholder="Item name" />
            <AuInput placeholder="Owner" />
          </div>
        </AuModal>

        <AuSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Onboarding checklist"
          meta="inv-1042"
        >
          <AuSheetRow label="Owner">Jane</AuSheetRow>
          <AuSheetRow label="Status">Live</AuSheetRow>
          <AuSheetRow label="Plan">{plan === "pro" ? "Pro" : "Free"}</AuSheetRow>
        </AuSheet>
      </div>
    </main>
  )
}
