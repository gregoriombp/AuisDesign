"use client"

import * as React from "react"
import Link from "next/link"
import { AuButton } from "@/components/ui/AuButton"
import { Icon } from "@/components/ui/Icon"
import { CommentsPanel } from "./_components/CommentsPanel"
import { SuggestionsPanel } from "./_components/SuggestionsPanel"

type Category = "comments" | "suggestions"

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: "comments", label: "Comentários", icon: "forum" },
  { id: "suggestions", label: "Sugestões de flow", icon: "lightbulb" },
]

export default function ReviewBridgePage() {
  const [category, setCategory] = React.useState<Category>("comments")

  return (
    <main className="min-h-screen bg-(--bg-canvas) text-(--fg-primary)">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <Link href="/auis" className="no-underline">
          <AuButton variant="ghost" size="sm" iconLeft="arrow_back">
            Auis
          </AuButton>
        </Link>

        <header className="mt-6 mb-8">
          <p className="au-eyebrow mb-3">Review Bridge</p>
          <h1 className="text-5xl font-semibold tracking-tight mb-3">Pendências</h1>
          <p className="text-lg text-(--fg-secondary) max-w-2xl">
            Tudo que precisa de decisão num só lugar: comentários do Review Mode e
            sugestões de edição dos UX Flows. Aprove, rejeite ou descarte.
          </p>
        </header>

        <div className="mb-8 inline-flex items-center gap-1 p-1 rounded-full bg-(--bg-muted) text-sm font-medium">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={[
                "px-4 py-1.5 rounded-full transition-colors inline-flex items-center gap-2",
                category === c.id
                  ? "bg-(--bg-raised) text-(--fg-primary) shadow-sm"
                  : "text-(--fg-secondary) hover:text-(--fg-primary)",
              ].join(" ")}
            >
              <Icon name={c.icon} size={16} />
              {c.label}
            </button>
          ))}
        </div>

        {category === "comments" ? <CommentsPanel /> : <SuggestionsPanel />}
      </div>
    </main>
  )
}
