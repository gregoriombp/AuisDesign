import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_RECENT,
  RESERVED_FOR_THE_PAGE,
  menuTemplate,
  type ActiveProject,
  type MenuActions,
  type MenuContext,
  type RecentProject,
} from "../src/main/menu.ts";

type Item = ReturnType<typeof menuTemplate>[number];

const RUNNING: ActiveProject = { running: true, busy: false, canGoBack: true, canGoForward: false, logsOpen: false };
const STOPPED: ActiveProject = { running: false, busy: false, canGoBack: false, canGoForward: false, logsOpen: true };

function context(overrides: Partial<MenuContext> = {}): MenuContext {
  return { recent: [], project: null, development: false, ...overrides };
}

/** Actions that record what was called, so a click can be checked without Electron. */
function recorder() {
  const calls: string[] = [];
  const note = (name: string) => (...args: unknown[]) => void calls.push([name, ...args].join(":"));
  const actions: MenuActions = {
    openFolder: note("openFolder"),
    openProject: note("openProject"),
    showLauncher: note("showLauncher"),
    navigate: note("navigate"),
    zoom: note("zoom"),
    toggleLog: note("toggleLog"),
    inspectPage: note("inspectPage"),
    inspectChrome: note("inspectChrome"),
    restart: note("restart"),
    openInBrowser: note("openInBrowser"),
    revealInFinder: note("revealInFinder"),
    openHelp: note("openHelp"),
  };
  return { actions, calls };
}

function flatten(items: Item[]): Item[] {
  return items.flatMap((item) => [item, ...(Array.isArray(item.submenu) ? flatten(item.submenu) : [])]);
}

function build(overrides: Partial<MenuContext> = {}) {
  const { actions, calls } = recorder();
  const items = flatten(menuTemplate(context(overrides), actions));
  const byId = (id: string) => {
    const found = items.find((item) => item.id === id);
    assert.ok(found, `no menu item "${id}"`);
    return found;
  };
  const enabled = (id: string) => byId(id).enabled !== false;
  const click = (id: string) => (byId(id).click as () => void)();
  return { items, byId, enabled, click, calls };
}

const PAGE_COMMANDS = ["back", "forward", "reload", "zoom-reset", "zoom-in", "zoom-out", "inspect-page", "open-in-browser"];
const PROJECT_COMMANDS = ["toggle-log", "restart", "reveal"];

test("with no project in front, only what needs no project is enabled", () => {
  const menu = build();
  for (const id of [...PAGE_COMMANDS, ...PROJECT_COMMANDS]) assert.equal(menu.enabled(id), false, id);
  for (const id of ["open-folder", "show-launcher", "help"]) assert.equal(menu.enabled(id), true, id);
});

test("a running project enables the page commands, and history follows the page", () => {
  const menu = build({ project: RUNNING });
  for (const id of ["reload", "zoom-reset", "zoom-in", "zoom-out", "inspect-page", "open-in-browser"]) {
    assert.equal(menu.enabled(id), true, id);
  }
  for (const id of PROJECT_COMMANDS) assert.equal(menu.enabled(id), true, id);
  assert.equal(menu.enabled("back"), true);
  assert.equal(menu.enabled("forward"), false);
});

test("a project that is not running keeps its log, its folder and a way to start again", () => {
  const menu = build({ project: STOPPED });
  for (const id of PAGE_COMMANDS) assert.equal(menu.enabled(id), false, id);
  for (const id of PROJECT_COMMANDS) assert.equal(menu.enabled(id), true, id);
});

test("the server cannot be restarted while a start or an install is under way", () => {
  assert.equal(build({ project: { ...STOPPED, busy: true } }).enabled("restart"), false);
});

test("the log item says what it will do", () => {
  assert.equal(build({ project: RUNNING }).byId("toggle-log").label, "Show Log");
  assert.equal(build({ project: { ...RUNNING, logsOpen: true } }).byId("toggle-log").label, "Hide Log");
  assert.equal(build().byId("toggle-log").label, "Show Log");
});

