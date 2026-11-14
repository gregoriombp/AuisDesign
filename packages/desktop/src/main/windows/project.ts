// A project window: the app's toolbar on top, the project's own pages in a
// sandboxed view below it, and the dev-server log in a strip at the bottom.
//
// The toolbar cannot draw over the project view (a child view composites above
// the window's own page), so nothing here overlaps: the view is resized to
// leave the toolbar and the log strip uncovered.

import { BrowserWindow, WebContentsView, nativeTheme } from "electron";
import {
  CHANNELS,
  LOGS_HEIGHT,
  TOOLBAR_HEIGHT,
  PORT_NOTICE_HEIGHT,
  type NavigateAction,
  type ProjectState,
} from "../../shared/ipc.ts";
import { displayPath, type Project } from "../projects.ts";
import { APP_ORIGIN, guardProject, openExternally, trustChrome } from "../security.ts";
import { createProjectServer } from "../server.ts";
import { detectProject } from "../detect.ts";
import { bridgeNotice, workspaceRoute, type Workspace } from "../../shared/workspace.ts";

export interface ProjectWindow {
  project: Project;
  window: BrowserWindow;
  contentsId: number;
  state(): ProjectState;
  logs(): string[];
  navigate(action: NavigateAction): void;
  setLogsOpen(open: boolean): void;
  restart(): Promise<void>;
  install(): Promise<void>;
  openInBrowser(): void;
  /** The project's page, when the server is up. For the W0 gate's capture only. */
  view(): WebContentsView | null;
  /** Ends the server if this window started it. Safe to call more than once. */
  stop(): Promise<void>;
}

interface Options {
  preload: string;
  /** Called on every state change, so the launcher can reflect it. */
  onChanged(): void;
  onClosed(): void;
}

export function openProjectWindow(project: Project, options: Options): ProjectWindow {
  const server = createProjectServer(project.path);
  const detected = detectProject(project.path);
  const hasAuis = detected.ok && detected.project.hasAuis;
  let workspace: Workspace | null = null;
  let view: WebContentsView | null = null;
  let logsOpen = false;
  let route = "/";
  let pending: string[] = [];
  let flush: NodeJS.Timeout | null = null;
  let stopping: Promise<void> | null = null;

  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 760,
    minHeight: 480,
    title: project.name,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#030507" : "#f1f2f4",
    webPreferences: {
      preload: options.preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  const contentsId = win.webContents.id;
  trustChrome(win.webContents);
  // The window is named after the project, not after the page inside it.
  win.on("page-title-updated", (event) => event.preventDefault());

  const state = (): ProjectState => ({
    name: project.name,
    displayPath: displayPath(project.path),
    hasAuis,
    server: server.state(),
    route,
    canGoBack: view?.webContents.navigationHistory.canGoBack() ?? false,
    canGoForward: view?.webContents.navigationHistory.canGoForward() ?? false,
    loading: view?.webContents.isLoading() ?? false,
    logsOpen,
  });

  const push = () => {
    if (!win.isDestroyed()) win.webContents.send(CHANNELS.projectChanged, state());
    options.onChanged();
  };

  const layout = () => {
    if (!view || win.isDestroyed()) return;
    const [width, height] = win.getContentSize();
    const bottom = logsOpen ? LOGS_HEIGHT : 0;
    const top = TOOLBAR_HEIGHT + (bridgeNotice(server.state()) ? PORT_NOTICE_HEIGHT : 0);
    view.setBounds({
      x: 0,
      y: top,
      width,
      height: Math.max(0, height - top - bottom),
    });
  };

  const removeView = () => {
    if (!view) return;
    if (!win.isDestroyed()) win.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
    view = null;
  };

  const showView = (appUrl: string) => {
    const origin = new URL(appUrl).origin;
    workspace = { kind: "local", path: project.path, origin };
    removeView();
    view = new WebContentsView({
      webPreferences: {
        // Its own storage: a project's cookies and local data never mix with
        // another project's, or with the app's.
        partition: `persist:ws-${project.id}`,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });
    const contents = view.webContents;
    guardProject(contents, workspace);

    const track = () => {
      try {
        const url = new URL(contents.getURL());
        if (url.origin === origin) route = url.pathname + url.search;
      } catch {
        /* about:blank while the first load is in flight */
      }
      push();
    };
    contents.on("did-navigate", track);
    contents.on("did-navigate-in-page", track);
    contents.on("did-start-loading", push);
    contents.on("did-stop-loading", push);

    win.contentView.addChildView(view);
    layout();
    // An Auis project opens on its hub; a host app opens on its own home.
    void contents.loadURL(origin + (hasAuis ? "/auis" : "/")).catch(() => {
      /* a failed first load shows in the view itself; the toolbar's reload retries it */
    });
  };

  server.onState((next) => {
    if (next.status === "running") showView(next.url);
    else removeView();
    // When the server fails or dies, what it printed is the answer: show it.
    if ((next.status === "error" || next.status === "stopped") && server.logs().length > 0) {
      logsOpen = true;
    }
    if (next.status === "installing") logsOpen = true;
    push();
  });
  server.onLog((lines) => {
    // Batched: a dev server can print hundreds of lines in a burst.
    pending.push(...lines);
    flush ??= setTimeout(() => {
      flush = null;
      const batch = pending;
      pending = [];
      if (!win.isDestroyed()) win.webContents.send(CHANNELS.projectLog, batch);
    }, 80);
  });

  const stop = () => {
    stopping ??= server.stop();
    return stopping;
  };

  win.on("resize", layout);
  // Keep the window registered until cleanup finishes, so Quit also waits for it.
  let closeReady = false;
  win.on("close", (event) => {
    if (closeReady) return;
    event.preventDefault();
    void stop().then(() => {
      closeReady = true;
      removeView();
      if (!win.isDestroyed()) win.close();
    });
  });
  win.on("closed", () => {
    if (flush) clearTimeout(flush);
    options.onClosed();
  });

  void win.loadURL(`${APP_ORIGIN}/project.html`);
  void server.start();

  return {
    project,
    window: win,
    contentsId,
    state,
    logs: () => server.logs(),
    view: () => view,
    stop,
    navigate(action) {
      const contents = view?.webContents;
      if (!contents) return;
      if (action.type === "back") contents.navigationHistory.goBack();
      else if (action.type === "forward") contents.navigationHistory.goForward();
      else if (action.type === "reload") contents.reload();
      else {
        const running = server.state();
        // Only an in-app path: a renderer must not be able to send the view elsewhere.
        if (running.status !== "running") return;
        const url = workspace && workspaceRoute(workspace, action.route);
        if (url) void contents.loadURL(url).catch(() => { /* Reload can retry. */ });
      }
    },
    setLogsOpen(open) {
      logsOpen = open;
      layout();
      push();
    },
    async restart() {
      stopping = null;
      await server.restart();
    },
    async install() {
      stopping = null;
      await server.install();
    },
    openInBrowser() {
      const running = server.state();
      if (running.status === "running") openExternally(new URL(running.url).origin + route);
    },
  };
}
