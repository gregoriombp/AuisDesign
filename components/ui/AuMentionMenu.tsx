"use client";

import * as React from "react";
import { AuBrandLogo } from "@/components/ui/AuBrandLogo";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/**
 * AuMentionMenu — o menu de menções (@) do editor de checkpoints.
 *
 * Card compacto com as tools nativas no topo, uma seção de Integrações com
 * drill-in (chevron) e o atalho "+ Nova Integração" no rodapé. O item ativo
 * (teclado ou hover) vira uma pill invertida (preta) — referência de design
 * do Agent Studio.
 *
 * Componente PURAMENTE presentacional: quem manda é o dono (o editor) — ele
 * controla `activeKey`, decide o que cada pick faz (inserir, drill-in,
 * abrir modal) e posiciona o card. Assim o mesmo visual serve para o menu
 * de variáveis ({{) e qualquer outro picker inline.
 */

export type AuMentionMenuEntry = {
  /** Identidade estável do item — usada em activeKey/onPick. */
  key: string;
  label: string;
  /** Material Symbol (ignorado quando `brand` está presente). */
  icon?: string;
  /** Brand key do AuBrandLogo — logos reais para integrações. */
  brand?: string;
  /** Chevron à direita — sinaliza drill-in (ex.: integração com subskills). */
  chevron?: boolean;
  /** Realce de cor do rótulo (ex.: item "Personalizado"). */
  accent?: "purple";
};

export type AuMentionMenuSection = {
  /** Rótulo da seção (ex.: "Integrações"). Omitir = lista corrida. */
  label?: string;
  entries: AuMentionMenuEntry[];
};

export type AuMentionMenuProps = {
  sections: AuMentionMenuSection[];
  /** Item realçado (pill invertida). */
  activeKey?: string;
  /** Hover em um item — normalmente sincroniza o activeKey do dono. */
  onHover?: (key: string) => void;
  /** Clique/Enter em um item. mousedown já vem com preventDefault (foco fica no editor). */
  onPick: (key: string) => void;
  /** Ação fixa do rodapé (ex.: "+ Nova Integração"). */
  footer?: { key: string; label: string };
  /** Header de drill-in — mostra o contexto atual e a seta de voltar. */
  header?: { label: string; onBack?: () => void };
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
};

function EntryRow({
  entry,
  active,
  onHover,
  onPick,
}: {
  entry: AuMentionMenuEntry;
  active: boolean;
  onHover?: (key: string) => void;
  onPick: (key: string) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onMouseDown={(e) => {
        // Mantém o foco (e o caret) no editor durante o clique.
        e.preventDefault();
        onPick(entry.key);
      }}
      onMouseEnter={() => onHover?.(entry.key)}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors duration-au-fast",
        active
          ? "bg-(--bg-inverse) text-(--fg-on-inverse)"
          : entry.accent === "purple"
            ? "text-(--au-purple-700)"
            : "text-(--fg-primary)",
      )}
    >
      {entry.brand ? (
        <AuBrandLogo
          brand={entry.brand}
          size="sm"
          bare
          style={{ width: 18, height: 18, borderRadius: 5 }}
        />
      ) : (
        <Icon
          name={entry.icon ?? "bolt"}
          size={16}
          className={cn(
            "shrink-0",
            active
              ? "text-(--fg-on-inverse)"
              : entry.accent === "purple"
                ? "text-(--au-purple-600)"
                : "text-(--fg-tertiary)",
          )}
        />
      )}
      <span className="min-w-0 flex-1 truncate font-medium">{entry.label}</span>
      {entry.chevron && (
        <Icon
          name="chevron_right"
          size={15}
          className={cn(
            "shrink-0",
            active ? "text-(--fg-on-inverse)" : "text-(--fg-tertiary)",
          )}
        />
      )}
    </button>
  );
}

export function AuMentionMenu({
  sections,
  activeKey,
  onHover,
  onPick,
  footer,
  header,
  className,
  style,
  "aria-label": ariaLabel,
}: AuMentionMenuProps) {
  return (
    <div
      role="listbox"
      aria-label={ariaLabel}
      className={cn(
        "w-64 rounded-2xl border border-(--border-subtle) bg-(--bg-raised) p-1.5 shadow-lg",
        className,
      )}
      style={style}
    >
      {header && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            header.onBack?.();
          }}
          className="mb-0.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-(--fg-tertiary) transition-colors duration-au-fast hover:bg-(--bg-hover) hover:text-(--fg-secondary)"
        >
          <Icon name="arrow_back" size={14} />
          {header.label}
        </button>
      )}

      <div className="max-h-64 overflow-y-auto">
        {sections.map(
          (section, si) =>
            section.entries.length > 0 && (
              <React.Fragment key={section.label ?? `sec-${si}`}>
                {section.label && (
                  <p className="px-2.5 pb-1 pt-2 text-2xs font-medium text-(--fg-tertiary)">
                    {section.label}
                  </p>
                )}
                {section.entries.map((entry) => (
                  <EntryRow
                    key={entry.key}
                    entry={entry}
                    active={entry.key === activeKey}
                    onHover={onHover}
                    onPick={onPick}
                  />
                ))}
              </React.Fragment>
            ),
        )}
      </div>

      {footer && (
        <div className="mt-1 border-t border-(--border-subtle) pt-1">
          <EntryRow
            entry={{ key: footer.key, label: footer.label, icon: "add" }}
            active={footer.key === activeKey}
            onHover={onHover}
            onPick={onPick}
          />
        </div>
      )}
    </div>
  );
}
