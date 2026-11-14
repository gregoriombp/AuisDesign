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

/** What the person can do about a start that failed: try again, or install the dependencies first. */
export type StartAction = "retry" | "install";

export type ServerState =
  | { status: "idle" }
  | { status: "starting"; phase: "environment" | "server" | "response" }
  /** `command` is what is running, e.g. `npm install`. */
  | { status: "installing"; command: string }
  | { status: "running"; url: string; port: number; owned: boolean }
  | { status: "stopped"; code: number | null }
  | { status: "error"; message: string; action: StartAction };

/**
 * Shown under the toolbar when an Auis project's server is not on port 3000.
 * The agent skills look for the bridge there unless `BRIDGE_BASE` says
 * otherwise, so a skill run for this project would reach another one's.
 */
export interface PortNotice {
  port: number;
  /** The line to run in the agent's terminal, e.g. `export BRIDGE_BASE=http://127.0.0.1:3001`. */
  command: string;
}

export interface ProjectState {
  name: string;
  displayPath: string;
  /** True when the project has the Auis surfaces, so their shortcuts make sense. */
  hasAuis: boolean;
  notice: PortNotice | null;
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
    /** Installs the project's dependencies, then starts it. */
    install(): Promise<void>;
    openInBrowser(): Promise<void>;
    /** Puts the port notice's command on the clipboard. The main process knows the text. */
    copyNoticeCommand(): Promise<void>;
    dismissNotice(): Promise<void>;
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
  projectInstall: "project:install",
  projectOpenInBrowser: "project:open-in-browser",
  projectCopyNoticeCommand: "project:copy-notice-command",
  projectDismissNotice: "project:dismiss-notice",
} as const;

/** Layout the main process and the toolbar agree on, in CSS pixels. */
export const TOOLBAR_HEIGHT = 52;
export const NOTICE_HEIGHT = 44;
export const LOGS_HEIGHT = 260;

/** The port the agent skills assume when `BRIDGE_BASE` is not set. */
export const DEFAULT_BRIDGE_PORT = 3000;
