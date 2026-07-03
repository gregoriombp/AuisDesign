"use client";

import { usePathname } from "next/navigation";
import { AuSidebar } from "@/components/ui/AuSidebar";
import { AuHeader } from "@/components/ui/AuHeader";
import { AuCopilotDrawer } from "@/components/ui/AuCopilotDrawer";
import { AuBreadcrumbsBar, type BreadcrumbItem } from "@/components/ui/AuBreadcrumbsBar";
import { useCopilotDrawer } from "@/lib/copilot/store";

export function AuDashboardLayout({
  children,
  title,
  breadcrumbs,
  showDateSelector,
  mainClassName,
  floatingSidebar,
  breadcrumbInnerClassName,
}: {
  children: React.ReactNode;
  title?: string;
  breadcrumbs?: (string | BreadcrumbItem)[];
  showDateSelector?: boolean;
  mainClassName?: string;
  /** Sidebar floats over full-width content as a liquid-glass rail. */
  floatingSidebar?: boolean;
  /** Center/limit breadcrumb text to match a narrow main column (e.g. Agent Studio). */
  breadcrumbInnerClassName?: string;
}) {
  const isCopilotOpen = useCopilotDrawer((s) => s.open);
  const setIsCopilotOpen = useCopilotDrawer((s) => s.setOpen);
  const pathname = usePathname();
  const isInMemoryBase = pathname?.startsWith("/memory-base") ?? false;

  return (
    <div className="flex h-screen overflow-hidden bg-(--bg-surface) relative">
      {floatingSidebar ? (
        <div className="absolute inset-y-0 left-0 z-32">
          <AuSidebar floating />
        </div>
      ) : (
        <AuSidebar forcedCollapsed={isInMemoryBase} />
      )}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden relative">
        <div className="flex flex-1 min-w-0 overflow-hidden">
          {/* Floating content panel — mirrors the sidebar's container
              treatment so the surface tone shows around the edges. */}
          <div className="relative my-2 mr-2 flex flex-1 min-w-0 flex-col overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-raised)">
            <div className="absolute right-3 top-2 z-30">
              <AuHeader
                minimal
                isCopilotOpen={isCopilotOpen}
                onCopilotOpen={setIsCopilotOpen}
              />
            </div>
            {breadcrumbs && breadcrumbs.length > 0 && (
              <AuBreadcrumbsBar
                items={breadcrumbs}
                innerClassName={breadcrumbInnerClassName}
              />
            )}
            <main className={`flex-1 overflow-y-auto p-6 ${mainClassName ?? ""}`}>
              {title && (
                <h1 className=" font-heading font-bold text-text-primary mb-6">{title}</h1>
              )}
              {children}
            </main>
          </div>
          {/* Copilot — in-flow sibling that pushes the main content to the
              left when opened, instead of overlaying it. */}
          <div
            className="my-2 overflow-hidden rounded-xl border border-(--border-subtle) shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18)] transition-[width,margin] duration-300 ease-out shrink-0"
            style={{
              width: isCopilotOpen ? 405 : 0,
              marginRight: isCopilotOpen ? 8 : 0,
              borderWidth: isCopilotOpen ? 1 : 0,
              pointerEvents: isCopilotOpen ? "auto" : "none",
            }}
            aria-hidden={!isCopilotOpen}
          >
            <AuCopilotDrawer
              isOpen={isCopilotOpen}
              onClose={() => setIsCopilotOpen(false)}
              embedded
            />
          </div>
        </div>
      </div>
    </div>
  );
}
