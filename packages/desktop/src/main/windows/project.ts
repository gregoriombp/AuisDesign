// A project window: the app's toolbar on top, the project's own pages in a
// sandboxed view below it, and the dev-server log in a strip at the bottom.
//
// The toolbar cannot draw over the project view (a child view composites above
// the window's own page), so nothing here overlaps: the view is resized to
// leave the toolbar, the port notice and the log strip uncovered.

import { BrowserWindow, WebContentsView, clipboard, nativeTheme } from "electron";
import {
  CHANNELS,
  DEFAULT_BRIDGE_PORT,
  LOGS_HEIGHT,
  NOTICE_HEIGHT,
  TOOLBAR_HEIGHT,
  type NavigateAction,
  type PortNotice,
  type ProjectState,
} from "../../shared/ipc.ts";
import { resolveRoute } from "../../shared/workspace.ts";
import { detectProject } from "../detect.ts";
import { displayPath, type Project } from "../projects.ts";
import { APP_ORIGIN, guardProject, openExternally, trustChrome } from "../security.ts";
import { createProjectServer } from "../server.ts";

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
  copyNoticeCommand(): Promise<void>;
  dismissNotice(): void;
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
  const kind = detectProject(project.path)?.kind ?? "other";
  // Only a project with the Auis surfaces has a hub to open and shortcuts to offer.
  const hasAuis = kind === "auis";
  // The agent skills talk to the bridge, which both kinds of Auis project have.
  const hasBridge = kind === "auis" || kind === "auis-review";
  let view: WebContentsView | null = null;
  let logsOpen = false;
  let route = "/";
  /** The port whose notice was dismissed. A restart on another port shows it again. */
  let dismissedPort: number | null = null;
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

  const notice = (): PortNotice | null => {
    const running = server.state();
    if (running.status !== "running" || !hasBridge) return null;
    if (running.port === DEFAULT_BRIDGE_PORT || running.port === dismissedPort) return null;
    return { port: running.port, command: `export BRIDGE_BASE=${new URL(running.url).origin}` };
  };

  const state = (): ProjectState => ({
    name: project.name,
    displayPath: displayPath(project.path),
    hasAuis,
    notice: notice(),
    server: server.state(),
    route,
    canGoBack: view?.webContents.navigationHistory.canGoBack() ?? false,
    canGoForward: view?.webContents.navigationHistory.canGoForward() ?? false,
    loading: view?.webContents.isLoading() ?? false,
    logsOpen,
  });

  const layout = () => {
    if (!view || win.isDestroyed()) return;
    const [width, height] = win.getContentSize();
    const top = TOOLBAR_HEIGHT + (notice() ? NOTICE_HEIGHT : 0);
    const bottom = logsOpen ? LOGS_HEIGHT : 0;
    view.setBounds({ x: 0, y: top, width, height: Math.max(0, height - top - bottom) });
  };

  const push = () => {
    layout();
    if (!win.isDestroyed()) win.webContents.send(CHANNELS.projectChanged, state());
    options.onChanged();
  };

  const removeView = () => {
    if (!view) return;
    if (!win.isDestroyed()) win.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
    view = null;
  };

  const showView = (appUrl: string) => {
    const origin = new URL(appUrl).origin;
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
    guardProject(contents, [origin]);

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
    // A project with the Auis surfaces opens on its hub; any other on its own home.
    void contents.loadURL(origin + (hasAuis ? "/auis" : "/")).catch(() => {
      /* a failed first load shows in the view itself; the toolbar's reload retries it */
    });
  };

  server.onState((next) => {
    if (next.status === "running") showView(next.url);
    else removeView();
    // An install is watched through what it prints, and when the server fails
    // or dies, what it printed is the answer: either way, show the log.
    const failed = (next.status === "error" || next.status === "stopped") && server.logs().length > 0;
    if (next.status === "installing" || failed) logsOpen = true;
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
  // A native Close command must wait for the owned server, just like Quit.
  // Keep the window registered until then so Quit can still find its cleanup.
  let closing = false;
  let closeReady = false;
  win.on("close", (event) => {
    if (closeReady) return;
    event.preventDefault();
    closing = true;
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
    stop,
    navigate(action) {
      const contents = view?.webContents;
      if (!contents) return;
      if (action.type === "back") contents.navigationHistory.goBack();
      else if (action.type === "forward") contents.navigationHistory.goForward();
      else if (action.type === "reload") contents.reload();
      else {
        const running = server.state();
        if (running.status !== "running") return;
        // Only a path on the project's own origin: the chrome must not be able
        // to send the view anywhere else.
        const target = resolveRoute(new URL(running.url).origin, action.route);
        if (target) void contents.loadURL(target);
      }
    },
    setLogsOpen(open) {
      logsOpen = open;
      push();
    },
    async restart() {
      if (closing) return;
      stopping = null;
      await server.restart();
    },
    async install() {
      if (closing) return;
      stopping = null;
      await server.install();
    },
    openInBrowser() {
      const running = server.state();
      if (running.status !== "running") return;
      const target = resolveRoute(new URL(running.url).origin, route);
      if (target) openExternally(target);
    },
    async copyNoticeCommand() {
      // Awaited, so the toolbar only says "Copied" once it is on the clipboard.
      const current = notice();
      if (current) await clipboard.writeText(current.command);
    },
    dismissNotice() {
      const running = server.state();
      if (running.status === "running") dismissedPort = running.port;
      push();
    },
  };
}
