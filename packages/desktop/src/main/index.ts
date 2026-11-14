// Auis for Mac — the W0 skeleton (see ../../PLAN.md).
//
// One project, named on the command line. The app asks the user's shell for
// its environment, attaches to that folder's dev server or starts it, shows the
// product in a window, and on quit stops exactly what it started.
//
// What is deliberately not here yet: the toolbar and the launcher (W1), and the
// supervisor's state machine with its tests (W2). The status strip at the top
// of the window is a placeholder for that toolbar.

import { app, BrowserWindow, WebContentsView, shell, type Session } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PRODUCT_NAME } from "../shared/app.ts";
import { resolveShellEnv, type Env } from "./env.ts";
import { liveDevServer, pidAlive, readDevLock, type DevServerInfo } from "./nextLock.ts";

const BAR_HEIGHT = 36;
const READY_TIMEOUT_MS = 90_000;
const HTTP_TIMEOUT_MS = 30_000;
const STOP_GRACE_MS = 5_000;

/** What the page of a project may ask the system for. Electron's default is everything. */
const ALLOWED_PERMISSIONS = new Set(["media", "clipboard-sanitized-write", "fullscreen"]);

type Tone = "busy" | "ok" | "error";

/** The dev server, only when this app started it. An attached server is never ours to stop. */
let server: ChildProcess | null = null;
let quitting = false;
let finished = false;
let exitCode = 0;

const log = (message: string) => console.log(`[auis-desktop] ${message}`);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;]*m/g, "");

interface Options {
  root: string | null;
  /** W0 gate only: a folder to write `view.png` and `chrome.png` into once the project shows. */
  capture: string | null;
  /** W0 gate only: quit by itself after this long. The Playwright smoke replaces both in W3. */
  quitAfterMs: number | null;
}

/**
 * `argv` without the executable. Unpackaged, the first positional is the app's
 * own folder (`electron .`), and it is not always argv[1]: a test runner puts
 * its switches in front of it. So it is recognised by what it points at.
 */
function parseArgs(argv: string[], appPath: string | null): Options {
  const options: Options = { root: null, capture: null, quitAfterMs: null };
  let skippedApp = appPath === null;
  for (const arg of argv) {
    if (arg.startsWith("--capture=")) options.capture = arg.slice("--capture=".length);
    else if (arg.startsWith("--quit-after=")) {
      options.quitAfterMs = Number(arg.slice("--quit-after=".length)) || null;
    } else if (arg.startsWith("-")) continue;
    else if (!skippedApp && path.resolve(arg) === appPath) skippedApp = true;
    else if (options.root === null) options.root = arg;
  }
  return options;
}

function resolveRoot(input: string): string {
  // Under `npm --prefix`, cwd is this package; INIT_CWD is where the user stood.
  const absolute = path.resolve(process.env.INIT_CWD ?? process.cwd(), input);
  // The real path is the project's identity: Auis keys its data and backups on
  // it, so a symlinked spelling must not become a second project.
  return fs.realpathSync(absolute);
}

// ── Window ────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * The placeholder chrome: one line of status. It is a self-contained data URL
 * with no script and no network, so it needs no preload and no IPC. System
 * colors keep it legible in light and dark without inventing a palette.
 */
