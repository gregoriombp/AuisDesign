"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AuDropdownMenu,
  type AuDropdownItem,
} from "@/components/ui/AuDropdownMenu";
import { AuLogo } from "@/components/ui/AuLogo";
import { useBrand } from "@/app/auis/_data/BrandProvider";
import { useReviewStore } from "@/lib/auis-review/store";
import { useEditStore } from "@/lib/auis-edit/store";
import { useStatesStore } from "@/lib/auis-states/store";
import {
  useAgentSettingsStore,
  agentSettingsOf,
} from "@/lib/auis-review/agentSettingsStore";
import { REVIEW_AGENTS } from "@/lib/auis-review/agents";
import { useBuilderChromeHidden } from "@/lib/auis/useBuilderChromeHidden";

/**
 * The persistent Auis dot (bottom-right corner): navigation shortcuts, the
 * three modes (Review / Edit / States) and the per-agent toggles that are the
 * dispatcher's permission.
 */
export function AuisDot() {
  // useSearchParams (through useBuilderChromeHidden) requires Suspense on prerender.
  return (
    <React.Suspense fallback={null}>
      <AuisDotGate />
    </React.Suspense>
  );
}

/** `?chrome=0` (state matrix iframes, the PDF generator) hides the dot. */
function AuisDotGate() {
  const chromeHidden = useBuilderChromeHidden();
  if (chromeHidden) return null;
  return <AuisDotInner />;
}

function AuisDotInner() {
  const router = useRouter();
  const brand = useBrand();
  const [visible, setVisible] = React.useState(true);
  const reviewActive = useReviewStore((s) => s.active);
  const toggleReview = useReviewStore((s) => s.toggleActive);
  const sessionRole = useReviewStore((s) => s.sessionRole);
  const hydrateSession = useReviewStore((s) => s.hydrateSession);
  const editActive = useEditStore((s) => s.active);
  const toggleEdit = useEditStore((s) => s.toggleActive);
  const statesActive = useStatesStore((s) => s.active);
  const toggleStates = useStatesStore((s) => s.toggleActive);
  const agentSettings = useAgentSettingsStore((s) => s.settings);
  const hydrateAgents = useAgentSettingsStore((s) => s.hydrate);
  const toggleAgent = useAgentSettingsStore((s) => s.toggle);
  // Agents obey only the admin — the toggles do not even show for a reviewer
  // (and the server refuses the PUT anyway).
  const isAdmin = sessionRole === "admin";

  React.useEffect(() => {
    void hydrateAgents();
    void hydrateSession();
  }, [hydrateAgents, hydrateSession]);

  if (!visible) return null;

  const go = (href: string) => router.push(href);

  // Agent control panel — Live Response / Auto Construct per agent.
  // Toggles keep the menu open (closeOnSelect: false) so you can flip several
  // of them in one go.
  const agentItems: AuDropdownItem[] = !isAdmin
    ? []
    : [
        { id: "sep-agents", separator: true },
        { id: "label-agents", isLabel: true, label: "Agents" },
        ...REVIEW_AGENTS.flatMap((agent): AuDropdownItem[] => {
          const s = agentSettingsOf(agentSettings, agent.id);
          return agent.capabilities.map((cap): AuDropdownItem => ({
            id: `${agent.id}-${cap.key}`,
            label: `${agent.handle} · ${cap.label}`,
            icon: cap.icon,
            checked: s[cap.key],
            closeOnSelect: false,
            onSelect: () => void toggleAgent(agent.id, cap.key),
          }));
        }),
      ];

  const items: AuDropdownItem[] = [
    { id: "label-nav", isLabel: true, label: "Auis" },
    {
      id: "hub",
      label: "Hub",
      icon: "dashboard",
      onSelect: () => go("/auis"),
    },
    {
      id: "styleguide",
      label: "Styleguide",
      icon: "palette",
      onSelect: () => go("/auis/styleguide"),
    },
    {
      id: "ux-flows",
      label: "UX Flows",
      icon: "account_tree",
      onSelect: () => go("/auis/ux-flow"),
    },
    {
      id: "states-matrix",
      label: "State matrix",
      icon: "grid_view",
      onSelect: () => go("/auis/states"),
    },
    {
      id: "review-bridge",
      label: "Review Bridge",
      icon: "inbox",
      onSelect: () => go("/auis/review-bridge"),
    },
    {
      id: "design-tweaks",
      label: "Design tweaks",
      icon: "tune",
      onSelect: () => go("/auis/design-system-tweaks"),
    },
    {
      id: "projects",
      label: "Projects",
      icon: "folder_open",
      onSelect: () => go("/auis/projects"),
    },
    {
      id: "roadmap",
      label: "Roadmap",
      icon: "flag",
      onSelect: () => go("/auis/roadmap"),
    },
    { id: "sep-modes", separator: true },
    { id: "label-modes", isLabel: true, label: "Modes" },
    {
      id: "review",
      label: reviewActive ? "Exit Review Mode" : "Enter Review Mode",
      icon: reviewActive ? "rate_review" : "comment",
      checked: reviewActive,
      onSelect: () => toggleReview(),
    },
    {
      id: "edit",
      label: editActive ? "Exit Edit Mode" : "Enter Edit Mode",
      icon: editActive ? "edit_off" : "edit",
      checked: editActive,
      onSelect: () => toggleEdit(),
    },
    {
      id: "states",
      label: statesActive ? "Exit State Mode" : "Enter State Mode",
      icon: "instant_mix",
      checked: statesActive,
      onSelect: () => toggleStates(),
    },
    ...agentItems,
    { id: "sep-hide", separator: true },
    {
      id: "hide",
      label: "Hide until refresh",
      icon: "close",
      onSelect: () => setVisible(false),
    },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-60 pointer-events-none">
      <AuDropdownMenu
        align="end"
        side="top"
        sideOffset={8}
        aria-label="Auis shortcuts"
        trigger={
          <button
            type="button"
            aria-label="Auis shortcuts"
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-(--bg-inverse) text-(--fg-on-inverse) shadow-(--shadow-md) outline-hidden transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-(--ring-focus) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-canvas)"
          >
            <AuLogo variant="mark" height={14} aria-label={brand.name} brand={brand} />
          </button>
        }
        items={items}
      />
    </div>
  );
}
