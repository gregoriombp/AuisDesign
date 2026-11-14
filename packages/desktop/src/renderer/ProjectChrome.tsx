// The project window's chrome: a toolbar above the project's pages, a message
// in their place while there is nothing to show, and the dev-server log in a
// strip at the bottom. The pages themselves are a separate view the main
// process lays out between the toolbar and the log; this page never draws over
// them.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ProjectState, ServerState } from "../shared/ipc.ts";
import { desktop, Icon, IconButton, Status, type Tone } from "./ui.tsx";
import { bridgeNotice, webOrigin } from "../shared/workspace.ts";
import { PORT_NOTICE_HEIGHT } from "../shared/ipc.ts";

const SURFACES = [
  { label: "Hub", route: "/auis", exact: true },
  { label: "Styleguide", route: "/auis/styleguide" },
  { label: "States", route: "/auis/states" },
  { label: "Review", route: "/auis/review-bridge" },
  { label: "Flows", route: "/auis/ux-flow" },
];

const PHASE: Record<"environment" | "server" | "response", string> = {
  environment: "Reading your shell environment.",
  server: "Running the project's dev script.",
  response: "Waiting for the first response.",
};

const MAX_LINES = 2000;

function serverStatus(server: ServerState): {
  tone: Tone;
  label: string;
  port: string;
  hint: string;
} {
  if (server.status === "running") {
    return {
      tone: "success",
      label: "Running",
      port: `:${server.port}`,
      hint: server.owned
        ? "Auis Design started this dev server and stops it when the window closes."
        : "Attached to a dev server that was already running. Auis Design leaves it running.",
    };
  }
  if (server.status === "starting")
    return { tone: "busy", label: "Starting", port: "", hint: "" };
  if (server.status === "installing")
    return { tone: "busy", label: "Installing", port: "", hint: "" };
  if (server.status === "deps-missing")
    return { tone: "idle", label: "Setup needed", port: "", hint: "" };
  if (server.status === "error")
    return { tone: "danger", label: "Not running", port: "", hint: "" };
  if (server.status === "stopped")
    return { tone: "danger", label: "Stopped", port: "", hint: "" };
  return { tone: "idle", label: "Idle", port: "", hint: "" };
}

function StageState({ state }: { state: ProjectState }) {
  const { server, name } = state;
  if (server.status === "running" || server.status === "idle") return null;

  let icon = "progress_activity";
  let title = `Starting ${name}`;
  let detail = "";
  let action: string | null = null;
  if (server.status === "starting") {
    detail = PHASE[server.phase];
  } else if (server.status === "installing") {
    title = "Installing dependencies";
    detail = `Running ${server.packageManager} install. The log shows its progress.`;
  } else if (server.status === "deps-missing") {
    icon = "download";
    title = "Install this project's dependencies";
    detail = `${server.missing.length} ${server.missing.length === 1 ? "dependency is" : "dependencies are"} missing. This runs ${server.packageManager} install, including the project's install scripts, then starts the dev server.`;
    action = "Install dependencies";
  } else if (server.status === "error") {
    icon = "error";
    title = `${name} could not start`;
    detail = server.message;
    action = "Try again";
  } else {
    icon = "power_settings_new";
    title = "The dev server stopped";
    detail =
      server.code === null
        ? "It was stopped from outside the app."
        : `It exited with code ${server.code}. The log has the details.`;
    action = "Start again";
  }

  return (
    <div className="stage-state" data-logs={state.logsOpen}>
      <div className="state" role="status">
        <span className="state-mark">
          <Icon
            name={icon}
            className={
              server.status === "starting" || server.status === "installing"
                ? "spin"
                : undefined
            }
          />
        </span>
        <h2>{title}</h2>
        <p>{detail}</p>
        {action && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              void (server.status === "deps-missing"
                ? desktop.project.install()
                : desktop.project.restart())
            }
          >
            {action}
          </button>
        )}
      </div>
    </div>
  );
}

function PortNotice({ command, url }: { command: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <aside
      className="port-notice"
      style={{ height: PORT_NOTICE_HEIGHT }}
      aria-label="Project bridge address"
    >
      <p>
        Before running a skill for this project, set its bridge address:{" "}
        <code>{command}</code>
      </p>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          void desktop.project.copyBridgeCommand().then(() => setCopied(true));
        }}
        aria-label={`Copy bridge command for ${webOrigin(url)}`}
      >
        {copied ? "Copied" : "Copy command"}
      </button>
    </aside>
  );
}

