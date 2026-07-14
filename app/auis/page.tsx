import Link from "next/link"
import { AuCard } from "@/components/ui/AuCard"
import { AuPill } from "@/components/ui/AuPill"
import { AuButton } from "@/components/ui/AuButton"
import { AuLogo } from "@/components/ui/AuLogo"
import { Icon } from "@/components/ui/Icon"

type HubSection = {
  title: string
  description: string
  icon: string
  href: string
  status: "ready" | "soon"
}

const sections: HubSection[] = [
  {
    title: "Projects",
    description:
      "Flows imported from Figma — browse screen by screen, restyle them with the design system and have them built in the repo.",
    icon: "folder_open",
    href: "/auis/projects",
    status: "ready",
  },
  {
    title: "Review Bridge",
    description:
      "Everything waiting on a decision — Review Mode comments and UX Flow suggestions in a single panel.",
    icon: "rate_review",
    href: "/auis/review-bridge",
    status: "ready",
  },
  {
    title: "Styleguide",
    description:
      "Tokens, foundations and Au* components — the design system's source of truth.",
    icon: "palette",
    href: "/auis/styleguide",
    status: "ready",
  },
  {
    title: "Design System Tweaks",
    description:
      "Tune foundations visually, check the impact on components and export a token patch.",
    icon: "tune",
    href: "/auis/design-system-tweaks",
    status: "ready",
  },
  {
    title: "UX Flow",
    description:
      "Connect pages into navigable flows, Figma-prototype style.",
    icon: "account_tree",
    href: "/auis/ux-flow",
    status: "ready",
  },
]

export default function AuisHub() {
  return (
    <main className="min-h-screen bg-(--bg-canvas) text-(--fg-primary)">
      <div className="max-w-5xl mx-auto px-8 py-16">
        <header className="mb-12">
          <p className="au-eyebrow mb-3">Product Builder Platform</p>
          <h1 className="text-5xl font-semibold tracking-tight mb-3">
            Auis
          </h1>
          <p className="text-lg text-(--fg-secondary) max-w-2xl">
            Build pages and flows straight in code, reusing the design system —
            without going through Figma.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="text-xl font-semibold tracking-tight mb-3">Your projects</h2>
          <AuCard
            interactive
            className="p-6 flex flex-col gap-4 border-transparent"
            style={{
              borderRadius: "var(--radius-2xl)",
              background: "var(--bg-inverse)",
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <span
                  className="inline-flex items-center justify-center rounded-md bg-white/10"
                  style={{ width: 52, height: 52 }}
                >
                  <AuLogo
                    variant="mark"
                    height={30}
                    style={{ color: "#ffffff" }}
                  />
                </span>
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-semibold tracking-tight text-(--fg-on-inverse)">
                    Auis
                  </h2>
                  <p className="text-sm text-white/70 leading-relaxed max-w-xl">
                    Agent-powered sales platform — open the product to explore the
                    dashboard, conversations, channels and settings.
                  </p>
                </div>
              </div>
              <AuPill variant="live">Active</AuPill>
            </div>
            <div className="mt-2">
              <Link href="/auis/login" className="no-underline">
                <AuButton
                  variant="primary"
                  iconRight="arrow_forward"
                  style={{ background: "var(--au-white)", color: "var(--au-gray-1200)" }}
                >
                  Open project
                </AuButton>
              </Link>
            </div>
          </AuCard>
        </section>

        <h2 className="text-xl font-semibold tracking-tight mb-3">
          Auis tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((s) => {
            const ready = s.status === "ready"
            return (
              <AuCard
                key={s.title}
                interactive={ready}
                className="p-6 flex flex-col gap-4 bg-(--bg-raised)"
                style={{ borderRadius: "var(--radius-2xl)" }}
              >
                <div className="flex items-start justify-between">
                  <span
                    className="inline-flex items-center justify-center rounded-md bg-(--bg-surface)"
                    style={{ width: 44, height: 44 }}
                  >
                    <Icon name={s.icon} size={24} />
                  </span>
                  {!ready && <AuPill variant="draft">Coming soon</AuPill>}
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-semibold">{s.title}</h2>
                  <p className="text-sm text-(--fg-secondary) leading-relaxed">
                    {s.description}
                  </p>
                </div>
                <div className="mt-auto pt-2">
                  {ready ? (
                    <Link href={s.href} className="no-underline">
                      <AuButton variant="primary" iconRight="arrow_forward">
                        Open
                      </AuButton>
                    </Link>
                  ) : (
                    <AuButton variant="ghost" disabled iconRight="lock">
                      Unavailable
                    </AuButton>
                  )}
                </div>
              </AuCard>
            )
          })}
        </div>
      </div>
    </main>
  )
}
