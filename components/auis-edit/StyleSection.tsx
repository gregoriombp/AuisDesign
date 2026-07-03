"use client"

import * as React from "react"
import { Icon } from "@/components/ui/Icon"
import {
  COLOR_RAMPS,
  STYLE_PROPERTIES,
  type StyleProperty,
  type TokenSwatch,
} from "@/lib/auis-edit/token-manifest"

// Seção "Estilo" do inspetor. SÓ tokens: atalhos semânticos no topo + a paleta
// completa (todas as rampas) expansível pras cores; chips de escala pra raio e
// sombra. Cada swatch é um token; nada de valor cru.

function Swatch({
  swatch,
  active,
  onPick,
}: {
  swatch: TokenSwatch
  active: boolean
  onPick: (cssValue: string) => void
}) {
  return (
    <button
      type="button"
      title={`${swatch.label} · ${swatch.token}`}
      onClick={() => onPick(swatch.cssValue)}
      className="h-6 w-6 rounded-(--radius-sm) border border-(--border-subtle) outline-hidden transition-transform hover:scale-110"
      style={{
        background: swatch.cssValue,
        boxShadow: active
          ? "0 0 0 2px var(--bg-raised), 0 0 0 4px var(--accent-brand)"
          : undefined,
      }}
    />
  )
}

/** Converte um valor de cor CSS (#hex / rgb()) pro #rrggbb que o <input
 *  type="color"> exige. Best-effort: cai em preto se não reconhecer. */
function toHex(css: string): string {
  const c = css.trim()
  if (c.startsWith("#")) {
    if (c.length === 4)
      return "#" + c.slice(1).split("").map((ch) => ch + ch).join("")
    return c.slice(0, 7)
  }
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const [r, g, b] = m[1].split(",").map((s) => parseInt(s, 10))
    const h = (n: number) =>
      Math.max(0, Math.min(255, n || 0)).toString(16).padStart(2, "0")
    return `#${h(r)}${h(g)}${h(b)}`
  }
  return "#000000"
}

/** Editar o VALOR de um token (afeta todas as instâncias). Marcado em âmbar pra
 *  diferenciar do override só-neste-elemento (os swatches acima). */
function TokenEditRow({
  token,
  onPick,
}: {
  token: string
  onPick: (value: string) => void
}) {
  const initial = React.useMemo(() => {
    if (typeof window === "undefined") return "#000000"
    return toHex(
      getComputedStyle(document.documentElement).getPropertyValue(token),
    )
  }, [token])
  return (
    <div className="mt-1 flex items-center justify-between gap-2 rounded-(--radius-md) border border-(--au-amber-300) bg-(--au-amber-100) px-2.5 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="body-xs font-medium text-(--au-amber-900)">
          Editar o token
        </span>
        <span className="truncate font-mono text-2xs text-(--au-amber-800)">
          {token} · todas as instâncias
        </span>
      </div>
      <input
        type="color"
        defaultValue={initial}
        onChange={(e) => onPick(e.target.value)}
        aria-label={`Nova cor de ${token}`}
        className="h-7 w-9 shrink-0 cursor-pointer rounded-(--radius-sm) border border-(--border-default) bg-transparent"
      />
    </div>
  )
}

