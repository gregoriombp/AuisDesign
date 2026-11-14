import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createProjectStore, displayPath, projectId } from "../src/main/projects.ts";
import { sleep, tempDir } from "./helpers.ts";

function setup() {
  const root = tempDir("projects");
  const folder = (name: string) => {
    const dir = path.join(root, name);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };
  // A nested path: the store has to create the folder its file lives in.
  return { store: createProjectStore(path.join(root, "data", "projects.json")), folder, root };
}

test("opening a folder adds it, named after the folder", () => {
  const { store, folder } = setup();
  const opened = store.open(folder("novah-hub"));
  assert.equal(opened.name, "novah-hub");
  assert.equal(opened.id, projectId(opened.path));
  assert.deepEqual(store.list().map((project) => project.name), ["novah-hub"]);
  assert.equal(store.get(opened.id)?.path, opened.path);
});

test("the most recently opened project comes first, and is never listed twice", async () => {
  const { store, folder } = setup();
  const first = folder("first");
  store.open(first);
  await sleep(5);
  store.open(folder("second"));
  assert.deepEqual(store.list().map((project) => project.name), ["second", "first"]);

  await sleep(5);
  store.open(first);
  assert.deepEqual(store.list().map((project) => project.name), ["first", "second"]);
});

test("two spellings of one folder are one project", () => {
  const { store, folder, root } = setup();
  const real = folder("real");
  const link = path.join(root, "link");
  fs.symlinkSync(real, link);

  const viaLink = store.open(link);
  const direct = store.open(real);
  assert.equal(viaLink.id, direct.id);
  assert.equal(viaLink.path, direct.path);
  assert.equal(store.list().length, 1);
});

test("a project can be forgotten", () => {
  const { store, folder } = setup();
  const kept = store.open(folder("kept"));
  const dropped = store.open(folder("dropped"));
  store.remove(dropped.id);
  assert.deepEqual(store.list().map((project) => project.id), [kept.id]);
  assert.equal(store.get(dropped.id), null);
});

test("the list survives a new store on the same file", () => {
  const { store, folder, root } = setup();
  store.open(folder("persisted"));
  const again = createProjectStore(path.join(root, "data", "projects.json"));
  assert.deepEqual(again.list().map((project) => project.name), ["persisted"]);
});

test("an unreadable file is an empty list, not a crash", () => {
  const { store, folder, root } = setup();
  const file = path.join(root, "data", "projects.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });

  fs.writeFileSync(file, "{ not json");
  assert.deepEqual(store.list(), []);

  // Entries that are not projects are dropped; the rest of the list is kept.
  fs.writeFileSync(file, JSON.stringify([{ id: 1 }, "x", { id: "a", path: "/p", name: "p", lastOpenedAt: 1 }]));
  assert.deepEqual(store.list().map((project) => project.name), ["p"]);

  // And opening a folder repairs the file.
  fs.writeFileSync(file, "{ not json");
  store.open(folder("fresh"));
  assert.deepEqual(store.list().map((project) => project.name), ["fresh"]);
});

test("a write leaves no draft file behind", () => {
  const { store, folder, root } = setup();
  store.open(folder("one"));
  assert.deepEqual(fs.readdirSync(path.join(root, "data")), ["projects.json"]);
});

test("the home folder is shortened for reading", () => {
  assert.equal(displayPath("/Users/ana/code/app", "/Users/ana"), "~/code/app");
  assert.equal(displayPath("/Users/ana", "/Users/ana"), "~");
  assert.equal(displayPath("/Users/anabel/code", "/Users/ana"), "/Users/anabel/code");
  assert.equal(displayPath("/opt/app", "/Users/ana"), "/opt/app");
});
