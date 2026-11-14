// Auis Design for Mac — lifecycle (see ../../PLAN.md).
//
// The app opens on the launcher: the projects it knows, a way to open a
// folder, and what it found in the user's shell. Each project gets its own
// window. Given a folder on the command line, it opens that project directly.
// On quit, every dev server the app started is stopped before the app exits.

import { app, BrowserWindow, dialog, ipcMain, nativeTheme, type IpcMainInvokeEvent } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PRODUCT_NAME } from "../shared/app.ts";
import {
  CHANNELS,
  type LauncherState,
  type NavigateAction,
  type ProjectSummary,
  type ToolInfo,
} from "../shared/ipc.ts";
import { probeTools, resolveShellEnv } from "./env.ts";
import { liveDevServer } from "./nextLock.ts";
import { createProjectStore, displayPath, type Project, type ProjectStore } from "./projects.ts";
import { APP_ORIGIN, isChrome, registerAppScheme, serveApp, trustChrome } from "./security.ts";
import { whyNotRunnable } from "./detect.ts";
import { openProjectWindow, type ProjectWindow } from "./windows/project.ts";
import { installApplicationMenu } from "./menu.ts";

const PRELOAD = path.join(__dirname, "../preload/chrome.cjs");
const RENDERER = path.join(__dirname, "../renderer");

const projectWindows = new Map<string, ProjectWindow>();
let store: ProjectStore;
let launcher: BrowserWindow | null = null;
let tools: ToolInfo[] | null = null;
let quitting = false;
let finished = false;
let refreshMenu = () => {};

const log = (message: string) => console.log(`[auis-desktop] ${message}`);

interface Options {
  root: string | null;
}

/**
 * `argv` without the executable. Unpackaged, the first positional is the app's
 * own folder (`electron .`), and it is not always argv[1]: a test runner puts
 * its switches in front of it. So it is recognised by what it points at.
 */
function parseArgs(argv: string[], appPath: string | null): Options {
  const options: Options = { root: null };
  let skippedApp = appPath === null;
  for (const arg of argv) {
    if (arg.startsWith("-")) continue;
    else if (!skippedApp && path.resolve(arg) === appPath) skippedApp = true;
    else if (options.root === null) options.root = arg;
  }
  return options;
}

// ── Launcher ──────────────────────────────────────────────────────────────

function summarize(project: Project): ProjectSummary {
  const base = { id: project.id, name: project.name, displayPath: displayPath(project.path) };
  const open = projectWindows.get(project.id);
  if (open) {
    const server = open.state().server;
    return { ...base, status: "open", port: server.status === "running" ? server.port : null };
  }
  if (!fs.existsSync(project.path)) return { ...base, status: "missing", port: null };
  // A server someone started in a terminal counts: opening the project attaches to it.
  const running = liveDevServer(project.path);
  return { ...base, status: running ? "running" : "stopped", port: running?.port ?? null };
}

const launcherState = (): LauncherState => ({ projects: store.list().map(summarize), tools });

function pushLauncher() {
  refreshMenu();
  if (launcher && !launcher.isDestroyed()) {
    launcher.webContents.send(CHANNELS.launcherChanged, launcherState());
  }
}

function openLauncher(): BrowserWindow {
  if (launcher && !launcher.isDestroyed()) {
    launcher.focus();
    return launcher;
  }
  const win = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 860,
    minHeight: 560,
    title: PRODUCT_NAME,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#030507" : "#f1f2f4",
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  trustChrome(win.webContents);
  // A server may have been started or stopped in a terminal while we were away.
  win.on("focus", pushLauncher);
  win.on("closed", () => {
    launcher = null;
  });
  void win.loadURL(`${APP_ORIGIN}/launcher.html`);
  launcher = win;
  return win;
}

/** What the user's shell has, read once from their home folder. */
async function readTools() {
  const { env, source } = await resolveShellEnv({ cwd: os.homedir() });
  log(`environment from the ${source} shell`);
  tools = await probeTools(env);
  pushLauncher();
}

// ── Projects ──────────────────────────────────────────────────────────────

function openProject(project: Project): ProjectWindow {
  const existing = projectWindows.get(project.id);
  if (existing) {
    existing.window.focus();
    return existing;
  }
  const opened = openProjectWindow(project, {
    preload: PRELOAD,
    onChanged: pushLauncher,
    onClosed: () => {
      projectWindows.delete(project.id);
      pushLauncher();
    },
  });
  projectWindows.set(project.id, opened);
  pushLauncher();
  return opened;
}

