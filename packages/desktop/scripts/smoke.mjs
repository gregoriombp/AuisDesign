// The app's smoke test: the built app, driven for real.
//
//   npm run smoke
//
// It starts Electron on the bundle in dist/, with its own user-data folder (so
// it never reads or writes a real project list), against throwaway projects
// whose `dev` script is the stand-in for `next dev` used by the unit tests.
// The unit tests cover the modules; this covers what only shows when they are
// wired together: the two windows, the preload bridge, the navigation guards,
// the layout around the project's page, the menu, and a clean quit.
//
// Two things the app would otherwise do to the machine are replaced before
// they can happen: the native folder picker (it returns the fixture) and
// opening a link in the user's browser (it is recorded instead).

import { _electron } from "playwright-core";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronPath = createRequire(import.meta.url)("electron");
const fixture = path.join(root, "test", "fixtures", "dev-server.mjs");

const TOOLBAR = 52;
const NOTICE = 44;
const LOGS = 260;


const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "auis-desktop-smoke-")));
const userData = path.join(work, "user-data");

let passed = 0;
let app = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, what) {
  assert(actual === expected, `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function step(name, run) {
  try {
    await run();
    passed++;
    console.log(`ok   ${name}`);
  } catch (error) {
    console.log(`FAIL ${name}`);
    throw error;
  }
}

async function until(what, check, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(100);
  }
}

/**
 * Waits for an element to read `expected`. The main process acts first and the
 * window redraws a moment later, so a text read straight after an action can
 * still be the old one; this is how every text in the chrome is checked.
 */
async function reads(locator, expected, what) {
  let actual = null;
  try {
    await until(what, async () => (actual = (await locator.innerText()).trim()) === expected, 10_000);
  } catch {
    throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/** A throwaway project whose dev script is the fixture in `mode`. With `auis`, it has the Auis surfaces. */
function project(name, mode, { auis = false } = {}) {
  const dir = path.join(work, name);
  fs.mkdirSync(path.join(dir, "node_modules"), { recursive: true });
  if (auis) fs.mkdirSync(path.join(dir, "app", "auis"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({
      name,
      private: true,
      scripts: { dev: `${JSON.stringify(process.execPath)} ${JSON.stringify(fixture)} ${mode}` },
    }),
  );
  return dir;
}

const lockOf = (dir) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, ".next", "dev", "lock"), "utf8"));
  } catch {
    return null;
  }
};

/** The pid the fixture wrote for itself, for the cases where it never took a lock. */
const fixturePid = (dir) => {
  try {
    return Number(fs.readFileSync(path.join(dir, "fixture.pid"), "utf8")) || null;
  } catch {
    return null;
  }
};

// ── The app ───────────────────────────────────────────────────────────────

/** What the app itself printed in this run: on a failure, it says how the app saw things. */
const appOutput = [];

async function launch() {
  app = await _electron.launch({
    executablePath: electronPath,
    args: [root, `--user-data-dir=${userData}`],
  });
  app.process().stdout.on("data", (chunk) => {
    for (const line of String(chunk).split("\n")) if (line.startsWith("[auis-desktop]")) appOutput.push(line);
  });
  // Before anything can call them: no native dialog, and no link leaves this run.
  await app.evaluate(({ dialog, shell }) => {
    globalThis.smoke = { opened: [], navigations: [], folder: null };
    dialog.showOpenDialog = async () =>
      globalThis.smoke.folder
        ? { canceled: false, filePaths: [globalThis.smoke.folder] }
        : { canceled: true, filePaths: [] };
    shell.openExternal = async (url) => void globalThis.smoke.opened.push(url);
  });
  const stubbed = await app.evaluate(
    ({ dialog, shell }) =>
      String(dialog.showOpenDialog).includes("globalThis.smoke") &&
      String(shell.openExternal).includes("globalThis.smoke"),
  );
  assert(stubbed, "could not replace the folder picker and the browser hand-off; refusing to go on");
  return app;
}

const pickNext = (folder) => app.evaluate((_api, value) => void (globalThis.smoke.folder = value), folder);
const opened = () => app.evaluate(() => globalThis.smoke.opened);

/**
 * Records what the project's page tries to navigate to, and whether the app
 * stopped it. Added after the app's own guard, so it sees the guard's verdict.
 */
const watchNavigations = () =>
  app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((candidate) =>
      candidate.webContents.getURL().endsWith("/project.html"),
    );
    win.contentView.children[0].webContents.on("will-navigate", (event) => {
      globalThis.smoke.navigations.push({ url: event.url, prevented: event.defaultPrevented });
    });
  });
const navigations = () => app.evaluate(() => globalThis.smoke.navigations);

/** A page of the app's own chrome, by file name. */
const chrome = (file) =>
  until(`the ${file} window`, () => app.windows().find((page) => page.url() === `app://auis/${file}`));

/** The project's page, as Playwright sees it. */
const viewPage = (origin) =>
  until("the project's page", () => app.windows().find((page) => page.url().startsWith(origin)));

/** The project view as the main process lays it out: its URL and its bounds in the window. */
const view = () =>
  app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((candidate) =>
      candidate.webContents.getURL().endsWith("/project.html"),
    );
    const child = win?.contentView.children[0];
    return child ? { url: child.webContents.getURL(), ...child.getBounds() } : null;
  });

