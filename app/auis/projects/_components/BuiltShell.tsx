"use client"

import * as React from "react"
import { AuDashboardLayout } from "@/components/ui/AuDashboardLayout"
import type { BreadcrumbsItems } from "@/components/ui/AuBreadcrumbsBar"

/**
 * Shell for the workbench's rebuilt screens: renders the content inside the
 * product shell (AuDashboardLayout) — in the central container, with the sidebar
 * and header around it, like any product page. `center` centers the content
 * vertically (wizard/choice screens); without it, the content flows from the top
 * (management screens).
 */
export function BuiltShell({
  breadcrumbs,
  center,
  children,
}: {
  breadcrumbs: BreadcrumbsItems
  center?: boolean
  children: React.ReactNode
}) {
  return (
    <AuDashboardLayout breadcrumbs={breadcrumbs}>
      {center ? (
        <div className="flex min-h-full items-center justify-center">{children}</div>
      ) : (
        children
      )}
    </AuDashboardLayout>
  )
}
