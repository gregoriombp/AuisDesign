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

/**
 * A checkbox menu in the terminal: ↑/↓ to move, space to toggle, a for all,
 * enter to confirm, Esc to leave. Rows that cannot be picked stay visible,
 * dimmed, with their reason. Resolves to the finished picker state (see
 * modules.mjs), or null when stdin is not a TTY.
 */
export async function pickMany(title, rows, { initialPicker, pickerReducer }) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return null;
  const readline = await import("node:readline");
  let state = initialPicker(rows);
  let drawn = 0;

  const render = () => {
    if (drawn > 0) process.stdout.write(`${ESC}[${drawn}A${ESC}[0J`);
    const lines = [`  ${color.bold(title)}  ${color.dim("↑↓ move · space toggle · a all · enter install · esc cancel")}`, ""];
    const width = Math.max(...state.rows.map((r) => r.label.length)) + 2;
    state.rows.forEach((row, i) => {
      const pointer = i === state.cursor ? color.cyan("❯") : " ";
      const box = row.selectable ? (state.checked.includes(row.id) ? color.green("◉") : "◯") : color.dim("◯");
      const label = row.selectable ? color.bold(row.label.padEnd(width)) : color.dim(row.label.padEnd(width));
      lines.push(`  ${pointer} ${box} ${label}${color.dim(row.summary)}`);
      if (!row.selectable) lines.push(`        ${" ".repeat(width)}${color.dim(row.note)}`);
    });
    lines.push("", state.hint ? `  ${color.yellow("!")} ${state.hint}` : "");
    process.stdout.write(`${lines.join("\n")}\n`);
    drawn = lines.length;
  };

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdout.write(`${ESC}[?25l`);
  render();
  try {
    return await new Promise((resolve) => {
      const onKey = (_str, key = {}) => {
        const name =
          key.ctrl && key.name === "c" ? "cancel"
            : key.name === "escape" ? "cancel"
              : key.name === "return" ? "enter"
                : key.name === "space" ? "space"
                  : key.name === "up" || key.name === "k" ? "up"
                    : key.name === "down" || key.name === "j" ? "down"
                      : key.name === "a" ? "all"
                        : null;
        if (!name) return;
        state = pickerReducer(state, name);
        render();
        if (state.done || state.cancelled) {
          process.stdin.off("keypress", onKey);
          resolve(state);
        }
      };
      process.stdin.on("keypress", onKey);
    });
  } finally {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write(`${ESC}[?25h`);
  }
}