const viewUrl = async () => (await view())?.url ?? null;

/**
 * Runs a script in the project's page from the main process, as a user
 * gesture. Used for anything the app is expected to stop: Playwright waits for
 * a navigation its own click started, and one the app prevented never finishes,
 * which would leave every later action on that page waiting too.
 */
const inPage = (script) =>
  app.evaluate(({ BrowserWindow }, code) => {
    const win = BrowserWindow.getAllWindows().find((candidate) =>
      candidate.webContents.getURL().endsWith("/project.html"),
    );
    return win.contentView.children[0].webContents.executeJavaScript(code, true);
  }, script);
const clickInPage = (selector) => inPage(`void document.querySelector(${JSON.stringify(selector)}).click()`);
const menuItem = (id) =>
  app.evaluate(({ Menu }, itemId) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
    return item ? { label: item.label, enabled: item.enabled } : null;
  }, id);
const clickMenu = (id) =>
  app.evaluate(({ Menu }, itemId) => void Menu.getApplicationMenu()?.getMenuItemById(itemId)?.click(), id);

async function quit() {
  const exited = new Promise((resolve) => app.process().once("exit", resolve));
  await app.evaluate(({ app: electronApp }) => void electronApp.quit()).catch(() => {});
  await Promise.race([exited, sleep(20_000).then(() => Promise.reject(new Error("the app did not quit")))]);
  app = null;
}

// ── The run ───────────────────────────────────────────────────────────────

const site = project("smoke-site", "site", { auis: true });
const broken = project("smoke-broken", "fail");

