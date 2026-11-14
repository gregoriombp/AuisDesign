// Shared by the tests: throwaway folders, and a way to wait for something that
// happens in another process.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";

const created: string[] = [];

after(() => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

/** A new empty folder, removed when the test file finishes. Its real path, as macOS's /var is a link. */
export function tempDir(label: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `auis-desktop-${label}-`)));
  created.push(dir);
  return dir;
}

export function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Waits until `check` returns something truthy, and returns it. Fails with `what` after `timeoutMs`. */
export async function until<T>(
  what: string,
  check: () => T | null | undefined | false,
  timeoutMs = 15_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(25);
  }
}
