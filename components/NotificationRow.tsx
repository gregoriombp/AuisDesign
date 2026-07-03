"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { AppNotification, NotificationKind } from "@/lib/notifications";

/** Ícone por tipo de notificação. O tom é sempre neutro (cinza) — o feed não
 * usa cor semântica nos ícones; o que sinaliza "novo" é o dot azul. */
const NEUTRAL = { bg: "var(--bg-muted)", fg: "var(--fg-tertiary)" } as const;
const KIND_META: Record<
  NotificationKind,
  { icon: string; bg: string; fg: string }
> = {
  billing: { icon: "credit_card", ...NEUTRAL },
  agent: { icon: "agent", ...NEUTRAL },
  team: { icon: "group", ...NEUTRAL },
  security: { icon: "shield", ...NEUTRAL },
  system: { icon: "info", ...NEUTRAL },
};

export type NotificationRowProps = {
  notification: AppNotification;
  /** Quando definido, o clique chama o handler em vez de navegar direto. */
  onActivate?: (n: AppNotification) => void;
};

export function NotificationRow({
  notification,
  onActivate,
}: NotificationRowProps) {
  const meta = KIND_META[notification.kind];
  const base =
    "flex w-full gap-3 px-4 py-3.5 text-left transition-colors duration-au-fast";
  const isNew = !notification.read;

  const inner = (
    <>
      <span
        aria-hidden="true"
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: meta.bg, color: meta.fg }}
      >
        <Icon name={meta.icon} size={24} fill={1} />
        {isNew && (
          <span
            aria-hidden="true"
            className="absolute right-0 top-0 inline-block h-2.5 w-2.5 rounded-full"
            style={{
              background: "var(--au-blue-500)",
              boxShadow: "0 0 0 2px var(--bg-raised)",
            }}
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={
              "min-w-0 flex-1 truncate body-sm " +
              (isNew
                ? "font-medium text-(--fg-primary)"
                : "font-normal text-(--fg-secondary)")
            }
          >
            {notification.title}
          </span>
          <span className="shrink-0 body-xs tabular-nums text-(--fg-tertiary)">
            {notification.timeLabel}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-2 block body-xs text-(--fg-secondary)">
          {notification.description}
        </span>
      </span>
      <Icon
        name="chevron_right"
        size={18}
        className="mt-0.5 shrink-0 self-start text-(--fg-tertiary)"
      />
    </>
  );

  // Se o pai passou onActivate, ele controla a navegação (geralmente via modal
  // de confirmação). Caso contrário, mantém o comportamento legado de Link.
  if (onActivate) {
    return (
      <button
        type="button"
        onClick={() => onActivate(notification)}
        aria-label={`Abrir notificação: ${notification.title}`}
        className={`${base} hover:bg-(--bg-muted)`}
      >
        {inner}
      </button>
    );
  }

  if (notification.href) {
    return (
      <Link
        href={notification.href}
        className={`${base} hover:bg-(--bg-muted)`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}
