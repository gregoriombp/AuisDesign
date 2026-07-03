"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AuNavRail,
  AuNavRailGroup,
  AuNavRailItem,
  AuNavRailOrgSwitcher,
  AuNavRailUserSwitcher,
  type AuNavRailOrgOption,
  type AuNavRailUserOption,
} from "@/components/ui/AuNavRail";

type NavItem = {
  label: string;
  href: string;
  icon: string;
  count?: number | string;
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

const ORGANIZATIONS: AuNavRailOrgOption[] = [
  {
    id: "org-1",
    name: "Nome da organização",
    subtitle: "Organização",
    icon: "/assets/icon_artificial_concord_organization.png",
  },
  { id: "org-2", name: "Auis Labs", subtitle: "Workspace" },
  { id: "org-3", name: "Cliente Demo", subtitle: "Organização" },
];

const USERS: AuNavRailUserOption[] = [
  {
    id: "user-1",
    name: "Gregório Pinheiro",
    title: "Super Administrador",
    initials: "GP",
    avatar: "/assets/users/greg.jpg",
  },
  {
    id: "user-2",
    name: "Gabriel Lima",
    title: "Administrador",
    initials: "GL",
    avatar: "/assets/users/gabriel_lima.jpg",
  },
  {
    id: "user-3",
    name: "José Júnior",
    title: "Estagiário",
    initials: "JJ",
    avatar: "/assets/users/jose.jpg",
  },
];

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Início", href: "/inicio", icon: "home" },
      { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
      { label: "Insights", href: "/insights", icon: "bolt" },
    ],
  },
  {
    label: "Agentes",
    items: [
      { label: "Agent studio", href: "/agent-studio", icon: "agent_studio" },
      { label: "Aprovações", href: "/approvals", icon: "done_all" },
      { label: "Disparos", href: "/triggers", icon: "send" },
    ],
  },
  {
    label: "Fontes",
    items: [
      { label: "Memory base", href: "/memory-base", icon: "memory_base" },
      { label: "AOPs", href: "/aops", icon: "description" },
      { label: "Biblioteca", href: "/library", icon: "bookmark" },
      { label: "Habilidades", href: "/tools", icon: "build" },
      { label: "Canais", href: "/canais", icon: "forum" },
      { label: "Integrações", href: "/integrations", icon: "extension" },
    ],
  },
  {
    label: "Acompanhamento",
    items: [
      { label: "Conversas", href: "/conversations", icon: "chat", count: 99 },
      { label: "Playground", href: "/playground", icon: "forum" },
      { label: "Histórico de alterações", href: "/history", icon: "history" },
    ],
  },
  {
    items: [{ label: "Configurações", href: "/settings", icon: "tune" }],
  },
];

const STORAGE_KEY = "auis:sidebar:collapsed";
const FORCE_COLLAPSED_PREFIX = "/agent-studio/";

/** Read the persisted collapsed flag synchronously so the very first render
 *  matches the user's last preference. Returning `undefined` on the server
 *  lets the props/path fallbacks decide. */
function readStoredCollapsed(): boolean | undefined {
  if (typeof window === "undefined") return undefined;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "1") return true;
  if (saved === "0") return false;
  return undefined;
}

export function AuSidebar({
  forcedCollapsed,
  floating,
}: {
  forcedCollapsed?: boolean;
  /** Liquid-glass rail that floats over the page. Starts collapsed. */
  floating?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // The first render must match the server, which has no localStorage —
  // reading the stored preference here would cause a hydration mismatch.
  // It is restored in an effect after mount instead (see below).
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (forcedCollapsed) return true;
    if (floating) return true;
    if (pathname?.startsWith(FORCE_COLLAPSED_PREFIX)) return true;
    return false;
  });

  /** Suppress the width transition until after the first paint. Each route
   *  change in the App Router remounts this Sidebar, and without this guard
   *  any state correction during mount would animate from one width to the
   *  other on every navigation — producing the "jumping rail" feel. */
  const [animationsReady, setAnimationsReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setAnimationsReady(true)),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (pathname?.startsWith(FORCE_COLLAPSED_PREFIX)) setIsCollapsed(true);
  }, [pathname]);

  useEffect(() => {
    if (forcedCollapsed) setIsCollapsed(true);
  }, [forcedCollapsed]);

  useEffect(() => {
    if (floating) setIsCollapsed(true);
  }, [floating]);

  // Restore the persisted collapse preference after mount. Skipped while a
  // prop or route pins the rail collapsed (handled by the effects above).
  useEffect(() => {
    if (forcedCollapsed || floating) return;
    if (pathname?.startsWith(FORCE_COLLAPSED_PREFIX)) return;
    const stored = readStoredCollapsed();
    if (stored != null) setIsCollapsed(stored);
  }, [forcedCollapsed, floating, pathname]);

  const handleToggleCollapsed = () => {
    setIsCollapsed((v) => {
      const next = !v;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      }
      return next;
    });
  };

  const [selectedOrgId, setSelectedOrgId] = useState<string>(ORGANIZATIONS[0].id);
  const [selectedUserId, setSelectedUserId] = useState<string>(USERS[0].id);

  const selectedOrg =
    ORGANIZATIONS.find((o) => o.id === selectedOrgId) ?? ORGANIZATIONS[0];
  const selectedUser =
    USERS.find((u) => u.id === selectedUserId) ?? USERS[0];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href) ?? false;
  };

  const handleNavigate = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    if (href === "/memory-base") setIsCollapsed(true);
    router.push(href);
  };

  return (
    <aside
      className="flex h-screen shrink-0 bg-transparent py-2 pl-2 pr-1"
      style={{
        width: isCollapsed ? 88 : 304,
        transition: animationsReady
          ? "width var(--dur-slow) var(--ease-out)"
          : "none",
      }}
    >
      <AuNavRail
        translucent={floating}
        theme="light"
        collapsed={isCollapsed}
        onToggleCollapsed={handleToggleCollapsed}
        style={{ height: "100%", width: "100%" }}
        top={
          <AuNavRailOrgSwitcher
            organization={selectedOrg}
            organizations={ORGANIZATIONS}
            onSelect={setSelectedOrgId}
            manageHref="/settings"
          />
        }
        bottom={
          <AuNavRailUserSwitcher
            user={selectedUser}
            users={USERS}
            onSelect={setSelectedUserId}
            signOutHref="/"
          />
        }
      >
        {NAV_SECTIONS.map((section, sectionIdx) => (
          <AuNavRailGroup
            key={section.label ?? `section-${sectionIdx}`}
            label={section.label}
          >
            {section.items.map((item) => (
              <AuNavRailItem
                key={item.href}
                icon={item.icon}
                href={item.href}
                active={isActive(item.href)}
                count={item.count}
                onClick={handleNavigate(item.href)}
              >
                {item.label}
              </AuNavRailItem>
            ))}
          </AuNavRailGroup>
        ))}
      </AuNavRail>
    </aside>
  );
}
