#!/usr/bin/env node
/**
 * Alias entry point, so `npm create auis@latest my-product` works.
 * All behaviour lives in the `@auis/cli` package — this only forwards.
 */
import { restoreCursorOnExit, run } from "@auis/cli";

restoreCursorOnExit();

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code ?? 0;
  })
  .catch((error) => {
    process.stderr.write(`${error?.stack ?? String(error)}\n`);
    process.exitCode = 1;
  });