function statusPage(tone: Tone, title: string, detail: string): string {
  const dot = tone === "ok" ? "Highlight" : tone === "error" ? "Mark" : "GrayText";
  const html = `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font: 13px/1 system-ui, sans-serif; background: Canvas; color: CanvasText; }
  header { height: ${BAR_HEIGHT}px; display: flex; align-items: center; gap: 8px; padding: 0 14px;
    box-sizing: border-box; border-bottom: 1px solid GrayText; white-space: nowrap; overflow: hidden; }
  i { width: 8px; height: 8px; border-radius: 50%; background: ${dot}; flex: none; }
  b { font-weight: 600; }
  span { color: GrayText; overflow: hidden; text-overflow: ellipsis; }
</style>
<header><i></i><b>${escapeHtml(title)}</b><span>${escapeHtml(detail)}</span></header>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function setStatus(win: BrowserWindow, tone: Tone, title: string, detail: string) {
  log(`${title} — ${detail}`);
  if (!win.isDestroyed()) void win.loadURL(statusPage(tone, title, detail));
}

function sameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

function openExternally(url: string) {
  // Only web links leave the app. A page must not hand `file:` or a custom
  // scheme to the system through us.
  if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
}

function guardPermissions(ses: Session, origin: string) {
  ses.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(ALLOWED_PERMISSIONS.has(permission) && sameOrigin(details.requestingUrl, origin));
  });
  ses.setPermissionCheckHandler(
    (_contents, permission, requestingOrigin) =>
      ALLOWED_PERMISSIONS.has(permission) && sameOrigin(requestingOrigin, origin),
  );
}

/**
 * The project's page: no preload, no Node, its own storage partition, and it
 * stays on the project's origin. Anything else opens in the default browser.
 */
async function showProject(win: BrowserWindow, root: string, appUrl: string) {
  const origin = new URL(appUrl).origin;
  const id = createHash("sha256").update(root).digest("hex").slice(0, 16);
  const view = new WebContentsView({
    webPreferences: {
      partition: `persist:ws-${id}`,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  const contents = view.webContents;

  guardPermissions(contents.session, origin);
  contents.on("will-navigate", (event) => {
    if (sameOrigin(event.url, origin)) return;
    event.preventDefault();
    openExternally(event.url);
  });
  contents.on("will-redirect", (event) => {
    if (sameOrigin(event.url, origin)) return;
    event.preventDefault();
    openExternally(event.url);
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (sameOrigin(url, origin)) void contents.loadURL(url);
    else openExternally(url);
    return { action: "deny" };
  });

  win.contentView.addChildView(view);
  const layout = () => {
    const [width, height] = win.getContentSize();
    view.setBounds({ x: 0, y: BAR_HEIGHT, width, height: Math.max(0, height - BAR_HEIGHT) });
  };
  layout();
  win.on("resize", layout);

  // An Auis project opens on its hub; a host app opens on its own home.
  const start = fs.existsSync(path.join(root, "app", "auis")) ? "/auis" : "/";
  await contents.loadURL(origin + start);
  return view;
}

// ── Dev server ────────────────────────────────────────────────────────────

/**
 * Starts the project's own `dev` script and resolves once Next's lock says the
 * server is ours and up. No port is passed: forcing one disables Next's own
 * retry (3000 → 3010) and breaks `dev` scripts that are more than `next dev`.
 */
function startServer(root: string, env: Env): Promise<DevServerInfo> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let output = "";
    let settled = false;

    // `detached` puts npm, Next and everything they fork in one process group,
    // which is what lets quit stop the whole tree and nothing else.
    const child = spawn("npm", ["run", "dev"], {
      cwd: root,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    server = child;

    const settle = (finish: () => void) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timer);
      finish();
    };
    const onData = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      output = (output + text).slice(-8000);
      for (const line of text.split("\n")) if (line.trim()) console.log(`[dev] ${line}`);
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);

    child.once("error", (error) => {
      server = null;
      settle(() => reject(new Error(`could not run npm: ${error.message}`)));
    });
    child.once("exit", (code) => {
      server = null;
      settle(() => {
        // Next refuses a second instance in the same folder. If that is what
        // happened, someone started one between our check and our spawn: attach.
        const existing = liveDevServer(root, env);
        if (existing && /already running/.test(stripAnsi(output))) resolve(existing);
        else reject(new Error(`the dev server exited with code ${code} before it was ready`));
      });
    });

    const poll = setInterval(() => {
      const info = readDevLock(root, env);
      // `startedAt` rules out a lock left behind by a server that was killed.
      if (info && info.startedAt >= startedAt && pidAlive(info.pid)) settle(() => resolve(info));
    }, 250);
    const timer = setTimeout(() => {
      settle(() => reject(new Error(`the dev server was not ready after ${READY_TIMEOUT_MS / 1000}s`)));
    }, READY_TIMEOUT_MS);
  });
}

/** The lock appears a moment before the first request can be answered. */
async function waitForHttp(appUrl: string) {
  const deadline = Date.now() + HTTP_TIMEOUT_MS;
  while (Date.now() < deadline && !quitting) {
    try {
      await fetch(appUrl, { method: "HEAD", redirect: "manual" });
      return;
    } catch {
      await sleep(300);
    }
  }
  if (!quitting) throw new Error(`${appUrl} did not answer`);
}

function groupAlive(pgid: number): boolean {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function signalGroup(pgid: number, signal: NodeJS.Signals) {
  try {
    process.kill(-pgid, signal);
  } catch {
    /* already gone */
  }
}

/** Stops the server this app started: ask first, so Next removes its lock, then insist. */
async function stopServer() {
  const pgid = server?.pid;
  if (!pgid || !groupAlive(pgid)) return;

  signalGroup(pgid, "SIGTERM");
  const deadline = Date.now() + STOP_GRACE_MS;
  while (groupAlive(pgid) && Date.now() < deadline) await sleep(100);
  if (!groupAlive(pgid)) return;

  signalGroup(pgid, "SIGKILL");
  while (groupAlive(pgid) && Date.now() < deadline + 2000) await sleep(50);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────

async function open(options: Options, win: BrowserWindow) {
  if (!options.root) throw new Error("no project folder given: npm start -- <folder>");
  const root = resolveRoot(options.root);
  const name = path.basename(root);
  win.setTitle(`${PRODUCT_NAME} — ${name}`);

  setStatus(win, "busy", name, "Reading your shell environment…");
  const { env, source } = await resolveShellEnv({ cwd: root });
  log(`environment from the ${source} shell`);
  if (quitting) return;

  let info = liveDevServer(root, env);
  if (info) {
    log(`attached to a running dev server (pid ${info.pid})`);
  } else {
    setStatus(win, "busy", name, "Starting the dev server…");
    info = await startServer(root, env);
    log(server ? `started the dev server (pid ${info.pid})` : `attached to pid ${info.pid}`);
    server?.once("exit", (code) => {
      if (!quitting) setStatus(win, "error", name, `The dev server stopped (code ${code}).`);
    });
  }
  if (quitting) return;

  await waitForHttp(info.appUrl);
  if (quitting) return;

  const owner = server ? "started by Auis" : "attached";
  setStatus(win, "ok", name, `${info.appUrl} · ${owner}`);
  const view = await showProject(win, root, info.appUrl);

  if (options.capture) {
    await sleep(2500);
    fs.mkdirSync(options.capture, { recursive: true });
    const page = await view.webContents.capturePage();
    fs.writeFileSync(path.join(options.capture, "view.png"), page.toPNG());
    const chrome = await win.webContents.capturePage();
    fs.writeFileSync(path.join(options.capture, "chrome.png"), chrome.toPNG());
    log(`captured ${view.webContents.getURL()} · window ${win.getMediaSourceId()}`);
  }
}

app.setName(PRODUCT_NAME);

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
} else {
  // Quit is asynchronous on purpose: the app must not disappear while the
  // server it started is still running.
  app.on("before-quit", (event) => {
    if (finished) return;
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    void stopServer().finally(() => {
      finished = true;
      app.exit(exitCode);
    });
  });
  app.on("window-all-closed", () => app.quit());
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => app.quit());
  }

  void app.whenReady().then(async () => {
    const options = parseArgs(process.argv.slice(1), app.isPackaged ? null : app.getAppPath());
    const win = new BrowserWindow({
      width: 1360,
      height: 900,
      title: PRODUCT_NAME,
      webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
    });
    // The window is named after the project, not after whatever page is in it.
    win.on("page-title-updated", (event) => event.preventDefault());
    // The chrome never navigates and never opens a window.
    win.webContents.on("will-navigate", (event) => event.preventDefault());
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

    try {
      await open(options, win);
    } catch (error) {
      exitCode = 1;
      const message = error instanceof Error ? error.message : String(error);
      setStatus(win, "error", "Could not open the project", message);
    }
    if (options.quitAfterMs !== null) setTimeout(() => app.quit(), options.quitAfterMs);
  });
}
