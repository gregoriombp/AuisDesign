"use client";

import { AuBreadcrumb, type AuBreadcrumbItem } from "./AuBreadcrumb";
import { Icon } from "./Icon";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export type BreadcrumbsItems = (string | BreadcrumbItem)[];

/**
 * Trilha de navegação da plataforma. Delega a renderização ao primitivo do
 * design system `AuBreadcrumb` (styleguide/components/au-breadcrumb) — a barra
 * abaixo só fornece o chrome (faixa + padding). Itens com `icon` compõem o
 * ícone dentro do label (que é ReactNode no primitivo). O separador é o chevron
 * do DS pra manter a leitura de trilha.
 */
export function AuBreadcrumbs({ items }: { items: BreadcrumbsItems }) {
  if (!items || items.length === 0) return null;
  const mapped: AuBreadcrumbItem[] = items.map((item) => {
    const data = typeof item === "string" ? { label: item } : item;
    return {
      href: data.href,
      label: data.icon ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="shrink-0">{data.icon}</span>
          {data.label}
        </span>
      ) : (
        data.label
      ),
    };
  });
  return (
    <AuBreadcrumb
      items={mapped}
      separator={<Icon name="chevron_right" size={14} />}
    />
  );
}

export function AuBreadcrumbsBar({
  items,
  innerClassName,
}: {
  items: BreadcrumbsItems;
  /** Wraps the nav; default preserves legacy full-width padding (`px-8`). */
  innerClassName?: string;
}) {
  // Breadcrumbs only make sense as a navigation trail. With a single item the
  // label just duplicates the page header, so we hide the bar entirely.
  if (!items || items.length <= 1) return null;
  return (
    <div className="flex h-11 shrink-0 items-center bg-(--bg-raised)">
      <div className={innerClassName ?? "w-full px-8"}>
        <AuBreadcrumbs items={items} />
      </div>
    </div>
  );
}
