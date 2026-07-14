"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuNotificationsPanel } from "@/components/ui/AuNotificationsPanel";
import { AuCopilotOrb } from "@/components/ui/AuCopilotDrawer";
import { AuInput } from "@/components/ui/AuInput";
import { AuButton } from "@/components/ui/AuButton";
import { Icon } from "@/components/ui/Icon";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export function AuHeader({
  breadcrumbs,
  showDateSelector,
  isCopilotOpen,
  onCopilotOpen,
  minimal = false,
}: {
  breadcrumbs?: (string | BreadcrumbItem)[];
  showDateSelector?: boolean;
  isCopilotOpen?: boolean;
  onCopilotOpen?: (open: boolean) => void;
  minimal?: boolean;
}) {
  const [selectedPeriod, setSelectedPeriod] = useState("today");
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const openSearch = () => {
    setIsSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const handleSearchBlur = () => {
    if (!searchValue) setIsSearchOpen(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setSearchValue("");
      setIsSearchOpen(false);
      searchInputRef.current?.blur();
    }
  };

  const dateOptions = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "week", label: "Last 7 days" },
    { value: "month", label: "Last 30 days" },
    { value: "custom", label: "Custom" },
  ];

  const renderBreadcrumb = (item: string | BreadcrumbItem, index: number, array: (string | BreadcrumbItem)[]) => {
    const isLast = index === array.length - 1;
    const breadcrumbItem = typeof item === 'string' ? { label: item } : item;
    const hasLink = !isLast && breadcrumbItem.href;

    const content = (
      <span className="inline-flex items-center gap-2">
        {breadcrumbItem.icon && (
          <span className="shrink-0 text-(--fg-primary)">{breadcrumbItem.icon}</span>
        )}
        <span className={isLast ? 'text-(--fg-tertiary)' : 'text-(--fg-primary)'}>
          {breadcrumbItem.label}
        </span>
      </span>
    );

    return (
      <div key={index} className="flex items-center gap-1.5">
        <div className="flex items-center gap-2.5">
          {hasLink ? (
            <Link
              href={breadcrumbItem.href!}
              className="body-sm leading-5 hover:underline hover:text-(--fg-primary) focus:outline-hidden focus:underline"
            >
              {content}
            </Link>
          ) : (
            <span className="body-sm leading-5">{content}</span>
          )}
        </div>
        {!isLast && (
          <Icon name="chevron_right" size={24} className="text-(--fg-tertiary) shrink-0" />
        )}
      </div>
    );
  };

  useEffect(() => {
    if (!isNotificationsOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const btn = notificationsButtonRef.current;
      const panel = notificationsPanelRef.current;
      if (btn && btn.contains(target)) return;
      if (panel && panel.contains(target)) return;
      setIsNotificationsOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsNotificationsOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isNotificationsOpen]);

  const threeItems = (
    <div className="relative flex items-center gap-2">
      <div
        className="relative shrink-0 overflow-hidden transition-[width] duration-300 ease-out"
        style={{ width: isSearchOpen ? 240 : 30, height: 34 }}
      >
        <AuInput
          ref={searchInputRef}
          placeholder="Search…"
          iconLeft="search"
          dense
          aria-label="Search"
          className={`w-[240px] transition-colors duration-200 ${
            isSearchOpen ? "" : "border-transparent! bg-transparent!"
          }`}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onBlur={handleSearchBlur}
          onKeyDown={handleSearchKeyDown}
          tabIndex={isSearchOpen ? 0 : -1}
        />
        {!isSearchOpen && (
          <button
            type="button"
            aria-label="Open search"
            onClick={openSearch}
            className="absolute inset-0 cursor-pointer rounded-full hover:bg-(--bg-surface) transition-colors"
          />
        )}
      </div>

      <AuButton
        ref={notificationsButtonRef}
        variant="ghost"
        size="sm"
        iconOnly="notifications"
        aria-label="Notifications"
        aria-expanded={isNotificationsOpen}
        onClick={() => setIsNotificationsOpen((v) => !v)}
      />

      <div ref={notificationsPanelRef}>
        <AuNotificationsPanel
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
        />
      </div>

      <button
        type="button"
        aria-label={isCopilotOpen ? "Close Auis Copilot" : "Open Auis Copilot"}
        className="cursor-pointer rounded-full ml-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-(--fg-primary) focus-visible:ring-offset-2"
        onClick={() => onCopilotOpen?.(!isCopilotOpen)}
      >
        <AuCopilotOrb size={28} />
      </button>
    </div>
  );

  if (minimal) return threeItems;

  return (
    <div className="bg-(--bg-raised) border-b border-(--border-default) px-5 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {breadcrumbs && breadcrumbs.length > 0 && breadcrumbs.map((item, index) =>
            renderBreadcrumb(item, index, breadcrumbs)
          )}
        </div>
        {threeItems}
      </div>
    </div>
  );
}
