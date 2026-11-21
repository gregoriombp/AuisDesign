// What the app needs from the processes it starts (a dev server, an install,
// the Auis CLI): a way to end each one with everything it forked, and what it
// printed, as lines a person can read.
//
// Every one of them is spawned `detached`, which makes it the leader of its own
// process group. Signalling the group (a negative pid) reaches the package
// manager, Next and whatever they started, not only the process we spawned.
//
// This module does not import `electron`, so it runs under `node --test`.

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");

/** Printed output as the lines worth showing: no colour codes, no blank lines, no trailing spaces. */
export function outputLines(text: string): string[] {
  return stripAnsi(text)
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

export function groupAlive(pgid: number): boolean {
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

/** Ask first, so Next removes its lock, then insist after `graceMs`. */
export async function endGroup(pgid: number | undefined, graceMs: number): Promise<void> {
  if (!pgid || !groupAlive(pgid)) return;
  signalGroup(pgid, "SIGTERM");
  const deadline = Date.now() + graceMs;
  while (groupAlive(pgid) && Date.now() < deadline) await sleep(50);
  if (!groupAlive(pgid)) return;
  signalGroup(pgid, "SIGKILL");
  while (groupAlive(pgid) && Date.now() < deadline + 2000) await sleep(25);
}
