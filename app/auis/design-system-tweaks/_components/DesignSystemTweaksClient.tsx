"use client"

import Link from "next/link"
import * as React from "react"
import { AuAlert } from "@/components/ui/AuAlert"
import { AuButton } from "@/components/ui/AuButton"
import { AuCard } from "@/components/ui/AuCard"
import { AuCheckbox } from "@/components/ui/AuCheckbox"
import { AuField, AuInput } from "@/components/ui/AuInput"
import { AuPill } from "@/components/ui/AuPill"
import { AuProgress } from "@/components/ui/AuProgress"
import { AuSlider } from "@/components/ui/AuSlider"
import { AuTable } from "@/components/ui/AuTable"
import { AuTabs } from "@/components/ui/AuTabs"
import { AuToggleRow } from "@/components/ui/AuToggle"
import { Icon } from "@/components/ui/Icon"
import {
  buildFoundationTweaksCss,
  countFoundationTweakChanges,
  createDefaultFoundationTweakValues,
  FOUNDATION_TWEAK_CATEGORIES,
  FOUNDATION_TWEAK_CONTROLS,
  FOUNDATION_TWEAK_DRAFT_STORAGE_KEY,
  FOUNDATION_TWEAK_STORAGE_KEY,
  FOUNDATION_TWEAK_STYLE_ID,
  type FoundationTweakCategory,
  type FoundationTweakControl,
  type FoundationTweakDraft,
  type FoundationTweakMode,
  type FoundationTweakStore,
  type FoundationTweakValueMap,
  mergeFoundationTweakValues,
} from "@/lib/auis/foundation-tweaks"

const modeTabs = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
]

const categoryTabs = FOUNDATION_TWEAK_CATEGORIES.map((category) => ({
  value: category.value,
  label: category.label,
  count: FOUNDATION_TWEAK_CONTROLS.filter(
    (control) => control.category === category.value,
  ).length,
}))

type PreviewSurface = "product" | "forms" | "data" | "chrome"

const previewTabs = [
  { value: "product", label: "Produto" },
  { value: "forms", label: "Form" },
  { value: "data", label: "Dados" },
  { value: "chrome", label: "Chrome" },
]

const DRAFT_LIMIT = 12

function readStoredTweaks(): FoundationTweakValueMap {
  try {
    const raw = window.localStorage.getItem(FOUNDATION_TWEAK_STORAGE_KEY)
    if (!raw) return createDefaultFoundationTweakValues()
    return mergeFoundationTweakValues(JSON.parse(raw))
  } catch {
    return createDefaultFoundationTweakValues()
  }
}

function readStoredDrafts(): FoundationTweakDraft[] {
  try {
    const raw = window.localStorage.getItem(FOUNDATION_TWEAK_DRAFT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .flatMap((draft): FoundationTweakDraft[] => {
        if (!draft || typeof draft !== "object") return []
        const item = draft as Partial<FoundationTweakDraft>
        if (
          typeof item.id !== "string" ||
          typeof item.name !== "string" ||
          typeof item.createdAt !== "string" ||
          typeof item.updatedAt !== "string"
        ) {
          return []
        }

        return [
          {
            id: item.id,
            name: item.name,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            values: mergeFoundationTweakValues(item.values),
          },
        ]
      })
      .slice(0, DRAFT_LIMIT)
  } catch {
    return []
  }
}

function storeDrafts(drafts: FoundationTweakDraft[]) {
  window.localStorage.setItem(
    FOUNDATION_TWEAK_DRAFT_STORAGE_KEY,
    JSON.stringify(drafts.slice(0, DRAFT_LIMIT)),
  )
}

function createDraftId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }
  return `draft-${Date.now()}`
}

function formatDraftDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sem data"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function applyTweaksStyle(values: FoundationTweakValueMap) {
  const css = buildFoundationTweaksCss(values)
  let tag = document.getElementById(FOUNDATION_TWEAK_STYLE_ID)

  if (!tag) {
    tag = document.createElement("style")
    tag.id = FOUNDATION_TWEAK_STYLE_ID
    document.head.appendChild(tag)
  }

  tag.textContent = css
}

