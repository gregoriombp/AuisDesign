// The app's menu bar, as a description: what is in it, and what is enabled for
// the window in front. Building the real menu from it is the caller's job, so
// this file only borrows Electron's types and runs under `node --test`.
//
// Two rules shape it:
//
// - Page commands act on the project's page, never on the app's own chrome.
//   Electron's stock roles (reload, zoom, dev tools) act on whichever of the two
//   has focus; reloading or zooming the toolbar would break the window. So
//   those are plain items here, wired to the project view.
// - It must not take a shortcut the page already uses. Auis's own modes live
//   in the page on ⇧⌘Y, ⇧⌘K, ⇧⌘E and ⇧⌘S; a menu accelerator would swallow
//   them before the page saw the key. `RESERVED_FOR_THE_PAGE` is that list,
//   and a test holds the menu to it.

import type { MenuItemConstructorOptions } from "electron";

export const RESERVED_FOR_THE_PAGE = [
  "CmdOrCtrl+Shift+Y",
  "CmdOrCtrl+Shift+K",
  "CmdOrCtrl+Shift+E",
  "CmdOrCtrl+Shift+S",
];

export const MAX_RECENT = 10;

export interface RecentProject {
  id: string;
  name: string;
  displayPath: string;
  /** The folder is gone: listed, so the name is not a mystery, but not openable. */
  missing: boolean;
}

/** The project window in front, as far as the menu cares. */
export interface ActiveProject {
  running: boolean;
  /** A start or an install is under way. */
  busy: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  logsOpen: boolean;
}

export interface MenuContext {
  recent: RecentProject[];
  /** Null when the window in front is the launcher, or there is none. */
  project: ActiveProject | null;
  /** Running from source: offers the inspector for the app's own chrome. */
  development: boolean;
}

export type ZoomDirection = "in" | "out" | "reset";

export interface MenuActions {
  openFolder(): void;
  openProject(id: string): void;
  showLauncher(): void;
  navigate(action: "back" | "forward" | "reload"): void;
  zoom(direction: ZoomDirection): void;
  toggleLog(): void;
  inspectPage(): void;
  inspectChrome(): void;
  restart(): void;
  openInBrowser(): void;
  revealInFinder(): void;
  openHelp(): void;
}

type Item = MenuItemConstructorOptions;

const separator: Item = { type: "separator" };

function recentItems(recent: RecentProject[], actions: MenuActions): Item[] {
  if (recent.length === 0) return [{ id: "recent-none", label: "No Recent Projects", enabled: false }];
  return recent.slice(0, MAX_RECENT).map((project) => ({
    id: `recent:${project.id}`,
    label: project.name,
    sublabel: project.displayPath,
    enabled: !project.missing,
    click: () => actions.openProject(project.id),
  }));
}

export function menuTemplate(context: MenuContext, actions: MenuActions): Item[] {
  const { project } = context;
  const open = project !== null;
  const running = project?.running ?? false;

  return [
    // On macOS the first menu is the app's own; its title comes from the bundle.
    {
      role: "appMenu",
      submenu: [
        { role: "about" },
        separator,
        { role: "services" },
        separator,
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        separator,
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        { id: "open-folder", label: "Open Folder…", accelerator: "CmdOrCtrl+O", click: actions.openFolder },
        { id: "open-recent", label: "Open Recent", submenu: recentItems(context.recent, actions) },
        separator,
        { role: "close" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        separator,
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          id: "back",
          label: "Back",
          accelerator: "CmdOrCtrl+[",
          enabled: project?.canGoBack ?? false,
          click: () => actions.navigate("back"),
        },
        {
          id: "forward",
          label: "Forward",
          accelerator: "CmdOrCtrl+]",
          enabled: project?.canGoForward ?? false,
          click: () => actions.navigate("forward"),
        },
        {
          id: "reload",
          label: "Reload Page",
          accelerator: "CmdOrCtrl+R",
          enabled: running,
          click: () => actions.navigate("reload"),
        },
        separator,
        {
          id: "zoom-reset",
          label: "Actual Size",
          accelerator: "CmdOrCtrl+0",
          enabled: running,
          click: () => actions.zoom("reset"),
        },
        {
          id: "zoom-in",
          label: "Zoom In",
          accelerator: "CmdOrCtrl+Plus",
          enabled: running,
          click: () => actions.zoom("in"),
        },
        {
          id: "zoom-out",
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          enabled: running,
          click: () => actions.zoom("out"),
        },
        separator,
        {
          id: "toggle-log",
          label: project?.logsOpen ? "Hide Log" : "Show Log",
          accelerator: "Alt+CmdOrCtrl+L",
          enabled: open,
          click: actions.toggleLog,
        },
        {
          id: "inspect-page",
          label: "Inspect Page",
          accelerator: "Alt+CmdOrCtrl+I",
          enabled: running,
          click: actions.inspectPage,
        },
        ...(context.development
          ? [{ id: "inspect-chrome", label: "Inspect the App's Own Window", click: actions.inspectChrome }]
          : []),
        separator,
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Project",
      submenu: [
        {
          id: "restart",
          label: "Restart Dev Server",
          accelerator: "CmdOrCtrl+Shift+R",
          enabled: open && !project.busy,
          click: actions.restart,
        },
        separator,
        { id: "open-in-browser", label: "Open in Browser", enabled: running, click: actions.openInBrowser },
        { id: "reveal", label: "Reveal in Finder", enabled: open, click: actions.revealInFinder },
      ],
    },
    {
      label: "Window",
      role: "window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        separator,
        { id: "show-launcher", label: "Projects", accelerator: "CmdOrCtrl+Shift+1", click: actions.showLauncher },
        separator,
        { role: "front" },
      ],
    },
    {
      label: "Help",
      role: "help",
      submenu: [{ id: "help", label: "Auis Design on GitHub", click: actions.openHelp }],
    },
  ];
}
