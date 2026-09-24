import Link from "next/link"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuButton } from "@/components/ui/AuButton"
import { AuCard } from "@/components/ui/AuCard"
import { Icon } from "@/components/ui/Icon"
import { getBrand } from "@/app/auis/_data/brand"
import { findFirstProductPage } from "@/app/auis/_data/product"

export const metadata: Metadata = {
  title: "Your product",
  description:
    "Opens the product's first page, or explains how to create one.",
}

// A page can appear at any moment while the dev server runs — decide on every
// request, never from a build-time snapshot.
export const dynamic = "force-dynamic"

type Step = {
  icon: string
  title: string
  body: React.ReactNode
}

const steps: Step[] = [
  {
    icon: "web",
    title: "Ask your agent for the screen",
    body: (
      <>
        Run <code>/auis-new-page</code> in Claude Code, Codex or Cursor with a
        screenshot, a Figma link or a short brief. It composes the page from the
        design system’s <code>Au*</code> components and the current tokens.
      </>
    ),
  },
  {
    icon: "folder",
    title: "Any route outside the builder counts",
    body: (
      <>
        A page lives at <code>app/&lt;route&gt;/page.tsx</code>. Everything
        outside <code>app/auis</code> and <code>app/api</code> is your product,
        and the first route found becomes where the hub’s button lands.
      </>
    ),
  },
  {
    icon: "home",
    title: "Or take the root",
    body: (
      <>
        Today <code>app/page.tsx</code> only forwards to the hub. Replace it and{" "}
        <code>/</code> becomes your home.
      </>
    ),
  },
  {
    icon: "instant_mix",
    title: "Then register its states",
    body: (
      <>
        Run <code>/auis-update-states</code> so State Mode shows the new screen
        in every state.
      </>
    ),
  },
]

export default async function AuisProductEntry() {
  const page = findFirstProductPage()
  if (page) redirect(page.href)

  const brand = await getBrand()

  return (
    <main className="min-h-screen bg-(--bg-canvas) text-(--fg-primary)">
      <div className="max-w-3xl mx-auto px-8 py-16">
        <Link href="/auis" className="no-underline">
          <AuButton variant="ghost" size="sm" iconLeft="arrow_back">
            Auis
          </AuButton>
        </Link>

        <header className="mt-6 mb-10">
          <p className="au-eyebrow mb-3">{brand.name}</p>
          <h1 className="text-5xl font-semibold tracking-tight mb-3">
            No page to open yet
          </h1>
          <p className="text-lg text-(--fg-secondary) max-w-2xl">
            Auis ships with the builder only.{" "}
            {brand.configured
              ? `${brand.name} has no page of its own so far`
              : "Your product has no page of its own so far"}
            , so there is nothing to open. Create the first one and the hub
            will take you there.
          </p>
        </header>

        <ol className="flex flex-col gap-4 m-0 p-0 list-none">
          {steps.map((step, i) => (
            <li key={step.title}>
              <AuCard
                className="p-5 flex items-start gap-4 bg-(--bg-raised)"
                style={{ borderRadius: "var(--radius-2xl)" }}
              >
                <span
                  className="inline-flex items-center justify-center rounded-md bg-(--bg-surface) shrink-0"
                  style={{ width: 40, height: 40 }}
                >
                  <Icon name={step.icon} size={22} />
                </span>
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold m-0">
                    <span className="text-(--fg-tertiary) mr-2">{i + 1}</span>
                    {step.title}
                  </h2>
                  <p className="text-sm text-(--fg-secondary) leading-relaxed m-0">
                    {step.body}
                  </p>
                </div>
              </AuCard>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex items-center gap-3">
          <Link href="/auis/styleguide" className="no-underline">
            <AuButton variant="primary" iconRight="arrow_forward">
              Browse the design system
            </AuButton>
          </Link>
          <Link href="/auis" className="no-underline">
            <AuButton variant="secondary">Back to Auis</AuButton>
          </Link>
        </div>
      </div>
    </main>
  )
}
