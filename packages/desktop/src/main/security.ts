// The lines the app draws between its three kinds of content:
//
// - its own chrome (the launcher, the project toolbar), served from
//   `app://auis/` and the only content allowed to talk to the main process;
// - a project's pages, which get no preload and no Node, their own storage,
//   and stay on the project's origin;
// - the rest of the web, which opens in the user's browser, never in the app.

import {
  net,
  protocol,
  shell,
  type IpcMainInvokeEvent,
  type Session,
  type WebContents,
} from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isAllowedNavigation, webOrigin, type Workspace } from "../shared/workspace.ts";

export const APP_ORIGIN = "app://auis";

/** What a project's page may ask the system for. Electron's default is everything. */
const ALLOWED_PERMISSIONS = new Set(["media", "clipboard-sanitized-write", "fullscreen"]);

/** Must run before the app is ready. `standard` + `secure` make `'self'` in the CSP mean `app://auis`. */
export function registerAppScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/** Serves the built renderer, and nothing outside its folder. */
export function serveApp(rendererDir: string) {
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    if (url.host !== "auis") return new Response(null, { status: 404 });
    const file = path.normalize(path.join(rendererDir, decodeURIComponent(url.pathname)));
    if (!file.startsWith(rendererDir + path.sep)) return new Response(null, { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

const chrome = new Set<number>();

/** Marks a window's own page as the app's chrome, and pins it there. */
export function trustChrome(contents: WebContents) {
  const id = contents.id;
  chrome.add(id);
  contents.once("destroyed", () => chrome.delete(id));
  // The chrome never navigates and never opens a window.
  contents.on("will-navigate", (event) => event.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
}

/** True when an IPC call comes from the app's chrome, on the app's own origin. */
export function isChrome(event: IpcMainInvokeEvent): boolean {
  return chrome.has(event.sender.id) && (event.senderFrame?.url ?? "").startsWith(`${APP_ORIGIN}/`);
}

export function sameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

export function openExternally(url: string) {
  // Only web links leave the app. A page must not hand `file:` or a custom
  // scheme to the system through us.
  if (webOrigin(url)) void shell.openExternal(url);
}

function guardPermissions(ses: Session, workspace: Workspace) {
  ses.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(ALLOWED_PERMISSIONS.has(permission) && isAllowedNavigation(workspace, details.requestingUrl));
  });
  ses.setPermissionCheckHandler(
    (_contents, permission, requestingOrigin) =>
      ALLOWED_PERMISSIONS.has(permission) && isAllowedNavigation(workspace, requestingOrigin),
  );
}

/** Keeps a project's page on the project's origin; everything else opens in the browser. */
export function guardProject(contents: WebContents, workspace: Workspace) {
  guardPermissions(contents.session, workspace);
  contents.on("will-navigate", (event) => {
    if (isAllowedNavigation(workspace, event.url)) return;
    event.preventDefault();
    openExternally(event.url);
  });
  contents.on("will-redirect", (event) => {
    if (isAllowedNavigation(workspace, event.url)) return;
    event.preventDefault();
    openExternally(event.url);
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(workspace, url)) void contents.loadURL(url);
    else openExternally(url);
    return { action: "deny" };
  });
}
