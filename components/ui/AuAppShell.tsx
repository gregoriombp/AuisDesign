import * as React from "react"
import { cn } from "@/lib/utils"

export type AuAppShellProps = React.HTMLAttributes<HTMLDivElement> & {
  /** The persistent left column. Usually an `AuSideNav` plus a header/footer. */
  sidebar: React.ReactNode
  /** Optional strip pinned to the top-right of the content area. */
  topBar?: React.ReactNode
}

/**
 * The product's application shell: a gray canvas with one white panel floating
 * on it, split into a fixed sidebar and a scrolling content area.
 *
 * Auis ships no shell of its own (see `docs/component-map.md`, Layer B) — this
 * is the product's, and it is the reason `--bg-canvas` is gray: the panel reads
 * as raised BECAUSE the ground behind it is not white.
 *
 * Layout only. It owns no navigation, no branding and no content — every one of
 * those arrives through a slot, so a screen can swap them without forking the
 * shell.
 */
export function AuAppShell({
  sidebar,
  topBar,
  children,
  className,
  ...rest
}: AuAppShellProps) {
  return (
    <div
      className={cn("flex h-screen w-full flex-col bg-(--bg-canvas) p-6", className)}
      {...rest}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-raised) shadow-md">
        <aside className="flex w-72 shrink-0 flex-col border-r border-(--border-subtle)">
          {sidebar}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          {topBar ? (
            <div className="flex shrink-0 items-center justify-end gap-2 px-8 pt-6">
              {topBar}
            </div>
          ) : null}
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  )
}
