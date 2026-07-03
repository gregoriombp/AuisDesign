"use client"

import * as React from "react"
import { Icon } from "@/components/ui/Icon"
import { AuAlert } from "@/components/ui/AuAlert"
import {
  captureEditAnchor,
  findEditableTextLeaf,
  resolveEditElement,
} from "@/lib/auis-edit/anchor"
import {
  currentAxisValue,
  detectComponent,
  type VariantAxis,
} from "@/lib/auis-edit/variant-registry"
import {
  readIconVariation,
  type IconVariation,
} from "@/lib/auis-edit/icon-style"
import {
  TYPOGRAPHY_GROUPS,
  buildClassPayload,
  currentClassValue,
} from "@/lib/auis-edit/typography-registry"
import type { PageEditAnchor, PageEditOp } from "@/lib/auis-edit/types"
import { EDIT_OVERLAY_DATA_ATTR, EDIT_Z } from "./constants"
import { StyleSection } from "./StyleSection"
import { VariantControls } from "./VariantControls"
import { IconPicker } from "./IconPicker"
import { IconStyleControls } from "./IconStyleControls"
import { ClassControls } from "./ClassControls"

function Section({
  title,
  icon,
  aside,
  children,
}: {
  title: string
  icon: string
  /** Conteúdo alinhado à direita do título (ex.: valor atual, "limpar"). */
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-(--border-subtle) px-4 py-3.5 first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon name={icon} size={14} className="text-(--fg-tertiary)" />
          <h3 className="text-2xs font-semibold uppercase tracking-(--tracking-label) text-(--fg-tertiary)">
            {title}
          </h3>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function EditInspector({
  anchor,
  ops,
  onRequestText,
  onPickStyle,
  onClearStyle,
  onHide,
  onPickVariant,
  onPickIcon,
  onPickIconStyle,
  onPickToken,
  onPickCustom,
  onPickClass,
  onOpenInbox,
  onClose,
}: {
  anchor: PageEditAnchor
  ops: PageEditOp[]
  onRequestText: (anchor: PageEditAnchor) => void
  onPickStyle: (anchor: PageEditAnchor, prop: string, cssValue: string) => void
  onClearStyle: (anchor: PageEditAnchor, prop: string) => void
  onHide: (anchor: PageEditAnchor, mode: "hide" | "remove") => void
  onPickVariant: (
    rootAnchor: PageEditAnchor,
    axis: VariantAxis,
    value: string,
  ) => void
  onPickIcon: (anchor: PageEditAnchor, name: string, prevName?: string) => void
  onPickIconStyle: (anchor: PageEditAnchor, variation: IconVariation) => void
  onPickToken: (token: string, value: string) => void
  onPickCustom: (anchor: PageEditAnchor, prop: string, value: string) => void
  onPickClass: (
    anchor: PageEditAnchor,
    payload: { group: string; label?: string; remove: string[]; add: string },
  ) => void
  onOpenInbox: () => void
  onClose: () => void
}) {
  const info = React.useMemo(() => {
    const el = resolveEditElement(anchor)
    if (!el) {
      return {
        label: anchor.component ?? "Elemento",
        canEditText: false,
        isIcon: false,
        currentIcon: "",
        comp: null as ReturnType<typeof detectComponent>,
        rootAnchor: null as PageEditAnchor | null,
        isComponentRoot: false,
        tag: "",
      }
    }
    const isIcon = el.classList.contains("material-symbols-rounded")
    const comp = detectComponent(el)
    return {
      label: comp?.spec.label ?? el.tagName.toLowerCase(),
      canEditText: !isIcon && !!findEditableTextLeaf(el),
      isIcon,
      currentIcon: isIcon ? (el.textContent ?? "").trim() : "",
      comp,
      rootAnchor: comp ? captureEditAnchor(comp.rootEl) : null,
      // The selected element IS the component's root → a direct style override
      // here fights the variant system (off-spec). Inner content isn't flagged.
      isComponentRoot: !!comp && comp.rootEl === el,
      tag: el.tagName.toLowerCase(),
    }
    // anchor identity drives re-resolution; ops drive the active highlights.
  }, [anchor])

  const activeStyle = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const op of ops) {
      if (op.payload.kind === "style" && op.anchor.selector === anchor.selector) {
        map[op.payload.prop] = op.payload.token
      }
    }
    return map
  }, [ops, anchor.selector])

  const variantCurrent = React.useMemo(() => {
    const map: Record<string, string | null> = {}
    if (!info.comp || !info.rootAnchor) return map
    for (const axis of info.comp.spec.axes) {
      const override = ops.find(
        (o) =>
          o.payload.kind === "variant" &&
          o.anchor.selector === info.rootAnchor!.selector &&
          o.payload.axis === axis.key,
      )
      map[axis.key] =
        override && override.payload.kind === "variant"
          ? override.payload.value
          : currentAxisValue(info.comp!.rootEl, axis)
    }
    return map
  }, [ops, info])

  const iconVariation = React.useMemo<IconVariation | null>(() => {
    if (!info.isIcon) return null
    const op = ops.find(
      (o) =>
        o.payload.kind === "iconStyle" && o.anchor.selector === anchor.selector,
    )
    if (op && op.payload.kind === "iconStyle") {
      const { fill, weight, grade, opticalSize } = op.payload
      return { fill, weight, grade, opticalSize }
    }
    const el = resolveEditElement(anchor)
    return el ? readIconVariation(el) : null
  }, [info.isIcon, ops, anchor])

  const classCurrent = React.useMemo(() => {
    const map: Record<string, string | null> = {}
    if (info.isIcon) return map
    const el = resolveEditElement(anchor)
    for (const group of TYPOGRAPHY_GROUPS) {
      const op = ops.find(
        (o) =>
          o.payload.kind === "class" &&
          o.anchor.selector === anchor.selector &&
          o.payload.group === group.key,
      )
      if (op && op.payload.kind === "class") {
        const add = op.payload.add
        map[group.key] =
          group.options.find((o) => o.className === add)?.value ?? null
      } else {
        map[group.key] = el ? currentClassValue(el, group) : null
      }
    }
    return map
  }, [ops, anchor, info.isIcon])

  // Divergence: a direct style override on a component ROOT fights its variants.
  const offSpecActive =
    info.isComponentRoot && Object.keys(activeStyle).length > 0

  // Token quebrado: existe alguma op de estilo custom (valor cru) neste elemento.
  const customActive = React.useMemo(
    () =>
      ops.some(
        (o) =>
          o.payload.kind === "style" &&
          o.anchor.selector === anchor.selector &&
          o.payload.custom,
      ),
    [ops, anchor.selector],
  )

  // Quantas edições já existem neste elemento (pro footer).
  const elementEditCount = React.useMemo(
    () =>
      ops.filter(
        (o) =>
          o.anchor.selector === anchor.selector ||
          (!!info.rootAnchor && o.anchor.selector === info.rootAnchor.selector),
      ).length,
    [ops, anchor.selector, info.rootAnchor],
  )

  return (
    <aside
      {...{ [EDIT_OVERLAY_DATA_ATTR]: "inspector" }}
      className="fixed right-4 top-4 bottom-4 flex w-[320px] flex-col overflow-hidden rounded-(--radius-xl) border border-(--border-subtle) bg-(--bg-raised) shadow-(--shadow-overlay)"
      style={{ zIndex: EDIT_Z.inspector }}
    >
      <header className="flex items-center justify-between gap-2 border-b border-(--border-subtle) px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-(--radius-md) bg-(--bg-inverse) text-(--fg-on-inverse)">
            <Icon
              name={info.isIcon ? "category" : info.comp ? "widgets" : "edit"}
              size={16}
              fill={1}
            />
            {(offSpecActive || customActive) && (
              <span
                aria-hidden
                title="Quebra de token / off-spec"
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-(--accent-warning) ring-2 ring-(--bg-raised)"
              />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate body-sm font-semibold text-(--fg-primary)">
              {info.label}
            </span>
            <span className="flex items-center gap-1 truncate text-2xs text-(--fg-tertiary)">
              <span>
                {info.comp ? "Componente" : info.isIcon ? "Ícone" : "Elemento"}
              </span>
              {info.tag && !info.isIcon && (
                <>
                  <span aria-hidden>·</span>
                  <code className="font-mono">{info.tag}</code>
                </>
              )}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar inspetor"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-(--fg-tertiary) hover:bg-(--bg-hover) hover:text-(--fg-primary)"
        >
          <Icon name="close" size={16} />
        </button>
      </header>

      {offSpecActive && (
        <div className="border-b border-(--border-subtle) px-4 py-3">
          <AuAlert variant="warning">
            <span className="body-xs text-(--fg-secondary)">
              Você está estilizando direto o{" "}
              <strong className="font-semibold text-(--fg-primary)">
                {info.label}
              </strong>{" "}
              — isso foge da variante do componente e vai destoar do padrão.
              Quando der, prefira uma variante.
            </span>
          </AuAlert>
        </div>
      )}

      {customActive && (
        <div className="border-b border-(--border-subtle) px-4 py-3">
          <AuAlert variant="warning">
            <span className="body-xs text-(--fg-secondary)">
              Você quebrou um token: essa cor é um valor{" "}
              <strong className="font-semibold text-(--fg-primary)">custom</strong>{" "}
              fora da paleta. No ship ela vira um token{" "}
              <code className="font-mono">--custom-*</code>.
            </span>
          </AuAlert>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Conteúdo / texto */}
        {!info.isIcon && (
          <Section title="Conteúdo" icon="text_fields">
            <button
              type="button"
              disabled={!info.canEditText}
              onClick={() => onRequestText(anchor)}
              className="flex items-center gap-2 rounded-(--radius-md) border border-(--border-default) px-3 py-2 text-left body-sm text-(--fg-primary) transition-colors hover:bg-(--bg-hover) disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="edit" size={16} className="text-(--fg-secondary)" />
              {info.canEditText ? "Editar texto" : "Sem texto editável aqui"}
            </button>
          </Section>
        )}

        {/* Variantes */}
        {info.comp && info.rootAnchor && (
          <Section title={`Variantes · ${info.comp.spec.label}`} icon="tune">
            <VariantControls
              spec={info.comp.spec}
              current={variantCurrent}
              onPick={(axis, value) => onPickVariant(info.rootAnchor!, axis, value)}
            />
          </Section>
        )}

        {/* Tipografia — vale pra qualquer elemento de texto, não só componentes */}
        {!info.isIcon && (
          <Section title="Tipografia" icon="format_size">
            <ClassControls
              groups={TYPOGRAPHY_GROUPS}
              current={classCurrent}
              onPick={(group, value) =>
                onPickClass(anchor, buildClassPayload(group, value))
              }
            />
          </Section>
        )}

        {/* Ícone */}
        {info.isIcon && (
          <Section title="Ícone" icon="emoji_symbols">
            <IconPicker
              current={info.currentIcon}
              onPick={(name) => onPickIcon(anchor, name, info.currentIcon)}
            />
            {iconVariation && (
              <IconStyleControls
                current={iconVariation}
                onPick={(v) => onPickIconStyle(anchor, v)}
              />
            )}
            <p className="text-2xs text-(--fg-tertiary)">
              A cor do ícone fica na seção{" "}
              <strong className="font-medium text-(--fg-secondary)">Cor</strong>.
            </p>
          </Section>
        )}

        {/* Estilo (tokens) — Cor / Forma / Espaçamento, cada um flat na sua seção */}
        <Section title="Cor" icon="palette">
          <StyleSection
            only={["color"]}
            activeStyle={activeStyle}
            onPick={(prop, cssValue) => onPickStyle(anchor, prop, cssValue)}
            onClear={(prop) => onClearStyle(anchor, prop)}
            onPickToken={onPickToken}
            onPickCustom={(prop, value) => onPickCustom(anchor, prop, value)}
          />
        </Section>

        <Section title="Forma" icon="rounded_corner">
          <StyleSection
            only={["radius", "shadow"]}
            activeStyle={activeStyle}
            onPick={(prop, cssValue) => onPickStyle(anchor, prop, cssValue)}
            onClear={(prop) => onClearStyle(anchor, prop)}
          />
        </Section>

        <Section title="Espaçamento" icon="padding">
          <StyleSection
            only={["spacing"]}
            activeStyle={activeStyle}
            onPick={(prop, cssValue) => onPickStyle(anchor, prop, cssValue)}
            onClear={(prop) => onClearStyle(anchor, prop)}
          />
        </Section>

        {/* Visibilidade */}
        <Section title="Visibilidade" icon="visibility">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onHide(anchor, "hide")}
              className="flex flex-1 items-center justify-center gap-2 rounded-(--radius-md) border border-(--border-default) px-3 py-2 body-sm text-(--fg-primary) transition-colors hover:bg-(--bg-hover)"
            >
              <Icon name="visibility_off" size={16} className="text-(--fg-secondary)" />
              Ocultar
            </button>
            <button
              type="button"
              onClick={() => onHide(anchor, "remove")}
              className="flex flex-1 items-center justify-center gap-2 rounded-(--radius-md) border border-(--border-default) px-3 py-2 body-sm text-(--accent-danger) transition-colors hover:bg-(--bg-hover)"
            >
              <Icon name="delete" size={16} />
              Deletar
            </button>
          </div>
        </Section>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-(--border-subtle) px-4 py-2.5">
        <span className="text-2xs text-(--fg-tertiary)">
          {elementEditCount > 0
            ? `${elementEditCount} ediç${elementEditCount === 1 ? "ão" : "ões"} aqui`
            : "Sem edições aqui"}
        </span>
        <button
          type="button"
          onClick={onOpenInbox}
          className="flex items-center gap-1 rounded-(--radius-sm) px-2 py-1 text-2xs font-medium text-(--fg-secondary) transition-colors hover:bg-(--bg-hover) hover:text-(--fg-primary)"
        >
          <Icon name="inbox" size={14} />
          Inbox · {ops.length}
        </button>
      </footer>
    </aside>
  )
}
