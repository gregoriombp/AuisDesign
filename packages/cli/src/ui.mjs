/**
 * Terminal output for the Auis CLI. No dependencies: colors degrade to plain
 * text when the stream is not a TTY or NO_COLOR is set, and the spinner is a
 * no-op outside a TTY so CI logs stay readable.
 */

const ESC = String.fromCharCode(27);

const supportsColor =
  Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && process.env.TERM !== "dumb";

const wrap = (open, close) => (text) =>
  supportsColor ? `${ESC}[${open}m${text}${ESC}[${close}m` : String(text);

export const color = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  cyan: wrap(36, 39),
};

export const write = (line = "") => process.stdout.write(`${line}\n`);

export const banner = (version) => {
  write();
  write(`  ${color.bold("auis")}  ${color.dim(version)}`);
  write(`  ${color.dim("code-native design builder")}`);
  write();
};

export const step = (label, detail = "") =>
  write(`  ${color.green("✓")} ${label.padEnd(10)}${color.dim(detail)}`);

export const warn = (message) => write(`  ${color.yellow("!")} ${message}`);

export const fail = (message) =>
  process.stderr.write(`\n  ${color.red("✗")} ${message}\n\n`);

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Returns a stop() that clears the line, so the caller can print the result. */
export function spinner(label) {
  if (!process.stdout.isTTY) {
    write(`  ${color.dim("…")} ${label}`);
    return () => {};
  }
  let i = 0;
  process.stdout.write(`${ESC}[?25l`);
  const timer = setInterval(() => {
    process.stdout.write(`\r  ${color.cyan(FRAMES[i++ % FRAMES.length])} ${label}`);
  }, 90);
  return () => {
    clearInterval(timer);
    process.stdout.write(`\r${ESC}[2K${ESC}[?25h`);
  };
}

/** The spinner hides the cursor; Ctrl-C must not leave it hidden. */
export function restoreCursorOnExit() {
  const restore = () => {
    if (process.stdout.isTTY) process.stdout.write(`${ESC}[?25h`);
  };
  process.on("exit", restore);
  process.on("SIGINT", () => {
    restore();
    write();
    process.exit(130);
  });
}

/** Single-question prompt. Falls back to the default when stdin is not a TTY. */
export async function ask(question, fallback) {
  if (!process.stdin.isTTY) return fallback;
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`  ${question} ${color.dim(`(${fallback})`)} `);
    return answer.trim() || fallback;
  } finally {
    rl.close();
  }
}
