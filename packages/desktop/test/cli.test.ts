// New project. The runs use a stand-in for the CLI (fixtures/fake-cli.mjs)
// started for real, in its own process group, because ending that group on a
// cancel is part of what is under test.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CLI_PACKAGE,
  cliArgs,
  createCreator,
  explainFailure,
  suggestTarget,
  whyNotTarget,
  type CreatorOptions,
} from "../src/main/cli.ts";
import { scrubEnv } from "../src/main/env.ts";
import { groupAlive } from "../src/main/processes.ts";
import type { CreateState } from "../src/shared/ipc.ts";
import { tempDir, until } from "./helpers.ts";

const FAKE_CLI = fileURLToPath(new URL("./fixtures/fake-cli.mjs", import.meta.url));

/** A creator whose CLI is the stand-in in `mode`, with every state it reported. */
function creatorFor(mode: string, extra: Partial<CreatorOptions> = {}) {
  const states: Array<CreateState | null> = [];
  let mode_ = mode;
  const creator = createCreator({
    onChange: () => states.push(creator.state()),
    resolveEnv: async () => scrubEnv(process.env),
    command: (target) => ({ file: process.execPath, args: [FAKE_CLI, target, mode_] }),
    stopGraceMs: 2_000,
    ...extra,
  });
  return { creator, states, setMode: (next: string) => void (mode_ = next) };
}

test("the CLI gets every answer up front, and never --force", () => {
  const args = cliArgs("/work/My App");
  assert.deepEqual(args, ["--yes", CLI_PACKAGE, "/work/My App", "--yes", "--pm", "npm", "--no-install"]);
  // npx reads its own flags only before the package; everything after goes to the CLI.
  assert.equal(args.indexOf(CLI_PACKAGE), 1);
  assert.ok(!args.includes("--force"));
});

test("the suggested folder is the first auis-app name that is free", () => {
  const parent = tempDir("suggest");
  assert.equal(suggestTarget(parent), path.join(parent, "auis-app"));
  fs.mkdirSync(path.join(parent, "auis-app"));
  fs.writeFileSync(path.join(parent, "auis-app-2"), "");
  assert.equal(suggestTarget(parent), path.join(parent, "auis-app-3"));
});

test("a target is refused only where the CLI would refuse it", () => {
  const parent = tempDir("target");
  assert.equal(whyNotTarget(path.join(parent, "fresh")), null, "a folder that does not exist yet");

  const empty = path.join(parent, "empty");
  fs.mkdirSync(empty);
  assert.equal(whyNotTarget(empty), null);

  // The CLI lets these through (packages/auis/src/create.mjs), so the app must too.
  const harmless = path.join(parent, "harmless");
  fs.mkdirSync(path.join(harmless, ".git"), { recursive: true });
  for (const file of [".DS_Store", "README.md", "LICENSE", ".gitignore"]) {
    fs.writeFileSync(path.join(harmless, file), "");
  }
  assert.equal(whyNotTarget(harmless), null);

  const taken = path.join(parent, "taken");
  fs.mkdirSync(taken);
  fs.writeFileSync(path.join(taken, "index.html"), "");
  assert.match(whyNotTarget(taken) ?? "", /already has files/);

  const file = path.join(parent, "a-file");
  fs.writeFileSync(file, "");
  assert.match(whyNotTarget(file) ?? "", /file already has that name/);

  assert.match(whyNotTarget(path.join(parent, "gone", "app")) ?? "", /no longer exists/);
});

test("a failure is explained from what the CLI printed", () => {
  assert.match(
    explainFailure(1, ["  ✗ could not download the template for ref \"main\"."]),
    /could not reach npm or GitHub/,
  );
  assert.match(explainFailure(1, ["npm error code ENOTFOUND"]), /could not reach npm or GitHub/);
  assert.equal(explainFailure(2, ["something else"]), "The Auis CLI stopped with code 2. Its output is below.");
  assert.match(explainFailure(null, []), /stopped before it finished/);
});

