/**
 * Fetching the Auis template. Preferred path is the GitHub tarball (no git
 * required, no history dragged along); `git clone --depth 1` is the fallback
 * for environments without `tar` or without HTTPS access to codeload.
 */

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const REPO = "gregoriombp/AuisDesign";
export const REPO_URL = `https://github.com/${REPO}`;
export const DEFAULT_REF = "main";

/**
 * A ref can be a branch, a tag or a commit SHA and codeload spells each one
 * differently, so we try all three shapes in order.
 */
export function tarballUrls(ref = DEFAULT_REF) {
  const base = `https://codeload.github.com/${REPO}/tar.gz`;
  return [`${base}/refs/heads/${ref}`, `${base}/refs/tags/${ref}`, `${base}/${ref}`];
}

/** Runs a command, resolving with its exit code and captured stderr. */
export function exec(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: options.inherit ? "inherit" : ["ignore", "ignore", "pipe"],
      cwd: options.cwd,
      shell: false,
      env: options.env ?? process.env,
    });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => resolve({ ok: false, code: -1, stderr: error.message }));
    child.on("close", (code) => resolve({ ok: code === 0, code, stderr: stderr.trim() }));
  });
}

export async function hasCommand(command, args = ["--version"]) {
  const { ok } = await exec(command, args);
  return ok;
}

async function downloadTarball(ref, file) {
  const errors = [];
  for (const url of tarballUrls(ref)) {
    let response;
    try {
      response = await fetch(url, { redirect: "follow" });
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
      continue;
    }
    if (!response.ok || !response.body) {
      errors.push(`${url}: HTTP ${response.status}`);
      continue;
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
    return;
  }
  throw new Error(
    `could not download the template for ref "${ref}".\n    ${errors.join("\n    ")}`,
  );
}

/**
 * Downloads and unpacks the template into a fresh staging directory, returning
 * its path. The caller owns the directory and is responsible for removing it.
 */
export async function fetchTemplate(ref = DEFAULT_REF) {
  const staging = await fs.mkdtemp(path.join(os.tmpdir(), "auis-"));
  const contents = path.join(staging, "template");
  await fs.mkdir(contents);

  if (await hasCommand("tar")) {
    try {
      const archive = path.join(staging, "auis.tar.gz");
      await downloadTarball(ref, archive);
      const untar = await exec("tar", [
        "-xzf",
        archive,
        "-C",
        contents,
        "--strip-components=1",
      ]);
      if (!untar.ok) throw new Error(untar.stderr || `tar exited with ${untar.code}`);
      await fs.rm(archive, { force: true });
      return { dir: staging, contents, source: "tarball" };
    } catch (error) {
      await fs.rm(contents, { recursive: true, force: true });
      await fs.mkdir(contents);
      if (!(await hasCommand("git"))) {
        await fs.rm(staging, { recursive: true, force: true });
        throw error;
      }
    }
  }

  const clone = await exec("git", [
    "clone",
    "--depth",
    "1",
    "--branch",
    ref,
    REPO_URL,
    contents,
  ]);
  if (!clone.ok) {
    await fs.rm(staging, { recursive: true, force: true });
    throw new Error(
      `could not fetch the template (tarball and git clone both failed).\n    ${clone.stderr}`,
    );
  }
  await fs.rm(path.join(contents, ".git"), { recursive: true, force: true });
  return { dir: staging, contents, source: "git" };
}
