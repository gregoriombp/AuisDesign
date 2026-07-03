import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AuButton } from "@/components/ui/AuButton"
import { Icon } from "@/components/ui/Icon"
import { FlowDiagram } from "../../styleguide/ux-flows/_components/flow-editor"
import { FLOW_META, getFlowMeta } from "../_data/flow-meta"
import { getFlowData } from "./flow-data"

export function generateStaticParams() {
  return FLOW_META.map((f) => ({ slug: f.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const meta = getFlowMeta(slug)
  return { title: meta ? `${meta.title} · UX Flow` : "UX Flow" }
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export default async function UxFlowViewer({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const meta = getFlowMeta(slug)
  const data = getFlowData(slug)
  if (!meta || !data) notFound()

  return (
    <main className="min-h-screen bg-(--bg-canvas) text-(--fg-primary)">
      <div className="max-w-[1400px] mx-auto px-8 py-12">
        <Link href="/auis/ux-flow" className="no-underline">
          <AuButton variant="ghost" size="sm" iconLeft="arrow_back">
            Fluxos
          </AuButton>
        </Link>

        <header className="mt-6 mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="au-eyebrow mb-2">{meta.group}</p>
            <h1 className="text-4xl font-semibold tracking-tight">{meta.title}</h1>
            <p className="mt-2 text-(--fg-secondary) max-w-2xl leading-relaxed">
              {meta.description}
            </p>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-(--fg-tertiary)">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="web_asset" size={13} />
                {meta.screens} telas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="schedule" size={13} />
                Atualizado em {formatDate(meta.updatedAt)}
              </span>
            </div>
          </div>
          <Link
            href={`/auis/styleguide/ux-flows/${slug}`}
            className="no-underline shrink-0"
          >
            <AuButton variant="ghost" size="sm" iconRight="open_in_new">
              Ver no styleguide
            </AuButton>
          </Link>
        </header>

        <FlowDiagram
          flow={slug}
          nodes={data.nodes}
          edges={data.edges}
          height={meta.height}
        />
      </div>
    </main>
  )
}
