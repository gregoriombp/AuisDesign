import Link from "next/link"
import type { Metadata } from "next"
import { AuButton } from "@/components/ui/AuButton"
import { AuCard } from "@/components/ui/AuCard"
import { AuPill } from "@/components/ui/AuPill"
import { AuStatCard } from "@/components/ui/AuStatCard"
import {
  AuEmpty,
  AuEmptyHeader,
  AuEmptyMedia,
  AuEmptyTitle,
  AuEmptyDescription,
} from "@/components/ui/AuEmpty"
import { Icon } from "@/components/ui/Icon"
import { PROJECTS } from "./_data/projects"

export const metadata: Metadata = {
  title: "Projetos",
  description:
    "Flows importados do Figma — navegue tela por tela e reconstrua no design system.",
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export default function ProjectsIndex() {
  const totalScreens = PROJECTS.reduce((sum, p) => sum + p.screens.length, 0)

  return (
    <main className="min-h-screen bg-(--bg-canvas) text-(--fg-primary)">
      <div className="max-w-5xl mx-auto px-8 py-16">
        <Link href="/auis" className="no-underline">
          <AuButton variant="ghost" size="sm" iconLeft="arrow_back">
            Auis
          </AuButton>
        </Link>

        <header className="mt-6 mb-10">
          <p className="au-eyebrow mb-3">Projetos</p>
          <h1 className="text-5xl font-semibold tracking-tight mb-3">Projetos</h1>
          <p className="text-lg text-(--fg-secondary) max-w-2xl">
            Flows importados do Figma viram projetos navegáveis. Abra um pra ver
            tela por tela, pedir uma atualização pro design system atual ou mandar
            construir a página no repo.
          </p>
        </header>

        {PROJECTS.length === 0 ? (
          <AuEmpty>
            <AuEmptyHeader>
              <AuEmptyMedia variant="icon">
                <Icon name="dashboard_customize" size={28} />
              </AuEmptyMedia>
              <AuEmptyTitle>Nenhum projeto importado ainda</AuEmptyTitle>
              <AuEmptyDescription>
                Rode o skill <code>auis-import-figma-flow</code> com a URL de
                um flow do Figma pra trazer as telas pra cá.
              </AuEmptyDescription>
            </AuEmptyHeader>
          </AuEmpty>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
              <AuStatCard
                icon="dashboard"
                label="Projetos"
                value={PROJECTS.length}
              />
              <AuStatCard
                icon="web_asset"
                label="Telas importadas"
                value={totalScreens}
              />
              <AuStatCard
                icon="design_services"
                label="Fonte"
                value="Figma"
                hint="Screenshots renderizados via Figma MCP"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PROJECTS.map((p) => (
                <AuCard
                  key={p.slug}
                  interactive
                  className="p-6 flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between">
                    <span
                      className="inline-flex items-center justify-center rounded-md bg-(--bg-surface)"
                      style={{ width: 44, height: 44 }}
                    >
                      <Icon name="dashboard" size={24} />
                    </span>
                    <AuPill variant="neutral">{p.screens.length} telas</AuPill>
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-xl font-semibold">{p.title}</h3>
                    <p className="text-sm text-(--fg-secondary) leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                  <div className="mt-auto pt-2 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-(--fg-tertiary)">
                      <Icon name="schedule" size={13} />
                      Importado em {formatDate(p.importedAt)}
                    </span>
                    <Link
                      href={`/auis/projects/${p.slug}`}
                      className="no-underline"
                    >
                      <AuButton variant="primary" iconRight="arrow_forward">
                        Abrir
                      </AuButton>
                    </Link>
                  </div>
                </AuCard>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