async function firstRun() {
  await launch();
  const launcher = await chrome("launcher.html");

  await step("first launch: an empty launcher that reads the shell", async () => {
    await launcher.getByText("No project yet").waitFor();
    await launcher.locator(".env-row", { hasText: "Node" }).locator(".status[data-tone=success]").waitFor({ timeout: 30_000 });
  });

  await step("the app's own page is sandboxed: a bridge of named functions, and no Node", async () => {
    const seen = await launcher.evaluate(() => ({
      bridge: Object.keys(window.auisDesktop).sort().join(","),
      require: typeof require,
      process: typeof process,
      ipc: Object.values(window.auisDesktop.project).every((value) => typeof value === "function"),
    }));
    equal(seen.bridge, "launcher,project", "bridge");
    equal(seen.require, "undefined", "require");
    equal(seen.process, "undefined", "process");
    assert(seen.ipc, "the bridge exposes something that is not a function");
  });

  await pickNext(site);
  await launcher.getByRole("button", { name: "Open folder" }).click();
  const toolbar = await chrome("project.html");

  let origin = "";
  await step("opening a folder starts its dev server and shows the project on its hub", async () => {
    await toolbar.locator(".status", { hasText: "Running" }).waitFor({ timeout: 60_000 });
    origin = lockOf(site).appUrl;
    await until("the hub", async () => (await viewUrl()) === `${origin}/auis`);
    await reads(toolbar.locator(".address-name"), "smoke-site", "name");
    await reads(toolbar.locator(".address-route"), "/auis", "route");
    await reads(toolbar.locator(".surface[aria-current=page]"), "Hub", "current surface");
  });
  const page = await viewPage(origin);

  await step("the project's page gets no bridge and no Node", async () => {
    const seen = await page.evaluate(() => ({
      bridge: typeof window.auisDesktop,
      require: typeof require,
      process: typeof process,
    }));
    equal(seen.bridge, "undefined", "bridge");
    equal(seen.require, "undefined", "require");
    equal(seen.process, "undefined", "process");
  });

  await step("off port 3000, the notice gives the BRIDGE_BASE line and pushes the page down", async () => {
    await reads(toolbar.locator(".notice code"), `export BRIDGE_BASE=${origin}`, "command");
    equal((await view()).y, TOOLBAR + NOTICE, "page top");
    await toolbar.getByRole("button", { name: "Dismiss" }).click();
    await until("the page to move up", async () => (await view()).y === TOOLBAR);
    await toolbar.locator(".notice").waitFor({ state: "detached" });
  });

  await step("the toolbar navigates the page: a surface, back, forward", async () => {
    await toolbar.getByRole("button", { name: "Styleguide" }).click();
    await until("the styleguide", async () => (await viewUrl()) === `${origin}/auis/styleguide`);
    await toolbar.locator(".surface[aria-current=page]", { hasText: "Styleguide" }).waitFor();
    await toolbar.getByRole("button", { name: "Back", exact: true }).click();
    await until("back on the hub", async () => (await viewUrl()) === `${origin}/auis`);
    await toolbar.getByRole("button", { name: "Forward", exact: true }).click();
    await until("forward again", async () => (await viewUrl()) === `${origin}/auis/styleguide`);
  });

  await step("a link to this project stays in the window", async () => {
    await page.locator("#internal").click();
    await until("the linked page", async () => (await viewUrl()) === `${origin}/somewhere`);
    await reads(toolbar.locator(".address-route"), "/somewhere", "route");
  });

  await step("links to anywhere else leave the page where it is, and go to the browser", async () => {
    const windows = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    const before = await windows();
    await clickInPage("#external");
    await clickInPage("#new-tab");
    await inPage(`void window.open("https://example.com/popup")`);
    await until("three hand-offs", async () => (await opened()).length === 3);
    equal(
      (await opened()).join(" "),
      "https://example.com/outside https://example.com/new-tab https://example.com/popup",
      "handed to the browser",
    );
    equal(await viewUrl(), `${origin}/somewhere`, "page");
    equal(await windows(), before, "windows");
  });

  await step("a link that is not a web link is stopped, and not handed to the system", async () => {
    await watchNavigations();
    await clickInPage("#custom-scheme");
    const attempt = await until("the attempt", async () =>
      (await navigations()).find((entry) => entry.url.startsWith("auis-smoke-nothing:")),
    );
    equal(attempt.prevented, true, "stopped by the app");
    equal((await opened()).length, 3, "hand-offs");
    equal(await viewUrl(), `${origin}/somewhere`, "page");
  });

  await step("the chrome can send the page to a route, and only to a route", async () => {
    await toolbar.evaluate(() => window.auisDesktop.project.navigate({ type: "route", route: "//example.com/" }));
    await toolbar.evaluate(() => window.auisDesktop.project.navigate({ type: "route", route: "https://example.com/" }));
    await sleep(400);
    equal(await viewUrl(), `${origin}/somewhere`, "page after two attempts to leave");
    await toolbar.evaluate(() => window.auisDesktop.project.navigate({ type: "route", route: "/auis/states" }));
    await until("the route", async () => (await viewUrl()) === `${origin}/auis/states`);
  });

  await step("the log strip takes its space from the page, and shows what the server printed", async () => {
    const full = (await view()).height;
    await toolbar.getByRole("button", { name: "Show the log" }).click();
    await toolbar.locator(".logs-body", { hasText: `Ready on ${origin}` }).waitFor();
    await until("the page to shrink", async () => (await view()).height === full - LOGS);
    await toolbar.getByRole("button", { name: "Hide the log", exact: true }).first().click();
    await until("the page to grow back", async () => (await view()).height === full);
  });

  await step("the menu follows the window in front, and acts on its page", async () => {
    const menus = await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map((item) => item.label));
    // The first is the app's own menu, titled by the system.
    equal(menus.slice(1).join(" "), "File Edit View Project Window Help", "menu bar");
    await until("the page commands", async () => (await menuItem("reload"))?.enabled === true);
    equal((await menuItem("back")).enabled, true, "Back");
    equal((await menuItem("toggle-log")).label, "Show Log", "log item");
    await clickMenu("toggle-log");
    await toolbar.locator(".logs").waitFor();
    await until("the item to flip", async () => (await menuItem("toggle-log")).label === "Hide Log");
    await clickMenu("back");
    await until("back from the menu", async () => (await viewUrl()) === `${origin}/somewhere`);
    await clickMenu("toggle-log");
    await until("the log to close", async () => (await toolbar.locator(".logs").count()) === 0);
  });

  await step("zoom changes the project's page and never the app's own chrome", async () => {
    const zoom = () =>
      app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows().find((candidate) =>
          candidate.webContents.getURL().endsWith("/project.html"),
        );
        return {
          page: win.contentView.children[0].webContents.getZoomLevel(),
          chrome: win.webContents.getZoomLevel(),
        };
      });
    await clickMenu("zoom-in");
    await until("the page to zoom in", async () => (await zoom()).page === 0.5);
    equal((await zoom()).chrome, 0, "chrome zoom");
    await clickMenu("zoom-reset");
    await until("the page back at actual size", async () => (await zoom()).page === 0);
  });

  await step("the launcher and the Open Recent menu both know the project", async () => {
    const title = launcher.locator(".card-title", { hasText: "smoke-site" });
    await title.locator(".status", { hasText: `Open on :${lockOf(site).port}` }).waitFor();
    const id = await launcher.evaluate(async () => (await window.auisDesktop.launcher.state()).projects[0].id);
    equal((await menuItem(`recent:${id}`))?.label, "smoke-site", "recent item");
  });

  await step("a server that dies shows as stopped, with its log, and starts again", async () => {
    const first = lockOf(site).pid;
    process.kill(first, "SIGKILL");
    await toolbar.getByText("The dev server stopped").waitFor({ timeout: 20_000 });
    await toolbar.locator(".logs").waitFor();
    equal(await view(), null, "the dead page");
    equal((await menuItem("reload")).enabled, false, "Reload Page");
    await toolbar.getByRole("button", { name: "Start again" }).click();
    await toolbar.locator(".status", { hasText: "Running" }).waitFor({ timeout: 60_000 });
    const second = lockOf(site).pid;
    assert(second !== first && pidAlive(second), "no new server");
    await until("the page again", async () => (await viewUrl())?.startsWith(lockOf(site).appUrl));
  });

  await step("quitting stops the server it started and leaves the folder clean", async () => {
    const pid = lockOf(site).pid;
    await quit();
    await until("the server to exit", () => !pidAlive(pid), 10_000);
    equal(lockOf(site), null, "lock");
  });
}

