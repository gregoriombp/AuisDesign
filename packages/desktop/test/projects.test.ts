import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createProjectStore,
  displayPath,
  projectId,
} from "../src/main/projects.ts";
import { temp, write } from "./helpers.ts";
test("realpath deduplicates symlinks, and forgetting never deletes the folder", (t) => {
  const root = temp(t);
  fs.mkdirSync(root + "/project");
  fs.symlinkSync(root + "/project", root + "/alias");
  const store = createProjectStore(root + "/profile/projects.json");
  const a = store.open(root + "/project");
  const b = store.open(root + "/alias");
  assert.equal(a.id, b.id);
  assert.equal(store.list().length, 1);
  store.remove(a.id);
  assert.deepEqual(store.list(), []);
  assert.ok(fs.existsSync(root + "/project"));
  assert.deepEqual(fs.readdirSync(root + "/profile"), ["projects.json"]);
});
test("invalid saved entries are ignored; missing folders remain locatable", (t) => {
  const root = temp(t);
  const file = root + "/projects.json";
  const store = createProjectStore(file);
  write(root, "projects.json", "broken");
  assert.deepEqual(store.list(), []);
  const valid = {
    id: projectId(root + "/gone"),
    path: root + "/gone",
    name: "Gone",
    lastOpenedAt: 100,
  };
  write(root, "projects.json", [
    null,
    {},
    { ...valid, path: "relative" },
    { ...valid, id: "wrong" },
    valid,
  ]);
  assert.deepEqual(store.list(), [valid]);
  assert.equal(store.get(valid.id)?.name, "Gone");
  assert.throws(() => store.open(file), /folder/);
});
test("home abbreviation does not shorten a sibling path", () => {
  assert.equal(displayPath("/Users/greg/code", "/Users/greg"), "~/code");
  assert.equal(
    displayPath("/Users/gregory/code", "/Users/greg"),
    "/Users/gregory/code",
  );
});
