"use client";

import * as React from "react";
import { AuBrandLogo } from "@/components/ui/AuBrandLogo";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/**
 * AuMentionMenu — the mention (@) menu for the checkpoint editor.
 *
 * A compact card with the native tools on top, an Integrations section with
 * drill-in (chevron) and the "+ New Integration" shortcut in the footer. The
 * active item (keyboard or hover) becomes an inverted (black) pill.
 *
 * A PURELY presentational component: the owner (the editor) is in charge — it
 * controls `activeKey`, decides what each pick does (insert, drill-in, open a
 * modal) and positions the card. That way the same visual serves the variables
 * menu ({{) and any other inline picker.
 */

export type AuMentionMenuEntry = {
  /** Stable identity of the item — used in activeKey/onPick. */
  key: string;
  label: string;
  /** Material Symbol (ignored when `brand` is present). */
  icon?: string;
  /** AuBrandLogo brand key — real logos for integrations. */
  brand?: string;
  /** Chevron on the right — signals a drill-in (e.g. an integration with subskills). */
  chevron?: boolean;
  /** Color accent on the label (e.g. the "Custom" item). */
  accent?: "purple";
};

export type AuMentionMenuSection = {
  /** Section label (e.g. "Integrations"). Omit for a flat list. */
  label?: string;
  entries: AuMentionMenuEntry[];
};

export type AuMentionMenuProps = {
  sections: AuMentionMenuSection[];
  /** Highlighted item (inverted pill). */
  activeKey?: string;
  /** Hover on an item — usually syncs the owner's activeKey. */
  onHover?: (key: string) => void;
  /** Click/Enter on an item. mousedown already calls preventDefault (focus stays in the editor). */
  onPick: (key: string) => void;
  /** Pinned footer action (e.g. "+ New integration"). */
  footer?: { key: string; label: string };
  /** Drill-in header — shows the current context and the back arrow. */
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
        // Keeps focus (and the caret) in the editor during the click.
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