function ColorField({
  property,
  activeValue,
  onPick,
  onClear,
  onPickToken,
  onPickCustom,
}: {
  property: StyleProperty
  activeValue?: string
  onPick: (prop: string, cssValue: string) => void
  onClear: (prop: string) => void
  onPickToken?: (token: string, value: string) => void
  onPickCustom?: (prop: string, value: string) => void
}) {
  const [openRamps, setOpenRamps] = React.useState(false)
  const activeToken = activeValue?.match(/^var\((--[^)]+)\)$/)?.[1] ?? null
  return (
    <div className="flex flex-col gap-2">
      <FieldHeader
        label={property.label}
        active={!!activeValue}
        onClear={() => onClear(property.prop)}
      />
      {property.semantic.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <span className="text-3xs uppercase tracking-(--tracking-label) text-(--fg-tertiary)">
            {group.label}
          </span>
          <div className="flex flex-wrap gap-1">
            {group.tokens.map((t) => (
              <Swatch
                key={t.token}
                swatch={t}
                active={activeValue === t.cssValue}
                onPick={(v) => onPick(property.prop, v)}
              />
            ))}
          </div>
        </div>
      ))}
      {property.showRamps && (
        <>
          <button
            type="button"
            onClick={() => setOpenRamps((v) => !v)}
            className="mt-0.5 inline-flex items-center gap-1 self-start text-3xs uppercase tracking-(--tracking-label) text-(--fg-tertiary) hover:text-(--fg-secondary)"
          >
            <Icon
              name="chevron_right"
              size={14}
              className="inline-block transition-transform"
              style={{ transform: openRamps ? "rotate(90deg)" : "none" }}
            />
            Paleta completa
          </button>
          {openRamps && (
            <div className="flex flex-col gap-1.5 rounded-(--radius-md) bg-(--bg-canvas) p-2">
              {COLOR_RAMPS.map((ramp) => (
                <div key={ramp.family} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-3xs text-(--fg-tertiary)">
                    {ramp.label}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {ramp.swatches.map((t) => (
                      <Swatch
                        key={t.token}
                        swatch={t}
                        active={activeValue === t.cssValue}
                        onPick={(v) => onPick(property.prop, v)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {activeToken && onPickToken && (
        <TokenEditRow
          token={activeToken}
          onPick={(v) => onPickToken(activeToken, v)}
        />
      )}
      {onPickCustom && (
        <div className="mt-1 flex items-center justify-between gap-2 rounded-(--radius-md) border border-dashed border-(--border-default) px-2.5 py-2">
          <div className="flex min-w-0 flex-col">
            <span className="body-xs font-medium text-(--fg-secondary)">
              Cor custom
            </span>
            <span className="truncate text-2xs text-(--fg-tertiary)">
              fora da paleta · quebra o token
            </span>
          </div>
          <input
            type="color"
            onChange={(e) => onPickCustom(property.prop, e.target.value)}
            aria-label={`Cor custom de ${property.label}`}
            className="h-7 w-9 shrink-0 cursor-pointer rounded-(--radius-sm) border border-(--border-default) bg-transparent"
          />
        </div>
      )}
    </div>
  )
}

function ScaleField({
  property,
  activeValue,
  onPick,
  onClear,
}: {
  property: StyleProperty
  activeValue?: string
  onPick: (prop: string, cssValue: string) => void
  onClear: (prop: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <FieldHeader
        label={property.label}
        active={!!activeValue}
        onClear={() => onClear(property.prop)}
      />
      <div className="flex flex-wrap gap-1.5">
        {property.scale?.map((t) => {
          const active = activeValue === t.cssValue
          return (
            <button
              key={t.token}
              type="button"
              title={t.token}
              onClick={() => onPick(property.prop, t.cssValue)}
              className={[
                "rounded-(--radius-sm) border px-2 py-1 body-xs transition-colors",
                active
                  ? "border-(--accent-brand) bg-(--bg-selected) text-(--fg-primary)"
                  : "border-(--border-default) text-(--fg-secondary) hover:bg-(--bg-hover)",
              ].join(" ")}
              style={
                property.prop === "border-radius"
                  ? { borderTopLeftRadius: t.cssValue, borderBottomRightRadius: t.cssValue }
                  : undefined
              }
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FieldHeader({
  label,
  active,
  onClear,
}: {
  label: string
  active: boolean
  onClear: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="body-xs font-medium text-(--fg-secondary)">
        {label}
      </span>
      {active && (
        <button
          type="button"
          onClick={onClear}
          className="body-xs text-(--fg-tertiary) hover:text-(--fg-primary)"
        >
          limpar
        </button>
      )}
    </div>
  )
}

export function StyleSection({
  activeStyle,
  onPick,
  onClear,
  onPickToken,
  onPickCustom,
  only,
}: {
  activeStyle: Record<string, string>
  onPick: (prop: string, cssValue: string) => void
  onClear: (prop: string) => void
  /** Editar o valor de um token (cor global) — só faz sentido pras props de cor. */
  onPickToken?: (token: string, value: string) => void
  /** Aplicar um valor cru fora da paleta (quebra o token) — só pras cores. */
  onPickCustom?: (prop: string, value: string) => void
  /** Restrict to these property kinds (lets the inspector split Cor / Forma /
   *  Espaçamento into their own flat sections). Omit = all. */
  only?: StyleProperty["kind"][]
}) {
  const properties = only
    ? STYLE_PROPERTIES.filter((p) => only.includes(p.kind))
    : STYLE_PROPERTIES
  return (
    <div className="flex flex-col gap-4">
      {properties.map((property) =>
        property.kind === "color" ? (
          <ColorField
            key={property.prop}
            property={property}
            activeValue={activeStyle[property.prop]}
            onPick={onPick}
            onClear={onClear}
            onPickToken={onPickToken}
            onPickCustom={onPickCustom}
          />
        ) : (
          <ScaleField
            key={property.prop}
            property={property}
            activeValue={activeStyle[property.prop]}
            onPick={onPick}
            onClear={onClear}
          />
        ),
      )}
    </div>
  )
}
