"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AuDropdownMenu,
  type AuDropdownItem,
} from "@/components/ui/AuDropdownMenu";
import { AuLogo } from "@/components/ui/AuLogo";
import { useReviewStore } from "@/lib/auis-review/store";
import { useEditStore } from "@/lib/auis-edit/store";
import {
  useAgentSettingsStore,
  agentSettingsOf,
} from "@/lib/auis-review/agentSettingsStore";
import { REVIEW_AGENTS } from "@/lib/auis-review/agents";

export function AuisDot() {
  const router = useRouter();
  const [visible, setVisible] = React.useState(true);
  const reviewActive = useReviewStore((s) => s.active);
  const toggleReview = useReviewStore((s) => s.toggleActive);
  const backend = useReviewStore((s) => s.backend);
  const editActive = useEditStore((s) => s.active);
  const toggleEdit = useEditStore((s) => s.toggleActive);
  const agentSettings = useAgentSettingsStore((s) => s.settings);
  const hydrateAgents = useAgentSettingsStore((s) => s.hydrate);
  const toggleAgent = useAgentSettingsStore((s) => s.toggle);

  React.useEffect(() => {
    void hydrateAgents();
  }, [hydrateAgents]);

  if (!visible) return null;

  const go = (href: string) => router.push(href);

  // Painel de controle dos agentes — Live Response / Auto Construct por agente.
  // Toggles ficam abertos (closeOnSelect: false) pra flipar vários de uma vez.
  const agentItems: AuDropdownItem[] = [
    { id: "sep-agents", separator: true },
    { id: "label-agents", isLabel: true, label: "Agentes" },
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
      onSelect: () => go("/auis/styleguide/ux-flows/primeiro-acesso"),
    },
    { id: "sep-review", separator: true },
    {
      id: "review-status",
      isLabel: true,
      label:
        backend === "bridge"
          ? "Review · bridge local"
          : "Review · local (este navegador)",
    },
    {
      id: "review",
      label: reviewActive ? "Sair do Review Mode" : "Entrar no Review Mode",
      icon: reviewActive ? "rate_review" : "comment",
      checked: reviewActive,
      onSelect: () => toggleReview(),
    },
    {
      id: "edit",
      label: editActive ? "Sair do modo de edição" : "Entrar no modo de edição",
      icon: editActive ? "edit_off" : "edit",
      checked: editActive,
      onSelect: () => toggleEdit(),
    },
    ...agentItems,
    { id: "sep-hide", separator: true },
    {
      id: "hide",
      label: "Ocultar até atualizar",
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
        aria-label="Atalhos do Auis"
        trigger={
          <button
            type="button"
            aria-label="Atalhos do Auis"
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-(--bg-inverse) text-(--fg-on-inverse) shadow-(--shadow-md) outline-hidden transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-(--ring-focus) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-canvas)"
          >
            <AuLogo variant="mark" height={14} aria-label="Auis" />
          </button>
        }
        items={items}
      />
    </div>
  );
}
