import Link from "next/link"
import { AuButton } from "@/components/ui/AuButton"

// Auis — styleguide landing (ZEROED).
// The origin product's showcase landing was intentionally not extracted.
// This is a neutral welcome; build your own system with the `auis-*` skills.
export default function StyleguideHome() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col justify-center px-8 py-24">
      <p className="text-sm uppercase tracking-wide opacity-60">Auis · Styleguide</p>
      <h1 className="mt-3 text-4xl font-light">Empty design system</h1>
      <p className="mt-4 text-lg opacity-80">
        This styleguide is empty on purpose — the origin product&apos;s catalog was
        not carried over. Start your own: run <code>auis-foundation</code> for the
        foundations (color, typography, spacing) and <code>auis-component</code> for
        each component — it creates the showcase and registers the navigation entry
        for you.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <AuButton asChild variant="primary" iconLeft="dashboard">
          <Link href="/auis/review-bridge">Review Bridge</Link>
        </AuButton>
        <AuButton asChild iconLeft="account_tree">
          <Link href="/auis/ux-flow">UX Flows</Link>
        </AuButton>
        <AuButton asChild variant="ghost" iconLeft="tune">
          <Link href="/auis/design-system-tweaks">Design System Tweaks</Link>
        </AuButton>
      </div>
    </div>
  )
}
