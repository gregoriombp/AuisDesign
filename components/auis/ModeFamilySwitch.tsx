"use client"

import { Icon } from "@/components/ui/Icon"
import { useReviewStore } from "@/lib/auis-review/store"
import { useEditStore } from "@/lib/auis-edit/store"

/**
 * Troca rápida entre os dois modos Auis (Review ↔ Edit) direto na pílula
 * central — sem precisar abrir a bolota. Vive no canto esquerdo das duas
 * toolbars (ReviewToolbar / EditToolbar) como uma "categoria" própria, separada
 * do resto por uma divisória. Clicar no modo inativo liga ele; a exclusão mútua
 * dos providers (Edit.setActive desliga Review; o subscribe do EditModeProvider
 * desliga Edit quando Review liga) garante que nunca os dois ficam ativos.
 */
export function ModeFamilySwitch({ current }: { current: "review" | "edit" }) {
  const toggleReview = useReviewStore((s) => s.toggleActive)
  const toggleEdit = useEditStore((s) => s.toggleActive)

  const item = (
    mode: "review" | "edit",
    icon: string,
    label: string,
    onActivate: () => void
  ) => {
    const active = current === mode
    return (
      <button
        type="button"
        onClick={active ? undefined : onActivate}
        aria-pressed={active}
        aria-label={label}
        title={label}
        className={[
          "h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors",
          active
            ? "bg-(--bg-inverse) text-(--fg-on-inverse)"
            : "text-(--fg-secondary) hover:bg-(--bg-hover) hover:text-(--fg-primary)",
        ].join(" ")}
      >
        <Icon name={icon} size={16} fill={active ? 1 : 0} />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {item("review", "rate_review", "Modo Review", () => toggleReview())}
      {item("edit", "edit", "Modo edição", () => toggleEdit())}
    </div>
  )
}
