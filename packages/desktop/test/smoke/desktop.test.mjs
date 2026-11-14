import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright";
import electronPath from "electron";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
// The same gate can exercise the signed app.asar bundle, without rebuilding it.
const packagedExecutable = process.env.AUIS_DESKTOP_EXECUTABLE;
const output = path.join(packageRoot, packagedExecutable ? "output/smoke-packaged" : "output/smoke");
fs.mkdirSync(output, { recursive: true });
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(label, check, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await pause(25);
  }
  throw new Error(`Timed out: ${label}`);
}

function fixture(
  t,
  label,
  { installed = true, startDelay = 250, stopDelay = 0 } = {},
) {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), `auis-smoke-${label}-`)),
  );
  const project = path.join(root, "project");
  fs.mkdirSync(path.join(project, "app/auis"), { recursive: true });
  fs.mkdirSync(path.join(root, "home"));
  fs.mkdirSync(path.join(project, "fixture-dependency"));
  fs.writeFileSync(
    path.join(project, "fixture-dependency/package.json"),
    JSON.stringify({ name: "fixture-dependency", version: "1.0.0" }),
  );
  fs.writeFileSync(
    path.join(project, "package.json"),
    JSON.stringify({
      private: true,
      scripts: { dev: `node smoke-server.mjs ${startDelay} ${stopDelay}` },
      dependencies: { "fixture-dependency": "file:./fixture-dependency" },
    }),
  );
  fs.writeFileSync(path.join(project, ".npmrc"), "audit=false\nfund=false\n");
  fs.copyFileSync(
    new URL("../fixtures/smoke-server.mjs", import.meta.url),
    path.join(project, "smoke-server.mjs"),
  );
  if (installed) fs.mkdirSync(path.join(project, "node_modules"));
  const evidence = path.join(output, label);
  fs.rmSync(evidence, { recursive: true, force: true });
  fs.mkdirSync(evidence, { recursive: true });
  const env = {
    ...process.env,
    HOME: path.join(root, "home"),
    SHELL: "/bin/sh",
    PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const lockFile = path.join(project, ".next/dev/lock");
  const lock = () => {
    try {
      return JSON.parse(fs.readFileSync(lockFile, "utf8"));
    } catch {
      return null;
    }
  };
  const pids = () => {
    try {
      return fs
        .readFileSync(path.join(project, "smoke-pids.jsonl"), "utf8")
        .trim()
        .split("\n")
        .flatMap((line) => {
          const row = JSON.parse(line);
          return [row.pid, row.parent];
        });
    } catch {
      return [];
    }
  };
  let app;
  let appProcess;
  t.after(async () => {
    if (app) {
      if (appProcess.exitCode === null && appProcess.signalCode === null) {
        for (const [i, page] of app.windows().entries()) {
          try {
            fs.writeFileSync(
              path.join(evidence, `final-${i}.txt`),
              await page.locator("body").ariaSnapshot({ timeout: 1500 }),
            );
          } catch {
            /* A stopped project view is already destroyed. */
          }
        }
        await app
          .context()
          .tracing.stop({ path: path.join(evidence, "trace.zip") })
          .catch(() => {});
        await app.close().catch(() => {});
      }
    }
    // Only fixture-recorded processes are touched, even on assertion failure.
    for (const pid of pids()) {
      if (pid !== process.pid && alive(pid)) {
        try {
          process.kill(pid, "SIGTERM");
        } catch {}
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
  return {
    root,
    project,
    env,
    lock,
    pids,
    evidence,
    async launch(direct = false) {
      app = await _electron.launch({
        executablePath: packagedExecutable ?? electronPath,
        args: [
          ...(packagedExecutable ? [] : [packageRoot]),
          ...(direct ? [project] : []),
          `--user-data-dir=${root}/profile`,
        ],
        env,
        timeout: 30000,
      });
      appProcess = app.process();
      appProcess.stdout.on("data", (chunk) =>
        fs.appendFileSync(path.join(evidence, "main.log"), chunk),
      );
      appProcess.stderr.on("data", (chunk) =>
        fs.appendFileSync(path.join(evidence, "main.log"), chunk),
      );
      await app.context().tracing.start({ screenshots: true, snapshots: true });
      await app.context().addInitScript(() => {
        window.__serverStates = [];
        window.auisDesktop?.project.onState((state) =>
          window.__serverStates.push(state.server.status),
        );
      });
      // Keep OS effects deterministic, while exercising the real dialog and link callers.
      await app.evaluate(({ dialog, shell }, folder) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [folder],
        });
        globalThis.__externalLinks = [];
        shell.openExternal = async (url) => {
          globalThis.__externalLinks.push(url);
        };
      }, project);
      return app;
    },
  };
}

async function snapshot(page, dir, name) {
  const text = await page.locator("body").ariaSnapshot();
  fs.writeFileSync(path.join(dir, `${name}.txt`), text);
  return text;
}
async function projectState(page, status) {
  return until(`project ${status}`, async () => {
    const state = await page.evaluate(() => window.auisDesktop.project.state());
    if (state?.server.status === "error" && status !== "error")
      throw new Error(state.server.message);
    return state?.server.status === status && state;
  });
}
async function menuItem(app, id) {
  return app.evaluate(({ Menu }, id) => {
    const item = Menu.getApplicationMenu().getMenuItemById(id);
    return (
      item && {
        label: item.label,
        enabled: item.enabled,
        checked: item.checked,
        accelerator: item.accelerator,
      }
    );
  }, id);
}
async function clickMenu(app, id, page) {
  // CDP clicks do not necessarily activate the macOS app. Native menu commands
  // require an active window, just as they do when selected by a person.
  if (page) {
    const win = await app.browserWindow(page);
    await app.evaluate(({ app }) => app.focus({ steal: true }));
    await win.evaluate((window) => window.focus());
    await until(`${id} enabled`, async () => (await menuItem(app, id)).enabled);
  }
  await app.evaluate(({ Menu, BrowserWindow }, id) => {
    const item = Menu.getApplicationMenu().getMenuItemById(id);
    if (!item?.enabled) throw new Error(`Menu item ${id} is unavailable`);
    item.click(item, BrowserWindow.getFocusedWindow(), {});
  }, id);
}
async function quit(app, evidence) {
  await app.context().tracing.stop({ path: path.join(evidence, "trace.zip") });
  await app.close();
}
async function clean(f) {
  await until("all fixture processes stopped", () =>
    f.pids().every((pid) => !alive(pid)),
  );
  assert.equal(f.lock(), null, "owned dev lock must be removed");
}

test("launcher → install → running: toolbar, native commands, boundaries, logs, crash/restart and quit", async (t) => {
  const f = fixture(t, "journey", { installed: false });
  const app = await f.launch();
  const launcher = await app.firstWindow();
  await launcher
    .getByRole("button", { name: "Open folder", exact: true })
    .waitFor();
  await snapshot(launcher, f.evidence, "launcher");
  assert.equal((await menuItem(app, "project-reload")).enabled, false);
  const opening = app.waitForEvent("window");
  await launcher
    .getByRole("button", { name: "Open folder", exact: true })
    .click();
  const chrome = await opening;
  await chrome.waitForURL("app://auis/project.html");
  await projectState(chrome, "error");
  await snapshot(chrome, f.evidence, "install");
  await chrome
    .getByRole("button", { name: "Install dependencies", exact: true })
    .click();
  const state = await projectState(chrome, "running");
  assert.equal(state.server.owned, true);
  assert.ok(
    (await chrome.evaluate(() => window.__serverStates)).includes("starting"),
  );
  const view = await until("project view", () =>
    app.windows().find((page) => page.url().startsWith(state.server.url)),
  );
  await view.getByRole("heading", { name: "Fixture hub" }).waitFor();
  await snapshot(view, f.evidence, "hub");
  assert.deepEqual(
    await view.evaluate(() => [
      typeof require,
      typeof process,
      typeof window.auisDesktop,
    ]),
    ["undefined", "undefined", "undefined"],
  );
  assert.equal(await chrome.evaluate(() => typeof require), "undefined");
  assert.equal(
    (await chrome.evaluate(() => window.auisDesktop.project.state())).notice
      .port,
    state.server.port,
  );
  const clipboardBefore = await app.evaluate(({ clipboard }) =>
    clipboard.readText(),
  );
  try {
    await chrome
      .getByRole("button", { name: "Copy command", exact: true })
      .click();
    await chrome.getByRole("button", { name: "Copied", exact: true }).waitFor();
    assert.equal(
      await app.evaluate(({ clipboard }) => clipboard.readText()),
      `export BRIDGE_BASE=${state.server.url}`,
    );
  } finally {
    await app.evaluate(
      ({ clipboard }, value) => clipboard.writeText(value),
      clipboardBefore,
    );
  }

  await snapshot(chrome, f.evidence, "running");
  await chrome.getByRole("button", { name: "Styleguide", exact: true }).click();
  await view.getByRole("heading", { name: "Fixture styleguide" }).waitFor();
  await snapshot(chrome, f.evidence, "styleguide");
  await chrome.getByRole("button", { name: "Back", exact: true }).click();
  await view.getByRole("heading", { name: "Fixture hub" }).waitFor();
  await snapshot(chrome, f.evidence, "back");
  await chrome.getByRole("button", { name: "Forward", exact: true }).click();
  await view.getByRole("heading", { name: "Fixture styleguide" }).waitFor();
  const beforeReload = await view.getByTestId("requests").innerText();
  await snapshot(chrome, f.evidence, "before-reload");
  await clickMenu(app, "project-reload", chrome);
  await until(
    "project reload",
    async () =>
      (await view.getByTestId("requests").innerText()) !== beforeReload,
  );
  assert.equal(chrome.url(), "app://auis/project.html");
  const projectWindow = await app.browserWindow(chrome);
  await app.evaluate(({ app }) => app.focus({ steal: true }));
  await projectWindow.evaluate((win) => win.focus());
  await until(
    "project menu enabled",
    async () => (await menuItem(app, "project-reload")).enabled,
  );
  assert.equal(
    (await menuItem(app, "project-reload")).accelerator,
    "CmdOrCtrl+R",
  );
  await clickMenu(app, "project-browser");
  assert.ok(
    (await app.evaluate(() => globalThis.__externalLinks)).includes(view.url()),
  );
  await clickMenu(app, "project-log"); // install opened it; menu closes it.
  assert.equal(
    (await chrome.evaluate(() => window.auisDesktop.project.state())).logsOpen,
    false,
  );
  await clickMenu(app, "project-log");
  await chrome.getByRole("region", { name: "Log", exact: true }).waitFor();
  await until("log history consistent", async () => {
    const all = await chrome.evaluate(() => window.auisDesktop.project.logs());
    return (await chrome.locator(".logs-body").innerText()) === all.join("\n");
  });
  assert.equal(
    (await chrome.locator(".logs-body").innerText()).split("$ npm install")
      .length - 1,
    1,
  );
  for (const colorScheme of ["light", "dark"]) {
    await chrome.emulateMedia({ colorScheme });
    await chrome.screenshot({
      path: path.join(f.evidence, `chrome-${colorScheme}.png`),
      animations: "disabled",
    });
  }
  await view.screenshot({ path: path.join(f.evidence, "project.png") });
  await clickMenu(app, "show-projects");
  await until(
    "launcher disables project commands",
    async () => !(await menuItem(app, "project-reload")).enabled,
  );
  await app.evaluate(({ app }) => app.focus({ steal: true }));
  await projectWindow.evaluate((win) => win.focus());

  await snapshot(view, f.evidence, "before-external");
  await view
    .getByRole("link", { name: "External window", exact: true })
    .click({ noWaitAfter: true });
  await until("external popup passed to browser", () =>
    app.evaluate(() =>
      globalThis.__externalLinks.includes(
        "https://example.org/auis-smoke-window",
      ),
    ),
  );
  assert.equal(
    app.windows().length,
    3,
    "external links must not open an Electron window",
  );

  // A prevented same-window navigation stays pending in Playwright CDP.
  // Check it last, without another action that waits for that navigation.
  await view
    .getByRole("link", { name: "External link", exact: true })
    .click({ noWaitAfter: true });
  await until("external link passed to browser", () =>
    app.evaluate(() =>
      globalThis.__externalLinks.includes("https://example.org/auis-smoke"),
    ),
  );
  assert.equal(view.url(), state.server.url + "/auis/styleguide");

  const firstPid = f.lock().pid;
  process.kill(firstPid, "SIGTERM");
  await projectState(chrome, "stopped");
  await snapshot(chrome, f.evidence, "stopped");
  await chrome
    .getByRole("button", { name: "Start again", exact: true })
    .click();
  await projectState(chrome, "running");
  assert.notEqual(f.lock().pid, firstPid);
  await quit(app, f.evidence);
  await clean(f);
});

test("quitting an attached project leaves its external server running", async (t) => {
  const f = fixture(t, "attached");
  const child = spawn(process.execPath, ["smoke-server.mjs"], {
    cwd: f.project,
    env: f.env,
    stdio: "ignore",
    detached: true,
  });
  // The external server's parent is this test runner, which cleanup must never signal.
  t.after(() => {
    if (child.pid && alive(child.pid)) child.kill("SIGTERM");
  });
  await until("external lock", f.lock);
  const app = await f.launch(true);
  const chrome = await app.firstWindow();
  await chrome.waitForURL("app://auis/project.html");
  const state = await projectState(chrome, "running");
  assert.equal(state.server.owned, false);
  await quit(app, f.evidence);
  assert.ok(alive(child.pid));
  assert.equal((await fetch(state.server.url)).status, 200);
  child.kill("SIGTERM");
  await until("external stopped by test owner", () => !alive(child.pid));
});

test("Close during startup cancels the project; the Mac app can reopen from the Dock", async (t) => {
  const f = fixture(t, "close-starting", { startDelay: 5000 });
  const app = await f.launch(true);
  const chrome = await app.firstWindow();
  await chrome.waitForURL("app://auis/project.html");
  await projectState(chrome, "starting");
  await until("fixture spawned", () => f.pids().length > 0);
  await snapshot(chrome, f.evidence, "starting");
  const win = await app.browserWindow(chrome);
  const closed = chrome.waitForEvent("close");
  await win.evaluate((window) => window.close());
  await closed;
  await clean(f);
  if (process.platform === "darwin") {
    assert.equal(app.process().exitCode, null);
    const reopened = app.waitForEvent("window");
    await app.evaluate(({ app }) => app.emit("activate"));
    const launcher = await reopened;
    await launcher.waitForURL("app://auis/launcher.html");
    await snapshot(launcher, f.evidence, "reopened");
    await quit(app, f.evidence);
  }
});

test("Close while Restart is pending never starts a replacement server", async (t) => {
  const f = fixture(t, "close-restart", { stopDelay: 500 });
  const app = await f.launch(true);
  const chrome = await app.firstWindow();
  await chrome.waitForURL("app://auis/project.html");
  await projectState(chrome, "running");
  const win = await app.browserWindow(chrome);
  await app.evaluate(({ app }) => app.focus({ steal: true }));
  await win.evaluate((window) => window.focus());
  await until(
    "restart available",
    async () => (await menuItem(app, "project-restart")).enabled,
  );
  const closed = chrome.waitForEvent("close");
  await app.evaluate(({ Menu, BrowserWindow }) => {
    const win = BrowserWindow.getFocusedWindow();
    const item = Menu.getApplicationMenu().getMenuItemById("project-restart");
    item.click(item, win, {});
    win.close();
  });
  await closed;
  assert.ok(
    f.pids().every((pid) => !alive(pid)),
    "Close must await Restart’s in-flight cleanup",
  );
  await clean(f);
  await quit(app, f.evidence);
});