async function secondRun() {
  await launch();
  const launcher = await chrome("launcher.html");

  await step("the next launch remembers the project, stopped, ready to open", async () => {
    const card = launcher.locator(".card", { hasText: "smoke-site" });
    await card.locator(".status", { hasText: "Stopped" }).waitFor();
    await card.getByRole("button", { name: "Open project" }).waitFor();
  });

  await pickNext(broken);
  await launcher.getByRole("button", { name: /^Open folder/ }).click();
  const toolbar = await chrome("project.html");

  await step("a project that fails to start says so, with what it printed, and a way to retry", async () => {
    await toolbar.getByText("smoke-broken could not start").waitFor({ timeout: 60_000 });
    await toolbar.getByText("The dev server exited with code 1 before it was ready.").waitFor();
    await toolbar.locator(".logs-body", { hasText: "Error: DATABASE_URL is not set" }).waitFor();
    await toolbar.getByRole("button", { name: "Try again" }).waitFor();
    equal(await view(), null, "page");
    equal(await toolbar.locator(".surfaces").count(), 0, "Auis shortcuts on a project without Auis");
  });

  await step("closing the last windows quits the app", async () => {
    const exited = new Promise((resolve) => app.process().once("exit", resolve));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((win) => win.close())).catch(() => {});
    await Promise.race([exited, sleep(20_000).then(() => Promise.reject(new Error("the app stayed open")))]);
    app = null;
  });
}

let failure = null;
try {
  await firstRun();
  await secondRun();
} catch (error) {
  failure = error;
  // What the windows looked like when it went wrong, kept outside the temp folder that is about to go.
  const shots = path.join(root, "dist", "smoke-failure");
  if (app) {
    fs.mkdirSync(shots, { recursive: true });
    for (const [index, page] of app.windows().entries()) {
      await page.screenshot({ path: path.join(shots, `window-${index}.png`) }).catch(() => {});
    }
    console.log(`screenshots: ${shots}`);
  }
} finally {
  if (app) await app.close().catch(() => {});
  // Nothing this run started may outlive it, whatever happened above.
  for (const pid of [lockOf(site)?.pid, fixturePid(site), fixturePid(broken)]) {
    if (!pid) continue;
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
  fs.rmSync(work, { recursive: true, force: true });
}

if (failure) {
  console.error(failure);
  console.log(`the app's own output:\n${appOutput.map((line) => `  ${line}`).join("\n") || "  (none)"}`);
  process.exit(1);
}
console.log(`smoke ok (${passed} steps)`);
