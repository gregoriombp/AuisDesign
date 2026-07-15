"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import * as Collapsible from "@radix-ui/react-collapsible"
import { navigation } from "./navigation"
import ThemeToggle from "./ThemeToggle"
import { AuLogo } from "@/components/ui/AuLogo"
import { Icon } from "@/components/ui/Icon"
import { SidebarSearch } from "./_SidebarSearch"
import { useBrand } from "@/app/auis/_data/BrandProvider"

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function hrefPath(href: string) {
  return href.split("#")[0]
}

export default function StyleguideLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const brand = useBrand()

  return (
    <div className="flex min-h-screen bg-(--bg-canvas) text-(--fg-primary)">
      <aside className="au-sg-sidebar w-64 border-r border-(--border-subtle) p-6 flex flex-col gap-8 fixed top-0 left-0 h-screen overflow-y-auto">
        <Link
          href="/auis/styleguide"
          aria-label="Auis Design System — back to index"
          className="inline-flex flex-col items-start no-underline"
          style={{ color: "var(--fg-primary)" }}
        >
          <AuLogo variant="wordmark" height={22} brand={brand} />
          <span className="au-sg-sidebar__subtitle">Design System | 2026</span>
        </Link>

        <SidebarSearch />

        <nav className="flex flex-col gap-3">
          {navigation.map((section, i) => {
            const prevGroup = i > 0 ? navigation[i - 1].group : undefined
            const showGroupHeading = !!section.group && section.group !== prevGroup
            const sectionActive = section.items.some(
              (item) =>
                pathname === hrefPath(item.href) ||
                !!item.children?.some((child) => pathname === hrefPath(child.href)),
            )
            return (
            <div key={section.title} className="flex flex-col gap-3">
              {showGroupHeading && (
                <h2 className="m-0 mt-3 mb-0.5 px-0 flex items-center justify-between gap-2 font-heading text-[15px] font-semibold tracking-tight text-(--fg-primary)">
                  <span>{section.group}</span>
                  <Icon name="expand_more" size={16} className="text-(--fg-tertiary)" />
                </h2>
              )}
            <Collapsible.Root defaultOpen={sectionActive}>
              <h3 className="au-eyebrow m-0 mb-2">
                <Collapsible.Trigger className="group flex w-full items-center justify-between gap-2 text-left">
                  <span>{section.title}</span>
                  <Icon
                    name="expand_more"
                    size={16}
                    className="text-(--fg-tertiary) transition-transform duration-150 group-data-[state=closed]:-rotate-90"
                  />
                </Collapsible.Trigger>
              </h3>
              <Collapsible.Content className="au-sg-collapsible-content">
                <ul className="flex flex-col gap-1">
                  {section.items.length === 0 && (
                    <li className="text-xs text-(--fg-tertiary) italic px-3 py-2">
                      — coming soon —
                    </li>
                  )}
                  {section.items.map((item) => {
                    const itemPath = hrefPath(item.href)
                    const active =
                      pathname === itemPath ||
                      !!item.children?.some((child) => pathname === hrefPath(child.href))
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "block px-3 py-2 rounded-md text-sm no-underline transition-colors duration-150",
                            active
                              ? "bg-(--bg-inverse) text-(--fg-on-inverse)"
                              : "text-(--fg-secondary) hover:bg-(--bg-surface) hover:text-(--fg-primary)"
                          )}
                        >
                          {item.name}
                        </Link>
                        {item.children && item.children.length > 0 ? (
                          <ul className="mt-1 mb-1 ml-3 flex flex-col gap-0.5 border-l border-(--border-subtle) pl-2">
                            {item.children.map((child) => {
                              const childActive = pathname === hrefPath(child.href)
                              return (
                                <li key={child.href}>
                                  <Link
                                    href={child.href}
                                    className={cn(
                                      "block rounded-sm px-2 py-1.5 text-[13px] no-underline transition-colors duration-150",
                                      childActive
                                        ? "bg-(--bg-surface) text-(--fg-primary)"
                                        : "text-(--fg-tertiary) hover:bg-(--bg-surface) hover:text-(--fg-primary)"
                                    )}
                                  >
                                    {child.name}
                                  </Link>
                                </li>
                              )
                            })}
                          </ul>
                        ) : null}
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

        <div className="mt-auto text-xs text-(--fg-tertiary) leading-relaxed">
          Auis Design System
          <br />
          Geist · Geist Mono
        </div>
      </aside>

      <main className="flex-1 ml-64 overflow-auto relative">
        <div className="fixed top-5 right-6 z-50">
          <ThemeToggle />
        </div>
        {children}
      </main>
    </div>
  )
}
