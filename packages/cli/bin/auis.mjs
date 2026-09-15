#!/usr/bin/env node
import { run } from "../src/cli.mjs";
import { fail, restoreCursorOnExit } from "../src/ui.mjs";

restoreCursorOnExit();

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code ?? 0;
  })
  .catch((error) => {
    fail(error?.stack ?? String(error));
    process.exitCode = 1;
  });
