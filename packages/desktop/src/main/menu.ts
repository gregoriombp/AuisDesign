// Native app commands. Project actions target the focused window's view, never
// reload the app:// chrome or accidentally operate on another project.
import { app, Menu, type MenuItemConstructorOptions } from "electron";
import { PRODUCT_NAME } from "../shared/app.ts";
import type { ProjectWindow } from "./windows/project.ts";

interface MenuActions {
  openFolder(): void;
  openLauncher(): void;
  focusedProject(): ProjectWindow | null;
}

export function installApplicationMenu(actions: MenuActions): () => void {
  const project = actions.focusedProject;
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [{ role: "appMenu" as const, label: PRODUCT_NAME }]
      : []),
    {
      label: "File",
      submenu: [
        {
          id: "open-folder",
          label: "Open Folder…",
          accelerator: "CmdOrCtrl+O",
          click: actions.openFolder,
        },
        {
          id: "show-projects",
          label: "Show Projects",
          accelerator: "CmdOrCtrl+Shift+P",
          click: actions.openLauncher,
        },
        { type: "separator" },
        { role: "close" },
        ...(process.platform === "darwin" ? [] : [{ role: "quit" as const }]),
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        {
          id: "project-back",
          label: "Back",
          accelerator: "CmdOrCtrl+[",
          click: () => project()?.navigate({ type: "back" }),
        },
        {
          id: "project-forward",
          label: "Forward",
          accelerator: "CmdOrCtrl+]",
          click: () => project()?.navigate({ type: "forward" }),
        },
        {
          id: "project-reload",
          label: "Reload Project",
          accelerator: "CmdOrCtrl+R",
          click: () => project()?.navigate({ type: "reload" }),
        },
        { type: "separator" },
        {
          id: "project-log",
          label: "Show Log",
          type: "checkbox",
          accelerator: "CmdOrCtrl+J",
          click: () => {
            const current = project();
            if (current) current.setLogsOpen(!current.state().logsOpen);
          },
        },
        {
          id: "project-restart",
          label: "Restart Dev Server",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () => {
            void project()?.restart();
          },
        },
        {
          id: "project-browser",
          label: "Open in Browser",
          accelerator: "CmdOrCtrl+Shift+B",
          click: () => project()?.openInBrowser(),
        },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
  app.setAboutPanelOptions({
    applicationName: PRODUCT_NAME,
    applicationVersion: app.getVersion(),
  });
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  const refresh = () => {
    const state = project()?.state();
    const running = state?.server.status === "running";
    const enabled: Record<string, boolean> = {
      "project-back": !!state?.canGoBack && running,
      "project-forward": !!state?.canGoForward && running,
      "project-reload": running,
      "project-log": !!state,
      "project-restart":
        !!state &&
        state.server.status !== "starting" &&
        state.server.status !== "installing",
      "project-browser": running,
    };
    for (const [id, value] of Object.entries(enabled))
      menu.getMenuItemById(id)!.enabled = value;
    menu.getMenuItemById("project-log")!.checked = state?.logsOpen ?? false;
  };
  app.on("browser-window-focus", refresh);
  app.on("browser-window-blur", refresh);
  refresh();
  return refresh;
}