function removeTweaksStyle() {
  document.getElementById(FOUNDATION_TWEAK_STYLE_ID)?.remove()
}

function numericValue(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function clampValue(value: number, control: FoundationTweakControl): number {
  const min = control.min ?? value
  const max = control.max ?? value
  return Math.min(max, Math.max(min, value))
}

function formatNumberValue(value: number, control: FoundationTweakControl) {
  const unit = control.unit ?? ""
  const clamped = clampValue(value, control)
  const normalized = Number.isInteger(clamped)
    ? String(clamped)
    : String(Number(clamped.toFixed(3)))
  return `${normalized}${unit}`
}

function safeColorValue(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

function storeTweaks(values: FoundationTweakValueMap) {
  const store: FoundationTweakStore = {
    version: 1,
    values,
  }
  window.localStorage.setItem(FOUNDATION_TWEAK_STORAGE_KEY, JSON.stringify(store))
}

export function DesignSystemTweaksClient() {
  const [hydrated, setHydrated] = React.useState(false)
  const [mode, setMode] = React.useState<FoundationTweakMode>("light")
  const [category, setCategory] =
    React.useState<FoundationTweakCategory>("color")
  const [values, setValues] = React.useState<FoundationTweakValueMap>(() =>
    createDefaultFoundationTweakValues(),
  )
  const [previewSurface, setPreviewSurface] =
    React.useState<PreviewSurface>("product")
  const [drafts, setDrafts] = React.useState<FoundationTweakDraft[]>([])
  const [activeDraftId, setActiveDraftId] = React.useState<string | null>(null)
  const [draftName, setDraftName] = React.useState("Exploração sem título")
  const [draftStatus, setDraftStatus] = React.useState<
    "idle" | "saved" | "loaded" | "deleted"
  >("idle")
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    const stored = readStoredTweaks()
    setValues(stored)
    setDrafts(readStoredDrafts())
    applyTweaksStyle(stored)
    setHydrated(true)
  }, [])

  React.useEffect(() => {
    if (!hydrated) return

    const changes = countFoundationTweakChanges(values)
    if (changes === 0) {
      window.localStorage.removeItem(FOUNDATION_TWEAK_STORAGE_KEY)
      removeTweaksStyle()
      return
    }

    storeTweaks(values)
    applyTweaksStyle(values)
  }, [hydrated, values])

  const changeCount = countFoundationTweakChanges(values)
  const visibleControls = FOUNDATION_TWEAK_CONTROLS.filter(
    (control) => control.category === category,
  )
  const changedCss = buildFoundationTweaksCss(values, { changedOnly: true })

  function updateValue(control: FoundationTweakControl, next: string) {
    setCopied(false)
    setDraftStatus("idle")
    setValues((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        [control.token]: next,
      },
    }))
  }

  function resetAll() {
    const defaults = createDefaultFoundationTweakValues()
    setValues(defaults)
    window.localStorage.removeItem(FOUNDATION_TWEAK_STORAGE_KEY)
    removeTweaksStyle()
    setActiveDraftId(null)
    setDraftStatus("idle")
    setCopied(false)
  }

  function saveDraft(options: { forceNew?: boolean } = {}) {
    const name = draftName.trim() || "Exploração sem título"
    const now = new Date().toISOString()
    const id = options.forceNew || !activeDraftId ? createDraftId() : activeDraftId
    const nextDraft: FoundationTweakDraft = {
      id,
      name,
      createdAt:
        drafts.find((draft) => draft.id === id)?.createdAt ??
        now,
      updatedAt: now,
      values: mergeFoundationTweakValues(values),
    }

    setDrafts((current) => {
      const next = [
        nextDraft,
        ...current.filter((draft) => draft.id !== id),
      ].slice(0, DRAFT_LIMIT)
      storeDrafts(next)
      return next
    })
    setActiveDraftId(id)
    setDraftName(name)
    setDraftStatus("saved")
  }

  function loadDraft(draft: FoundationTweakDraft) {
    const nextValues = mergeFoundationTweakValues(draft.values)
    setValues(nextValues)
    applyTweaksStyle(nextValues)
    setActiveDraftId(draft.id)
    setDraftName(draft.name)
    setDraftStatus("loaded")
    setCopied(false)
  }

  function deleteDraft(id: string) {
    setDrafts((current) => {
      const next = current.filter((draft) => draft.id !== id)
      storeDrafts(next)
      return next
    })
    if (activeDraftId === id) {
      setActiveDraftId(null)
      setDraftStatus("deleted")
    }
  }

  async function copyPatch() {
    const patch = changedCss || "/* Sem alterações em relação a globals.css. */"
    await window.navigator.clipboard.writeText(patch)
    setCopied(true)
  }

  return (
    <main className="min-h-screen bg-(--bg-canvas) text-(--fg-primary)">
      <div
        className="mx-auto px-8 py-10"
        style={{ maxWidth: "var(--content-wide)" }}
      >
        <header className="mb-8 flex items-start justify-between gap-6">
          <div className="min-w-0">
            <Link href="/auis" className="no-underline">
              <AuButton variant="ghost" iconLeft="arrow_back" size="sm">
                Auis
              </AuButton>
            </Link>
            <div className="mt-6 flex items-center gap-3">
              <span
                className="inline-flex items-center justify-center rounded-md bg-(--bg-surface) text-(--fg-primary)"
                style={{
                  width: "var(--space-12)",
                  height: "var(--space-12)",
                }}
              >
                <Icon name="tune" size={26} />
              </span>
              <div>
                <p className="au-eyebrow mb-2">Foundations Lab</p>
                <h1 className="m-0">Design System Tweaks</h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-(--body-lg-size) leading-relaxed text-(--fg-secondary)">
              Ajuste tokens existentes, valide o impacto em componentes reais e
              exporte um patch para consolidar no design system.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <AuPill variant={changeCount > 0 ? "warning" : "neutral"}>
              {changeCount} alterações
            </AuPill>
            <AuPill variant="beta">Preview local</AuPill>
          </div>
        </header>

        <AuAlert
          variant="info"
          title="Os overrides ficam no navegador."
          className="mb-6"
        >
          Tokens novos continuam fora desta tela; o patch gerado altera apenas
          variáveis já existentes em <code className="mono">globals.css</code>.
        </AuAlert>

        <div className="grid grid-cols-3 gap-6 items-start">
          <section className="col-span-2 flex flex-col gap-6">
            <AuCard
              className="p-5 bg-(--bg-raised)"
              style={{ borderRadius: "var(--radius-2xl)" }}
            >
              <div className="flex items-start justify-between gap-6 mb-5">
                <div>
                  <p className="au-eyebrow mb-2">Edição</p>
                  <h2 className="m-0 text-(--h4-size)">
                    Tokens por foundation
                  </h2>
                </div>
                <AuTabs
                  items={modeTabs}
                  value={mode}
                  onChange={(next) => setMode(next as FoundationTweakMode)}
                  variant="segmented"
                  aria-label="Modo"
                />
              </div>

              <AuTabs
                items={categoryTabs}
                value={category}
                onChange={(next) =>
                  setCategory(next as FoundationTweakCategory)
                }
                variant="standalone"
                aria-label="Foundation"
                className="mb-5"
              />

              <div className="grid grid-cols-2 gap-4">
                {visibleControls.map((control) => (
                  <TokenControl
                    key={`${mode}-${control.token}`}
                    control={control}
                    mode={mode}
                    value={values[mode][control.token]}
                    onChange={(next) => updateValue(control, next)}
                  />
                ))}
              </div>
            </AuCard>

            <PreviewPanel
              mode={mode}
              surface={previewSurface}
              onSurfaceChange={setPreviewSurface}
            />
          </section>

          <aside className="col-span-1 sticky top-8 flex flex-col gap-6">
            <AuCard
              className="p-5 bg-(--bg-raised)"
              style={{ borderRadius: "var(--radius-2xl)" }}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="au-eyebrow mb-2">Rascunhos</p>
                  <h2 className="m-0 text-(--h5-size)">Explorações salvas</h2>
                </div>
                <Icon name="bookmark" size={22} />
              </div>
              <AuField label="Nome do rascunho">
                <AuInput
                  dense
                  value={draftName}
                  onChange={(event) => {
                    setDraftName(event.target.value)
                    setDraftStatus("idle")
                  }}
                />
              </AuField>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <AuButton
                  variant="primary"
                  iconLeft="save"
                  onClick={() => saveDraft()}
                >
                  Salvar
                </AuButton>
                <AuButton
                  variant="secondary"
                  iconLeft="add"
                  onClick={() => saveDraft({ forceNew: true })}
                >
                  Novo
                </AuButton>
              </div>
              {draftStatus !== "idle" && (
                <p className="mt-3 text-sm text-(--fg-secondary)">
                  {draftStatus === "saved" && "Rascunho salvo."}
                  {draftStatus === "loaded" && "Rascunho carregado."}
                  {draftStatus === "deleted" && "Rascunho apagado."}
                </p>
              )}
              <div className="mt-5 flex flex-col gap-2">
                {drafts.length === 0 ? (
                  <div className="rounded-lg border border-(--border-subtle) bg-(--bg-surface) p-4 text-sm text-(--fg-secondary)">
                    Nenhum rascunho salvo ainda.
                  </div>
                ) : (
                  drafts.map((draft) => {
                    const selected = draft.id === activeDraftId
                    const draftChanges = countFoundationTweakChanges(draft.values)
                    return (
                      <div
                        key={draft.id}
                        className="rounded-lg border border-(--border-subtle) bg-(--bg-surface) p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => loadDraft(draft)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block truncate text-sm font-medium text-(--fg-primary)">
                              {draft.name}
                            </span>
                            <span className="mt-1 block text-xs text-(--fg-tertiary)">
                              {formatDraftDate(draft.updatedAt)} ·{" "}
                              {draftChanges} alterações
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Apagar ${draft.name}`}
                            onClick={() => deleteDraft(draft.id)}
                            className="inline-flex items-center justify-center rounded-md text-(--fg-tertiary) hover:text-(--fg-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring-focus)"
                            style={{
                              width: "var(--space-8)",
                              height: "var(--space-8)",
                            }}
                          >
                            <Icon name="delete" size={18} />
                          </button>
                        </div>
                        {selected && (
                          <div className="mt-2">
                            <AuPill variant="live">Em edição</AuPill>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </AuCard>

            <AuCard
              className="p-5 bg-(--bg-raised)"
              style={{ borderRadius: "var(--radius-2xl)" }}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="au-eyebrow mb-2">Patch</p>
                  <h2 className="m-0 text-(--h5-size)">CSS exportável</h2>
                </div>
                <Icon name="data_object" size={22} />
              </div>
              <pre className="mono text-xs whitespace-pre-wrap overflow-auto max-h-80 rounded-lg border border-(--border-subtle) bg-(--bg-surface) p-4 text-(--fg-secondary)">
                {changedCss || "/* Sem alterações em relação a globals.css. */"}
              </pre>
              <div className="mt-4 flex flex-col gap-3">
                <AuButton
                  variant="primary"
                  iconLeft={copied ? "check" : "content_copy"}
                  onClick={copyPatch}
                  disabled={changeCount === 0}
                  block
                >
                  {copied ? "Patch copiado" : "Copiar patch"}
                </AuButton>
                <AuButton
                  variant="secondary"
                  iconLeft="restart_alt"
                  onClick={resetAll}
                  disabled={changeCount === 0}
                  block
                >
                  Resetar tweaks
                </AuButton>
                <Link
                  href="/auis/styleguide"
                  className="no-underline block"
                >
                  <AuButton variant="ghost" iconRight="arrow_forward" block>
                    Ver styleguide
                  </AuButton>
                </Link>
              </div>
            </AuCard>

            <AuCard
              className="p-5 bg-(--bg-raised)"
              style={{ borderRadius: "var(--radius-2xl)" }}
            >
              <p className="au-eyebrow mb-3">Escopo</p>
              <div className="flex flex-col gap-3 text-sm text-(--fg-secondary)">
                <div className="flex items-start gap-3">
                  <Icon name="check_circle" size={18} />
                  <span>Preview global salvo neste navegador.</span>
                </div>
                <div className="flex items-start gap-3">
                  <Icon name="lock" size={18} />
                  <span>Sem criação automática de novos tokens.</span>
                </div>
                <div className="flex items-start gap-3">
                  <Icon name="terminal" size={18} />
                  <span>Patch enxuto, pronto para revisão no código.</span>
                </div>
              </div>
            </AuCard>
          </aside>
        </div>
      </div>
    </main>
  )
}

function TokenControl({
  control,
  mode,
  value,
  onChange,
}: {
  control: FoundationTweakControl
  mode: FoundationTweakMode
  value: string
  onChange: (value: string) => void
}) {
  const preview = <ControlInlinePreview control={control} value={value} />

  if (control.type === "choice") {
    return (
      <div className="rounded-lg border border-(--border-subtle) bg-(--bg-surface) p-4">
        <ControlHeader control={control} />
        {preview}
        <div className="mt-4 flex flex-wrap gap-2">
          {(control.choices ?? []).map((choice) => {
            const selected = choice.value === value
            return (
              <button
                key={choice.value}
                type="button"
                onClick={() => onChange(choice.value)}
                className={[
                  "rounded-full border px-3 py-1.5 text-sm transition-colors duration-au-fast",
                  selected
                    ? "border-(--fg-primary) bg-(--fg-primary) text-(--bg-raised)"
                    : "border-(--border-default) bg-(--bg-raised) text-(--fg-secondary) hover:text-(--fg-primary)",
                ].join(" ")}
              >
                {choice.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (control.type === "shadow") {
    return (
      <div className="rounded-lg border border-(--border-subtle) bg-(--bg-surface) p-4">
        <ControlHeader control={control} />
        {preview}
        <textarea
          aria-label={control.label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mono mt-4 min-h-24 w-full resize-y rounded-md border border-(--border-default) bg-(--bg-raised) p-3 text-xs text-(--fg-primary) outline-none focus-visible:ring-2 focus-visible:ring-(--ring-focus)"
        />
      </div>
    )
  }

  if (control.type === "color") {
    const fallback = control.defaults[mode]
    const colorValue = safeColorValue(value, fallback)

    return (
      <div className="rounded-lg border border-(--border-subtle) bg-(--bg-surface) p-4">
        <ControlHeader control={control} />
        {preview}
        <div className="flex items-center gap-3">
          <input
            aria-label={control.label}
            type="color"
            value={colorValue}
            onChange={(event) => onChange(event.target.value)}
            className="shrink-0 cursor-pointer rounded-md border border-(--border-default) bg-transparent"
            style={{
              width: "var(--space-10)",
              height: "var(--space-10)",
            }}
          />
          <AuInput
            dense
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label={`${control.label} hex`}
          />
        </div>
      </div>
    )
  }

  const currentNumber = numericValue(value)

  return (
    <div className="rounded-lg border border-(--border-subtle) bg-(--bg-surface) p-4">
      <ControlHeader control={control} />
      {preview}
      <AuSlider
        min={control.min}
        max={control.max}
        step={control.step}
        value={currentNumber}
        valueDisplay={value}
        onChange={(event) =>
          onChange(formatNumberValue(Number(event.target.value), control))
        }
      />
      <div className="mt-3">
        <AuField label="Valor" htmlFor={`${mode}-${control.token}`}>
          <AuInput
            id={`${mode}-${control.token}`}
            dense
            type="number"
            min={control.min}
            max={control.max}
            step={control.step}
            value={currentNumber}
            onChange={(event) =>
              onChange(formatNumberValue(Number(event.target.value), control))
            }
          />
        </AuField>
      </div>
    </div>
  )
}

function ControlHeader({ control }: { control: FoundationTweakControl }) {
  const meta =
    control.selector && control.cssProperty
      ? `${control.selector} · ${control.cssProperty}`
      : control.token

  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="m-0 text-base">{control.label}</h3>
        <p className="m-0 mt-1 text-sm leading-relaxed text-(--fg-secondary)">
          {control.description}
        </p>
      </div>
      <code className="mono text-xs text-(--fg-tertiary) text-right">
        {meta}
      </code>
    </div>
  )
}

function ControlInlinePreview({
  control,
  value,
}: {
  control: FoundationTweakControl
  value: string
}) {
  const style = getControlPreviewStyle(control, value)

  return (
    <div className="mb-4 rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-4">
      <div className="au-eyebrow mb-2">preview</div>
      <div
        className="min-h-10 rounded-md border border-(--border-subtle) bg-(--bg-canvas) p-3 text-(--fg-primary)"
        style={style}
      >
        {getControlPreviewText(control)}
      </div>
    </div>
  )
}

function getControlPreviewText(control: FoundationTweakControl) {
  if (control.cssProperty === "text-transform") return "eyebrow label"
  if (control.cssProperty === "letter-spacing") return "Letter spacing sample"
  if (control.cssProperty === "font-weight") return "Weight sample"
  if (control.cssProperty === "line-height") {
    return "Linha de texto para avaliar altura de linha em leitura padrão."
  }
  if (control.type === "color") return control.token
  if (control.type === "shadow") return "Preview da elevação"
  if (control.category === "radius") return "Radius preview"
  if (control.category === "spacing" || control.category === "layout") {
    return "Spacing preview"
  }
  if (control.category === "type") return "Aa Typography preview"
  return "Foundation preview"
}

function getControlPreviewStyle(
  control: FoundationTweakControl,
  value: string,
): React.CSSProperties {
  const style: React.CSSProperties = {}

  if (control.cssProperty === "text-transform") {
    style.textTransform = value as React.CSSProperties["textTransform"]
  }
  if (control.cssProperty === "letter-spacing") {
    style.letterSpacing = value
  }
  if (control.cssProperty === "font-weight") {
    style.fontWeight = value
  }
  if (control.cssProperty === "line-height") {
    style.lineHeight = value
  }
  if (control.type === "color") {
    style.background = value
    style.color = "var(--fg-on-inverse)"
  }
  if (control.type === "shadow") {
    style.boxShadow = value
  }
  if (control.category === "radius") {
    style.borderRadius = value
  }
  if (control.category === "spacing") {
    style.padding = value
  }
  if (control.category === "layout") {
    style.maxWidth = value
  }
  if (
    control.category === "type" &&
    !control.cssProperty &&
    control.token.endsWith("-size")
  ) {
    style.fontSize = value
    style.lineHeight = 1.15
  }

  return style
}

function PreviewPanel({
  mode,
  surface,
  onSurfaceChange,
}: {
  mode: FoundationTweakMode
  surface: PreviewSurface
  onSurfaceChange: (surface: PreviewSurface) => void
}) {
  return (
    <AuCard
      className="overflow-hidden bg-(--bg-raised)"
      style={{ borderRadius: "var(--radius-2xl)" }}
    >
      <div className="border-b border-(--border-subtle) px-5 py-4 flex items-center justify-between">
        <div>
          <p className="au-eyebrow mb-2">Preview</p>
          <h2 className="m-0 text-(--h5-size)">Componentes em contexto</h2>
        </div>
        <div className="flex items-center gap-3">
          <AuTabs
            items={previewTabs}
            value={surface}
            onChange={(next) => onSurfaceChange(next as PreviewSurface)}
            variant="segmented"
            aria-label="Preview"
          />
          <AuPill variant={mode === "dark" ? "neutral" : "live"}>
            {mode === "dark" ? "Dark" : "Light"}
          </AuPill>
        </div>
      </div>

      <div className={mode === "dark" ? "dark" : undefined}>
        <div className="bg-(--bg-canvas) text-(--fg-primary) p-6">
          {surface === "product" && <ProductPreview />}
          {surface === "forms" && <FormPreview />}
          {surface === "data" && <DataPreview />}
          {surface === "chrome" && <ChromePreview />}
        </div>
      </div>
    </AuCard>
  )
}

function ProductPreview() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[1.35fr_1fr] gap-5">
        <div
          className="border border-(--border-subtle) bg-(--bg-raised) p-5"
          style={{
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="au-eyebrow mb-2">Agent Studio</p>
              <h3 className="m-0">Orquestração de agentes</h3>
            </div>
            <AuPill variant="ai">Beta</AuPill>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-(--fg-secondary)">
            Simule como as foundations reagem em superfícies, texto, bordas,
            ações, estados e elevação.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <AuButton variant="primary" iconRight="arrow_forward">
              Salvar ajuste
            </AuButton>
            <AuButton variant="secondary" iconLeft="visibility">
              Revisar
            </AuButton>
            <AuButton variant="ghost" iconLeft="more_horiz">
              Mais
            </AuButton>
          </div>
        </div>

        <div
          className="border border-(--border-subtle) bg-(--bg-surface) p-5"
          style={{
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="au-eyebrow mb-2">Pipeline</p>
              <h3 className="m-0">Qualidade do setup</h3>
            </div>
            <Icon name="settings" size={22} />
          </div>
          <div className="flex flex-col gap-4">
            <AuProgress
              value={72}
              label="Cobertura"
              valueLabel="72%"
              variant="success"
            />
            <AuProgress
              value={38}
              label="Pendências"
              valueLabel="3 itens"
              variant="warning"
            />
            <AuToggleRow
              title="Preview ativo"
              description="Override local aplicado na sessão atual."
              checked
            />
          </div>
        </div>
      </div>

      <TokenSwatchGrid />
    </div>
  )
}

function FormPreview() {
  return (
    <div className="grid grid-cols-[1fr_1fr] gap-5">
      <div
        className="border border-(--border-subtle) bg-(--bg-raised) p-5"
        style={{
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <p className="au-eyebrow mb-2">Form</p>
        <h3 className="m-0">Configuração de foundation</h3>
        <div className="mt-5 flex flex-col gap-4">
          <AuField label="Token">
            <AuInput placeholder="--accent-brand" iconLeft="search" />
          </AuField>
          <AuField label="Descrição">
            <AuInput placeholder="Ação primária e acento institucional" />
          </AuField>
          <div className="flex items-center gap-3">
            <AuCheckbox checked label="Aprovado para revisão" />
            <span className="text-sm text-(--fg-secondary)">
              Aprovado para revisão
            </span>
          </div>
          <AuToggleRow
            title="Aplicar preview global"
            description="Mantém os overrides entre reloads."
            checked
          />
          <div className="flex items-center gap-3">
            <AuButton variant="primary" iconLeft="save">
              Salvar draft
            </AuButton>
            <AuButton variant="danger" iconLeft="delete">
              Descartar
            </AuButton>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <AuAlert variant="success" title="Patch pronto">
          O conjunto atual pode ser consolidado como revisão de foundation.
        </AuAlert>
        <AuAlert variant="warning" title="Verifique contraste">
          Alterações de texto e surface devem passar por leitura em light e
          dark.
        </AuAlert>
        <div
          className="border border-(--border-subtle) bg-(--bg-surface) p-5"
          style={{
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <p className="au-eyebrow mb-2">States</p>
          <div className="flex flex-wrap gap-2">
            <AuPill variant="live">Ativo</AuPill>
            <AuPill variant="draft">Draft</AuPill>
            <AuPill variant="warning">Revisão</AuPill>
            <AuPill variant="error">Erro</AuPill>
          </div>
        </div>
      </div>
    </div>
  )
}

function DataPreview() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4">
        {[
          ["Tokens alterados", "12", "var(--accent-brand)"],
          ["Componentes afetados", "34", "var(--accent-success)"],
          ["Contraste mínimo", "AA", "var(--accent-warning)"],
        ].map(([label, value, token]) => (
          <div
            key={label}
            className="border border-(--border-subtle) bg-(--bg-raised) p-4"
            style={{
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div
              className="mb-4 rounded-md"
              style={{
                width: "var(--space-8)",
                height: "var(--space-2)",
                background: token,
              }}
            />
            <div className="text-(--h4-size) font-semibold">{value}</div>
            <div className="mt-1 text-sm text-(--fg-secondary)">{label}</div>
          </div>
        ))}
      </div>

      <div
        className="border border-(--border-subtle) bg-(--bg-raised) p-5"
        style={{
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="au-eyebrow mb-2">Tabela</p>
            <h3 className="m-0">Impacto por token</h3>
          </div>
          <AuButton variant="secondary" iconLeft="filter_list">
            Filtrar
          </AuButton>
        </div>
        <AuTable>
          <thead>
            <tr>
              <th>Token</th>
              <th>Uso</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["--accent-brand", "Botões primários", "Alterado"],
              ["--bg-raised", "Cards e painéis", "Estável"],
              ["--shadow-sm", "Cards sutis", "Revisar"],
            ].map(([token, use, status]) => (
              <tr key={token}>
                <td className="mono">{token}</td>
                <td>{use}</td>
                <td>
                  <AuPill
                    variant={
                      status === "Alterado"
                        ? "warning"
                        : status === "Revisar"
                          ? "draft"
                          : "neutral"
                    }
                  >
                    {status}
                  </AuPill>
                </td>
              </tr>
            ))}
          </tbody>
        </AuTable>
      </div>
    </div>
  )
}

function ChromePreview() {
  return (
    <div
      className="grid grid-cols-[220px_1fr] overflow-hidden border border-(--dark-border)"
      style={{
        borderRadius: "var(--radius-2xl)",
        background: "var(--dark-bg)",
        color: "var(--dark-fg-primary)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <aside className="border-r border-(--dark-border) p-4">
        <div className="mb-6 flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center rounded-md"
            style={{
              width: "var(--space-10)",
              height: "var(--space-10)",
              background: "var(--dark-bg-raised)",
            }}
          >
            <Icon name="auto_awesome" size={20} />
          </span>
          <div>
            <div className="text-sm font-semibold">Auis</div>
            <div
              className="text-xs"
              style={{ color: "var(--dark-fg-secondary)" }}
            >
              Shell preview
            </div>
          </div>
        </div>
        {["Dashboard", "Agent Studio", "Memory Base", "Settings"].map(
          (item, index) => (
            <div
              key={item}
              className="mb-2 flex items-center gap-3 px-3 py-2 text-sm"
              style={{
                borderRadius: "var(--radius-md)",
                background: index === 1 ? "var(--dark-bg-hover)" : undefined,
                color:
                  index === 1
                    ? "var(--dark-fg-primary)"
                    : "var(--dark-fg-secondary)",
              }}
            >
              <Icon name={index === 1 ? "hub" : "circle"} size={18} />
              {item}
            </div>
          ),
        )}
      </aside>
      <section className="p-5">
        <div
          className="border p-5"
          style={{
            borderColor: "var(--dark-border)",
            borderRadius: "var(--radius-xl)",
            background: "var(--dark-bg-raised)",
          }}
        >
          <p
            className="au-eyebrow mb-2"
            style={{ color: "var(--dark-fg-tertiary)" }}
          >
            Dark chrome
          </p>
          <h3 className="m-0" style={{ color: "var(--dark-fg-primary)" }}>
            Navegação e superfícies escuras
          </h3>
          <p
            className="mt-3 text-sm leading-relaxed"
            style={{ color: "var(--dark-fg-secondary)" }}
          >
            Esta área mostra tokens específicos do shell escuro, separados dos
            tokens semânticos light/dark do conteúdo.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <AuButton variant="secondary" iconLeft="visibility">
              Preview
            </AuButton>
            <AuButton variant="ghost" iconLeft="tune">
              Ajustar
            </AuButton>
          </div>
        </div>
      </section>
    </div>
  )
}

function TokenSwatchGrid() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        ["Brand", "var(--accent-brand)"],
        ["Success", "var(--accent-success)"],
        ["Warning", "var(--accent-warning)"],
        ["Danger", "var(--accent-danger)"],
      ].map(([label, token]) => (
        <div
          key={label}
          className="rounded-lg border border-(--border-subtle) bg-(--bg-raised) p-4"
        >
          <div
            className="mb-3 rounded-md"
            style={{
              height: "var(--space-8)",
              background: token,
            }}
          />
          <div className="text-sm font-medium">{label}</div>
          <div className="caption mono mt-1">{token}</div>
        </div>
      ))}
    </div>
  )
}