test("a run reports what the CLI prints, and ends with the folder once there is a project in it", async () => {
  const target = path.join(tempDir("create"), "My App");
  const { creator, states } = creatorFor("ok");
  const made = await creator.create(target);
  assert.equal(made, target);
  assert.equal(creator.state(), null, "a made project leaves nothing behind in the launcher");

  const during = states.filter((state) => state?.status === "creating");
  assert.equal(during[0]?.name, "My App");
  const last = during.at(-1);
  assert.ok(last && last.lines.some((line) => line.includes("✓ Project")), "the output reached the state");
  assert.ok(last.lines.every((line) => line.trim() !== ""), "no blank lines");
});

test("a failed run says why, keeps the output, and can be tried again while the folder is empty", async () => {
  const target = path.join(tempDir("offline"), "app");
  const { creator, setMode } = creatorFor("offline");
  assert.equal(await creator.create(target), null);
  const failed = creator.state();
  assert.equal(failed?.status, "error");
  assert.ok(failed?.status === "error");
  assert.match(failed.message, /could not reach npm or GitHub/);
  assert.ok(failed.lines.some((line) => line.includes("could not download")));
  assert.equal(failed.canRetry, true);

  setMode("ok");
  assert.equal(await creator.retry(), target);
  assert.equal(creator.state(), null);
});

test("a run that leaves files behind cannot be tried again, only dismissed", async () => {
  const target = path.join(tempDir("partial"), "app");
  const { creator } = creatorFor("partial");
  assert.equal(await creator.create(target), null);
  const failed = creator.state();
  assert.ok(failed?.status === "error");
  assert.equal(failed.canRetry, false);
  assert.equal(await creator.retry(), null, "retry does nothing when the CLI would refuse the folder");
  creator.dismiss();
  assert.equal(creator.state(), null);
});

test("a folder the CLI fills with something that cannot run is an error, not a project", async () => {
  const target = path.join(tempDir("nodev"), "app");
  const { creator } = creatorFor("nodev");
  assert.equal(await creator.create(target), null);
  const failed = creator.state();
  assert.ok(failed?.status === "error");
  assert.match(failed.message, /no dev script/);
});

test("a folder that already has files is refused before anything runs", async () => {
  const target = tempDir("refused");
  fs.writeFileSync(path.join(target, "notes.txt"), "");
  let ran = false;
  const { creator } = creatorFor("ok", {
    command: () => {
      ran = true;
      return { file: process.execPath, args: ["-e", ""] };
    },
  });
  assert.equal(await creator.create(target), null);
  assert.equal(ran, false);
  assert.ok(creator.state()?.status === "error");
});

test("without npx on the PATH, the run says so instead of failing to spawn", async () => {
  const target = path.join(tempDir("no-npx"), "app");
  const creator = createCreator({
    onChange: () => {},
    resolveEnv: async () => ({ PATH: tempDir("empty-path") }),
  });
  assert.equal(await creator.create(target), null);
  const failed = creator.state();
  assert.ok(failed?.status === "error");
  assert.match(failed.message, /npx was not found/);
});

test("cancel ends the CLI's whole process group and reports nothing after", async () => {
  const target = path.join(tempDir("cancel"), "app");
  const { creator } = creatorFor("hang");
  const made = creator.create(target);
  const pid = await until("the stand-in is running", () => {
    try {
      return Number(fs.readFileSync(`${target}.pid`, "utf8"));
    } catch {
      return null;
    }
  });
  assert.equal(creator.busy(), true);
  await creator.cancel();
  assert.equal(groupAlive(pid), false, "nothing the run started is left");
  assert.equal(await made, null);
  assert.equal(creator.state(), null);
  assert.equal(creator.busy(), false);
});

test("a second create while one runs is ignored", async () => {
  const parent = tempDir("twice");
  const { creator } = creatorFor("hang");
  const first = creator.create(path.join(parent, "one"));
  await until("the first run started", () => fs.existsSync(path.join(parent, "one.pid")));
  assert.equal(await creator.create(path.join(parent, "two")), null);
  assert.equal(creator.state()?.name, "one");
  await creator.cancel();
  await first;
});
