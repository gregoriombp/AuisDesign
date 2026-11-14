// The contract between the main process and the app's own chrome (the
// launcher and the project toolbar). The renderers never see an absolute path
// they could send back, and never a URL to load: they send project ids and
// in-app routes, and the main process decides what those mean.

export type ToolName = "node" | "npm" | "git" | "claude" | "codex";

export interface ToolInfo {
  name: ToolName;
  /** Null when the tool is not on the user's PATH. */
  version: string | null;
}

export type ProjectStatus = "open" | "running" | "stopped" | "missing";

export interface ProjectSummary {
  id: string;
  name: string;
  /** For reading only: the home folder is shortened to `~`. */
  displayPath: string;
  status: ProjectStatus;
  /** The dev server's port, when one is running. */
  port: number | null;
}

export interface LauncherState {
  projects: ProjectSummary[];
  /** Null while the environment is still being read. */
  tools: ToolInfo[] | null;
}

export type ServerState =
  | { status: "idle" }
  | { status: "starting"; phase: "environment" | "server" | "response" }
  | { status: "running"; url: string; port: number; owned: boolean }
  | { status: "stopped"; code: number | null }
  | { status: "error"; message: string };

export interface ProjectState {
  name: string;
  displayPath: string;
  /** True when the project has the Auis surfaces, so their shortcuts make sense. */
  hasAuis: boolean;
  server: ServerState;
  /** The route the project view is on, e.g. `/auis/styleguide`. */
  route: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  logsOpen: boolean;
}

export type NavigateAction =
  | { type: "back" }
  | { type: "forward" }
  | { type: "reload" }
  | { type: "route"; route: string };

/** What the preload exposes as `window.auisDesktop`. */
export interface DesktopBridge {
  launcher: {
    state(): Promise<LauncherState>;
    onState(listener: (state: LauncherState) => void): () => void;
    openFolder(): Promise<void>;
    openProject(id: string): Promise<void>;
    removeProject(id: string): Promise<void>;
  };
  project: {
    state(): Promise<ProjectState | null>;
    onState(listener: (state: ProjectState) => void): () => void;
    logs(): Promise<string[]>;
    onLog(listener: (lines: string[]) => void): () => void;
    navigate(action: NavigateAction): Promise<void>;
    setLogsOpen(open: boolean): Promise<void>;
    restart(): Promise<void>;
    openInBrowser(): Promise<void>;
  };
}

export const CHANNELS = {
  launcherState: "launcher:state",
  launcherChanged: "launcher:changed",
  launcherOpenFolder: "launcher:open-folder",
  launcherOpenProject: "launcher:open-project",
  launcherRemoveProject: "launcher:remove-project",
  projectState: "project:state",
  projectChanged: "project:changed",
  projectLogs: "project:logs",
  projectLog: "project:log",
  projectNavigate: "project:navigate",
  projectSetLogsOpen: "project:set-logs-open",
  projectRestart: "project:restart",
  projectOpenInBrowser: "project:open-in-browser",
} as const;

/** Layout the main process and the toolbar agree on, in CSS pixels. */
export const TOOLBAR_HEIGHT = 52;
export const LOGS_HEIGHT = 260;
