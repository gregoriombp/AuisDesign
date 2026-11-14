// The projects the app has opened, most recent first, kept in one small JSON
// file in the app's data folder.
//
// A project is its folder's real path: Auis keys a project's data and backups
// on that path, so two spellings of one folder must stay one project.
//
// This module does not import `electron`, so it runs under `node --test`.

import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface Project {
  id: string;
  /** The folder's real path. Never sent to a renderer. */
  path: string;
  name: string;
  lastOpenedAt: number;
}

export function projectId(realPath: string): string {
  return createHash("sha256").update(realPath).digest("hex").slice(0, 16);
}

/** `~/code/app` instead of `/Users/someone/code/app`: for reading, not for opening. */
export function displayPath(realPath: string, home: string = os.homedir()): string {
  return realPath === home || realPath.startsWith(home + path.sep)
    ? `~${realPath.slice(home.length)}`
    : realPath;
}

function isProject(value: unknown): value is Project {
  if (typeof value !== "object" || value === null) return false;
  const { id, path: folder, name, lastOpenedAt } = value as Record<string, unknown>;
  return (
    typeof id === "string" &&
    typeof folder === "string" &&
    path.isAbsolute(folder) && id === projectId(folder) &&
    typeof name === "string" &&
    typeof lastOpenedAt === "number" && Number.isFinite(lastOpenedAt)
  );
}

export interface ProjectStore {
  list(): Project[];
  get(id: string): Project | null;
  /** Adds the folder, or moves it to the top if it is already known. */
  open(folder: string): Project;
  remove(id: string): void;
}

export function createProjectStore(file: string): ProjectStore {
  const read = (): Project[] => {
    try {
      const data: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
      return Array.isArray(data) ? data.filter(isProject) : [];
    } catch {
      // Missing or unreadable: start from an empty list rather than refuse to open.
      return [];
    }
  };

  const write = (projects: Project[]) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Write beside the file and rename, so a crash mid-write cannot leave half a list.
    const draft = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(draft, `${JSON.stringify(projects, null, 2)}\n`);
    fs.renameSync(draft, file);
  };

  const sorted = () => read().sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);

  return {
    list: sorted,
    get: (id) => read().find((project) => project.id === id) ?? null,
    open(folder) {
      const real = fs.realpathSync(folder);
      if (!fs.statSync(real).isDirectory()) throw new Error("Choose a project folder, not a file.");
      const project: Project = {
        id: projectId(real),
        path: real,
        name: path.basename(real),
        lastOpenedAt: Date.now(),
      };
      write([project, ...read().filter((other) => other.id !== project.id)]);
      return project;
    },
    remove(id) {
      write(read().filter((project) => project.id !== id));
    },
  };
}
