"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { AppNotification, NotificationKind } from "@/lib/notifications";

/** Icon per notification kind. The tone is always neutral (gray) — the feed does
 * not use semantic color on icons; the blue dot is what signals "new". */
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
  /** When set, the click calls the handler instead of navigating directly. */
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

  // If the parent passed onActivate, it owns navigation (usually through a
  // confirmation modal). Otherwise, keep the legacy Link behavior.
  if (onActivate) {
    return (
      <button
        type="button"
        onClick={() => onActivate(notification)}
        aria-label={`Open notification: ${notification.title}`}
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