function Logs({ onClose }: { onClose: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const body = useRef<HTMLPreElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    let live = true;
    let revision = 0;
    // A buffered event can contain lines already in the initial snapshot. Read
    // the bounded history on each batch instead of appending those lines twice.
    const refresh = () => {
      const request = ++revision;
      void desktop.project.logs().then((all) => {
        if (live && request === revision) setLines(all.slice(-MAX_LINES));
      });
    };
    const off = desktop.project.onLog(refresh);
    refresh();
    return () => {
      live = false;
      off();
    };
  }, []);

  // Follow the tail, unless the reader scrolled up to look at something.
  useLayoutEffect(() => {
    const element = body.current;
    if (element && pinned.current) element.scrollTop = element.scrollHeight;
  }, [lines]);

  return (
    <section className="logs" aria-label="Dev server log">
      <div className="logs-head">
        Dev server
        <IconButton icon="close" label="Hide the log" onClick={onClose} />
      </div>
      <pre
        ref={body}
        className="logs-body scroll"
        tabIndex={0}
        onScroll={(event) => {
          const element = event.currentTarget;
          pinned.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            24;
        }}
      >
        {lines.length > 0 ? (
          lines.join("\n")
        ) : (
          <span className="logs-empty">Nothing printed yet.</span>
        )}
      </pre>
    </section>
  );
}

export function ProjectChrome() {
  const [state, setState] = useState<ProjectState | null>(null);

  useEffect(() => {
    void desktop.project
      .state()
      .then((initial) => initial && setState(initial));
    return desktop.project.onState(setState);
  }, []);

  if (!state) return null;

  const running = state.server.status === "running";
  const status = serverStatus(state.server);
  const command = bridgeNotice(state.server);
  const setLogs = (open: boolean) => void desktop.project.setLogsOpen(open);

  return (
    <>
      <header className="toolbar">
        <IconButton
          icon="arrow_back"
          label="Back"
          disabled={!state.canGoBack}
          onClick={() => void desktop.project.navigate({ type: "back" })}
        />
        <IconButton
          icon="arrow_forward"
          label="Forward"
          disabled={!state.canGoForward}
          onClick={() => void desktop.project.navigate({ type: "forward" })}
        />
        <IconButton
          icon="refresh"
          label="Reload"
          disabled={!running}
          spinning={running && state.loading}
          onClick={() => void desktop.project.navigate({ type: "reload" })}
        />

        <div className="address" title={state.displayPath}>
          <span className="address-name">{state.name}</span>
          {running && <span className="address-route">{state.route}</span>}
        </div>

        {state.hasAuis && running && (
          <nav className="surfaces" aria-label="Auis surfaces">
            {SURFACES.map((surface) => {
              const current = surface.exact
                ? state.route === surface.route
                : state.route.startsWith(surface.route);
              return (
                <button
                  type="button"
                  className="surface"
                  key={surface.route}
                  aria-current={current ? "page" : undefined}
                  onClick={() =>
                    void desktop.project.navigate({
                      type: "route",
                      route: surface.route,
                    })
                  }
                >
                  {surface.label}
                </button>
              );
            })}
          </nav>
        )}

        <div className="toolbar-gap" />

        <Status tone={status.tone} title={status.hint || undefined}>
          {status.label}
          {status.port && <span className="tabular">{status.port}</span>}
        </Status>
        <IconButton
          icon="terminal"
          label={
            state.logsOpen
              ? "Hide the dev server log"
              : "Show the dev server log"
          }
          pressed={state.logsOpen}
          onClick={() => setLogs(!state.logsOpen)}
        />
        <IconButton
          icon="open_in_new"
          label="Open this page in your browser"
          disabled={!running}
          onClick={() => void desktop.project.openInBrowser()}
        />
      </header>

      {command && state.server.status === "running" && (
        <PortNotice key={command} command={command} url={state.server.url} />
      )}

      <StageState state={state} />
      {state.logsOpen && <Logs onClose={() => setLogs(false)} />}
    </>
  );
}