async function pickFolder(parent: BrowserWindow | null) {
  const options = { properties: ["openDirectory" as const], message: "Choose a project folder" };
  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options);
  const folder = result.filePaths[0];
  if (result.canceled || !folder) return;

  const problem = whyNotRunnable(folder);
  if (problem) {
    const box = { type: "info" as const, message: "This folder is not a project", detail: problem };
    if (parent) await dialog.showMessageBox(parent, box);
    else await dialog.showMessageBox(box);
    return;
  }
  openProject(store.open(folder));
}

// ── IPC ───────────────────────────────────────────────────────────────────

/** Registers a handler that only the app's own chrome can call. */
function handle<Args extends unknown[]>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: Args) => unknown,
) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isChrome(event)) throw new Error("not allowed");
    return handler(event, ...(args as Args));
  });
}

/** The project window an IPC call came from. A window can only act on itself. */
function senderProject(event: IpcMainInvokeEvent): ProjectWindow | null {
  for (const opened of projectWindows.values()) {
    if (opened.contentsId === event.sender.id) return opened;
  }
  return null;
}

function isNavigateAction(value: unknown): value is NavigateAction {
  if (typeof value !== "object" || value === null) return false;
  const { type, route } = value as { type?: unknown; route?: unknown };
  if (type === "back" || type === "forward" || type === "reload") return true;
  return type === "route" && typeof route === "string";
}

function registerIpc() {
  handle(CHANNELS.launcherState, () => launcherState());
  handle(CHANNELS.launcherOpenFolder, (event) =>
    pickFolder(BrowserWindow.fromWebContents(event.sender)),
  );
  handle(CHANNELS.launcherOpenProject, (_event, id: unknown) => {
    const project = typeof id === "string" ? store.get(id) : null;
    if (project && fs.existsSync(project.path)) openProject(store.open(project.path));
  });
  handle(CHANNELS.launcherRemoveProject, (_event, id: unknown) => {
    // Forgetting a project that is open would orphan its window's entry.
    if (typeof id === "string" && !projectWindows.has(id)) store.remove(id);
    pushLauncher();
  });

  handle(CHANNELS.projectState, (event) => senderProject(event)?.state() ?? null);
  handle(CHANNELS.projectLogs, (event) => senderProject(event)?.logs() ?? []);
  handle(CHANNELS.projectNavigate, (event, action: unknown) => {
    if (isNavigateAction(action)) senderProject(event)?.navigate(action);
  });
  handle(CHANNELS.projectSetLogsOpen, (event, open: unknown) => {
    senderProject(event)?.setLogsOpen(open === true);
  });
  handle(CHANNELS.projectRestart, (event) => senderProject(event)?.restart());
  handle(CHANNELS.projectInstall, (event) => senderProject(event)?.install());
  handle(CHANNELS.projectOpenInBrowser, (event) => senderProject(event)?.openInBrowser());
  handle(CHANNELS.projectCopyNoticeCommand, (event) => senderProject(event)?.copyNoticeCommand());
  handle(CHANNELS.projectDismissNotice, (event) => senderProject(event)?.dismissNotice());
}

// ── Lifecycle ─────────────────────────────────────────────────────────────

app.setName(PRODUCT_NAME);
registerAppScheme();

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
} else {
  // Quit is asynchronous on purpose: the app must not disappear while a
  // server it started is still running.
  app.on("before-quit", (event) => {
    if (finished) return;
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    const stops = [...projectWindows.values()].map((opened) => opened.stop());
    void Promise.allSettled(stops).finally(() => {
      finished = true;
      app.exit(0);
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) openLauncher();
  });
  app.on("second-instance", () => openLauncher());
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => app.quit());
  }

  void app.whenReady().then(async () => {
    const options = parseArgs(process.argv.slice(1), app.isPackaged ? null : app.getAppPath());
    store = createProjectStore(path.join(app.getPath("userData"), "projects.json"));
    serveApp(RENDERER);
    registerIpc();
    refreshMenu = installApplicationMenu({
      openFolder: () => {
        void pickFolder(BrowserWindow.getFocusedWindow());
      },
      openLauncher: () => {
        openLauncher();
      },
      focusedProject: () => {
        const focused = BrowserWindow.getFocusedWindow();
        for (const opened of projectWindows.values()) {
          if (opened.window === focused) return opened;
        }
        return null;
      },
    });

    if (options.root) {
      // Under `npm --prefix`, cwd is this package; INIT_CWD is where the user stood.
      const folder = path.resolve(process.env.INIT_CWD ?? process.cwd(), options.root);
      const problem = whyNotRunnable(folder);
      if (problem) {
        log(`cannot open ${folder}: ${problem}`);
        openLauncher();
      } else {
        openProject(store.open(folder));
      }
    } else {
      openLauncher();
    }
    void readTools();
  });
}
