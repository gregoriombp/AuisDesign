// Native app commands. Project actions target the focused window's view, never
// reload the app:// chrome or accidentally operate on another project.
//
// Two rules for whoever adds an item:
//
// - Page commands (reload, zoom, developer tools) are plain items wired to the
//   project's view, never Electron's stock roles. Those roles act on whichever
//   page has focus, which can be the toolbar, and zooming or reloading the
//   toolbar breaks a window whose layout the main process counts on.
// - An accelerator here wins over the page: the page never sees the key. Auis's
//   own modes live in the page on ⇧⌘Y, ⇧⌘K (Review), ⇧⌘E (Edit) and ⇧⌘S
//   (States), so those four are off limits. The smoke test holds the menu to it.
import { app, Menu, type MenuItemConstructorOptions } from "electron";
import { PRODUCT_NAME } from "../shared/app.ts";
import type { ProjectWindow } from "./windows/project.ts";

interface MenuActions {
  newProject(): void;
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
          id: "new-project",
          label: "New Project…",
          accelerator: "CmdOrCtrl+N",
          click: actions.newProject,
        },
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
          id: "project-zoom-reset",
          label: "Actual Size",
          accelerator: "CmdOrCtrl+0",
          click: () => project()?.zoom("reset"),
        },
        {
          id: "project-zoom-in",
          label: "Zoom In",
          accelerator: "CmdOrCtrl+Plus",
          click: () => project()?.zoom("in"),
        },
        {
          // ⌘= is how most people zoom in: the same key, without Shift.
          id: "project-zoom-in-unshifted",
          label: "Zoom In",
          accelerator: "CmdOrCtrl+=",
          visible: false,
          acceleratorWorksWhenHidden: true,
          click: () => project()?.zoom("in"),
        },
        {
          id: "project-zoom-out",
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () => project()?.zoom("out"),
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
        {
          id: "project-inspect",
          label: "Inspect Page",
          accelerator: "Alt+CmdOrCtrl+I",
          click: () => project()?.inspectPage(),
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
      "project-zoom-reset": running,
      "project-zoom-in": running,
      "project-zoom-in-unshifted": running,
      "project-zoom-out": running,
      "project-inspect": running,
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
