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

/** Placeholder orgs and people for the showcase — no real avatars ship with the
 *  template, so every entry renders through the switcher's initials fallback.
 *  The first org keeps a long name on purpose, to demo truncation in the rail. */
const ORGANIZATIONS: AuNavRailOrgOption[] = [
  {
    id: "org-1",
    name: "Northwind Industries",
    subtitle: "Organization",
  },
  { id: "org-2", name: "Auis Labs", subtitle: "Workspace" },
  { id: "org-3", name: "Acme Demo", subtitle: "Organization" },
];

const USERS: AuNavRailUserOption[] = [
  {
    id: "user-1",
    name: "Jordan Reyes",
    title: "Owner",
    initials: "JR",
  },
  {
    id: "user-2",
    name: "Avery Chen",
    title: "Admin",
    initials: "AC",
  },
  {
    id: "user-3",
    name: "Sam Okafor",
    title: "Member",
    initials: "SO",
  },
];

/** Demo navigation for the design-system showcase — deliberately generic and
 *  product-agnostic. The routes are placeholders: this component exists to
 *  demonstrate the rail, not to describe a real app's information architecture.
 *  Swap `NAV_SECTIONS` for your own tree when you adopt Auis.
 *
 *  Kept broad on purpose so every capability of the rail stays exercised:
 *  unlabeled groups (first and last), labeled groups, numeric and string
 *  `count` badges, and a mix of Material Symbols icons. */
const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Home", href: "/home", icon: "home" },
      { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
      { label: "Insights", href: "/insights", icon: "bolt" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Projects", href: "/projects", icon: "folder" },
      { label: "Tasks", href: "/tasks", icon: "done_all", count: 12 },
      { label: "Library", href: "/library", icon: "bookmark" },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Documents", href: "/documents", icon: "description" },
      { label: "Media", href: "/media", icon: "image" },
      { label: "Integrations", href: "/integrations", icon: "extension" },
    ],
  },
  {
    label: "Activity",
    items: [
      { label: "Messages", href: "/messages", icon: "chat", count: "99+" },
      { label: "Notifications", href: "/notifications", icon: "notifications" },
      { label: "History", href: "/history", icon: "history" },
    ],
  },
  {
    items: [{ label: "Settings", href: "/settings", icon: "tune" }],
  },
];

const STORAGE_KEY = "auis:sidebar:collapsed";

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
    if (forcedCollapsed) setIsCollapsed(true);
  }, [forcedCollapsed]);

  useEffect(() => {
    if (floating) setIsCollapsed(true);
  }, [floating]);

  // Restore the persisted collapse preference after mount. Skipped while a
  // prop pins the rail collapsed (handled by the effects above).
  useEffect(() => {
    if (forcedCollapsed || floating) return;
    const stored = readStoredCollapsed();
    if (stored != null) setIsCollapsed(stored);
  }, [forcedCollapsed, floating]);

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
