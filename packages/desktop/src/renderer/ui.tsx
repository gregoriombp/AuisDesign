// The few pieces both screens share. They are the app's own, styled by
// desktop.css; nothing here comes from the product's design system.

import type { ReactNode } from "react";
import type { DesktopBridge } from "../shared/ipc.ts";

export const desktop = (window as unknown as { auisDesktop: DesktopBridge }).auisDesktop;

type IconSize = 14 | 16 | 20 | 32;

/** A Material Symbols Rounded glyph, by ligature name. Decorative: the control carries the label. */
export function Icon({ name, size = 20, className }: { name: string; size?: IconSize; className?: string }) {
  const sized = size === 20 ? "icon" : `icon icon-${size}`;
  return (
    <span className={className ? `${sized} ${className}` : sized} aria-hidden="true">
      {name}
    </span>
  );
}

interface IconButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  spinning?: boolean;
}

export function IconButton({ icon, label, onClick, disabled, pressed, spinning }: IconButtonProps) {
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={16} className={spinning ? "spin" : undefined} />
    </button>
  );
}

export type Tone = "success" | "danger" | "busy" | "idle";

export function Status({ tone, title, children }: { tone: Tone; title?: string; children: ReactNode }) {
  return (
    <span className="status" data-tone={tone} title={title}>
      {children}
    </span>
  );
}
