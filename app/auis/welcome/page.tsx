import type { Metadata } from "next"
import { getBrand } from "@/app/auis/_data/brand"
import { WelcomeForm } from "./_components/WelcomeForm"

export const metadata: Metadata = {
  title: "Welcome",
  description: "Set up your brand to start building your design system.",
}

// Reads the runtime brand overlay to prefill an already-configured brand —
// render on demand so it reflects the current file, not a build-time snapshot.
export const dynamic = "force-dynamic"

export default async function AuisWelcome() {
  const brand = await getBrand()

  return (
    <main className="min-h-screen bg-(--bg-canvas) text-(--fg-primary)">
      <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-2">
          <p className="au-eyebrow">Product Builder Platform</p>
          <h1 className="text-3xl font-semibold tracking-tight m-0">
            Set up your brand
          </h1>
          <p className="text-base text-(--fg-secondary) m-0 leading-relaxed">
            Three things get your builder started: what your project is called,
            what it does, and the logo it wears. You can change all of them later.
          </p>
        </header>

        <WelcomeForm initialBrand={brand} />
      </div>
    </main>
  )
}