test("each item does its own thing", () => {
  const expected: Record<string, string> = {
    "open-folder": "openFolder",
    back: "navigate:back",
    forward: "navigate:forward",
    reload: "navigate:reload",
    "zoom-reset": "zoom:reset",
    "zoom-in": "zoom:in",
    "zoom-out": "zoom:out",
    "toggle-log": "toggleLog",
    "inspect-page": "inspectPage",
    "inspect-chrome": "inspectChrome",
    restart: "restart",
    "open-in-browser": "openInBrowser",
    reveal: "revealInFinder",
    "show-launcher": "showLauncher",
    help: "openHelp",
  };
  const menu = build({ project: RUNNING, development: true });
  for (const [id, call] of Object.entries(expected)) {
    menu.calls.length = 0;
    menu.click(id);
    // A click handler is handed the menu item and more; only the action's name and its own argument matter.
    assert.equal(menu.calls.length, 1, id);
    assert.ok(menu.calls[0] === call || menu.calls[0].startsWith(`${call}:`), `${id} → ${menu.calls[0]}`);
  }
});

test("recent projects are listed by name, and a missing folder cannot be opened", () => {
  const recent: RecentProject[] = [
    { id: "a", name: "novah-hub", displayPath: "~/code/novah-hub", missing: false },
    { id: "b", name: "moved-away", displayPath: "~/old/moved-away", missing: true },
  ];
  const menu = build({ recent });
  assert.equal(menu.byId("recent:a").label, "novah-hub");
  assert.equal(menu.byId("recent:a").sublabel, "~/code/novah-hub");
  assert.equal(menu.enabled("recent:a"), true);
  assert.equal(menu.enabled("recent:b"), false);

  menu.click("recent:a");
  assert.deepEqual(menu.calls, ["openProject:a"]);
});

test("with no recent projects the submenu says so", () => {
  const menu = build();
  assert.equal(menu.byId("recent-none").label, "No Recent Projects");
  assert.equal(menu.enabled("recent-none"), false);
});

test("the recent list is capped", () => {
  const recent = Array.from({ length: MAX_RECENT + 5 }, (_unused, index) => ({
    id: String(index),
    name: `project-${index}`,
    displayPath: `~/p/${index}`,
    missing: false,
  }));
  const listed = build({ recent }).items.filter((item) => item.id?.startsWith("recent:"));
  assert.equal(listed.length, MAX_RECENT);
  assert.equal(listed[0].label, "project-0", "the most recent stay");
});

test("the inspector for the app's own window is offered only when running from source", () => {
  assert.ok(build({ development: true }).items.some((item) => item.id === "inspect-chrome"));
  assert.ok(!build({ development: false }).items.some((item) => item.id === "inspect-chrome"));
});

test("no shortcut is used twice", () => {
  const accelerators = build({ project: RUNNING, development: true })
    .items.map((item) => item.accelerator)
    .filter((accelerator): accelerator is string => typeof accelerator === "string")
    .map((accelerator) => accelerator.toLowerCase());
  assert.equal(new Set(accelerators).size, accelerators.length, accelerators.join(", "));
});

test("the menu takes none of the shortcuts the page uses for Auis's own modes", () => {
  const reserved = new Set(RESERVED_FOR_THE_PAGE.map((accelerator) => accelerator.toLowerCase()));
  for (const item of build({ project: RUNNING, development: true }).items) {
    if (typeof item.accelerator !== "string") continue;
    assert.ok(!reserved.has(item.accelerator.toLowerCase()), `${item.label} takes ${item.accelerator}`);
  }
});

test("page commands never use a stock role that would act on the app's own chrome", () => {
  // These roles act on whichever page has focus, which can be the toolbar.
  const focusBound = new Set(["reload", "forcereload", "toggledevtools", "resetzoom", "zoomin", "zoomout"]);
  for (const item of build({ project: RUNNING, development: true }).items) {
    assert.ok(!focusBound.has(String(item.role ?? "").toLowerCase()), `role ${item.role}`);
  }
});
