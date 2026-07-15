"use client"

import * as Collapsible from "@radix-ui/react-collapsible"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useBrand } from "@/app/auis/_data/BrandProvider"
import { AuLogo } from "@/components/ui/AuLogo"
import { Icon } from "@/components/ui/Icon"
import { SidebarSearch } from "../styleguide/_SidebarSearch"
import ThemeToggle from "../styleguide/ThemeToggle"
import { uxFlowNavigation } from "./navigation"

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function hrefPath(href: string) {
  return href.split("#")[0]
}

export default function UxFlowLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const brand = useBrand()

  return (
    <div className="flex min-h-screen bg-canvas text-fg-primary">
      <aside className="au-sg-sidebar fixed left-0 top-0 flex h-screen w-64 flex-col gap-8 overflow-y-auto border-r border-subtle p-6">
        <Link
          href="/auis/ux-flow"
          aria-label="UX Flows — back to index"
          className="inline-flex flex-col items-start text-fg-primary no-underline"
        >
          <AuLogo variant="wordmark" height={22} brand={brand} />
          <span className="au-sg-sidebar__subtitle">UX Flows | 2026</span>
        </Link>

        <SidebarSearch sections={uxFlowNavigation} />

        <nav className="flex flex-col gap-3">
          {uxFlowNavigation.map((section, index) => {
            const previousGroup = index > 0 ? uxFlowNavigation[index - 1].group : undefined
            const showGroup = Boolean(section.group && section.group !== previousGroup)
            const activeSection = section.items.some(
              (item) =>
                pathname === hrefPath(item.href) ||
                item.children?.some((child) => pathname === hrefPath(child.href)),
            )
            return (
              <div key={section.title} className="flex flex-col gap-3">
                {showGroup ? (
                  <h2 className="mt-3 flex items-center justify-between gap-2 font-semibold tracking-tight text-fg-primary">
                    <span>{section.group}</span>
                    <Icon name="expand_more" size={16} className="text-fg-tertiary" />
                  </h2>
                ) : null}
                <Collapsible.Root defaultOpen={activeSection || section.title === "Introduction"}>
                  <h3 className="au-eyebrow mb-2">
                    <Collapsible.Trigger className="group flex w-full items-center justify-between gap-2 text-left">
                      <span>{section.title}</span>
                      <Icon
                        name="expand_more"
                        size={16}
                        className="text-fg-tertiary transition-transform duration-au-fast group-data-[state=closed]:-rotate-90"
                      />
                    </Collapsible.Trigger>
                  </h3>
                  <Collapsible.Content className="au-sg-collapsible-content">
                    <ul className="flex flex-col gap-1">
                      {section.items.map((item) => {
                        const active = pathname === hrefPath(item.href)
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className={cx(
                                "block rounded-md px-3 py-2 text-sm no-underline",
                                active
                                  ? "bg-inverse text-fg-on-inverse"
                                  : "text-fg-secondary hover:bg-surface hover:text-fg-primary",
                              )}
                            >
                              {item.name}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </Collapsible.Content>
                </Collapsible.Root>
              </div>
            )
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2 text-xs leading-relaxed text-fg-tertiary">
          <Link
            href="/auis/styleguide"
            className="inline-flex items-center gap-1.5 text-fg-secondary no-underline hover:text-fg-primary"
          >
            <Icon name="palette" size={14} />
            Design system
          </Link>
          <span>Flows stay navigable, reviewable, and versioned with the code.</span>
        </div>
      </aside>

      <main className="relative ml-64 flex-1 overflow-auto">
        <div className="fixed right-6 top-5 z-50">
          <ThemeToggle />
        </div>
        {children}
      </main>
    </div>
  )
}
