// The launcher: the app's home. One job — get into a project — so the most
// recent project carries the screen's only primary button, and everything else
// is a quieter way to the same place. Before there is a project, the primary
// button makes one.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { CreateState, LauncherState, ProjectSummary, ToolInfo, ToolName } from "../shared/ipc.ts";
import { FolderPreview, NewProjectPreview, ProjectPreview } from "./previews.tsx";
import { desktop, Icon, IconButton, Status, type Tone } from "./ui.tsx";

const TOOL_LABEL: Record<ToolName, string> = {
  node: "Node",
  npm: "npm",
  git: "Git",
  claude: "Claude Code",
  codex: "Codex",
};

/** Node, npm and git run the project. The agents are optional. */
const REQUIRED = new Set<ToolName>(["node", "npm", "git"]);

const order = (index: number) => ({ "--order": index }) as CSSProperties;

function projectStatus(project: ProjectSummary): { tone: Tone; label: string } {
  const port = project.port ? ` on :${project.port}` : "";
  if (project.status === "open") return { tone: "success", label: `Open${port}` };
  if (project.status === "running") return { tone: "success", label: `Running${port}` };
  if (project.status === "missing") return { tone: "danger", label: "Folder not found" };
  return { tone: "idle", label: "Stopped" };
}

function Featured({ project }: { project: ProjectSummary | null }) {
  if (!project) {
    return (
      <section className="card" style={order(0)}>
        <div className="stage">
          <ProjectPreview empty />
        </div>
        <div className="card-foot">
          <div className="card-text">
            <h2 className="card-title">
              <span>No project yet</span>
            </h2>
            <p className="card-support">Start one from the Auis template, or open a folder.</p>
          </div>
          <div className="card-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void desktop.launcher.openFolder()}>
              Open folder
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void desktop.launcher.newProject()}>
              New project
              <Icon name="arrow_forward" size={16} />
            </button>
          </div>
        </div>
      </section>
    );
  }

  const status = projectStatus(project);
  const missing = project.status === "missing";
  return (
    <section className="card" style={order(0)}>
      <div className="stage">
        <ProjectPreview empty={missing} />
      </div>
      <div className="card-foot">
        <div className="card-text">
          <h2 className="card-title">
            <span>{project.name}</span>
            <Status tone={status.tone}>{status.label}</Status>
          </h2>
          <p className="card-support">{project.displayPath}</p>
        </div>
        {missing ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void desktop.launcher.removeProject(project.id)}
          >
            Forget project
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void desktop.launcher.openProject(project.id)}
          >
            Open project
            <Icon name="arrow_forward" size={16} />
          </button>
        )}
      </div>
    </section>
  );
}

/** A project the Auis CLI is making: what it prints, and what to do when it fails. */
function Creating({ creating }: { creating: CreateState }) {
  const log = useRef<HTMLPreElement>(null);
  const failed = creating.status === "error";

  // The newest line is the one to read.
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [creating.lines.length]);

  return (
    <section className="card" style={order(0)} aria-label={`New project ${creating.name}`}>
      <div className="card-foot">
        <div className="card-text">
          <h2 className="card-title">
            <span>{creating.name}</span>
            <Status tone={failed ? "danger" : "busy"}>{failed ? "Not created" : "Creating"}</Status>
          </h2>
          {failed ? (
            <p className="card-message">{creating.message}</p>
          ) : (
            <p className="card-support">{creating.displayPath}</p>
          )}
        </div>
        {failed && (
          <div className="card-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void desktop.launcher.dismissNewProject()}>
              Dismiss
            </button>
            {creating.canRetry && (
              <button type="button" className="btn btn-secondary" onClick={() => void desktop.launcher.retryNewProject()}>
                Try again
              </button>
            )}
          </div>
        )}
      </div>
      <pre className="create-log" ref={log} aria-label="Auis CLI output">
        {creating.lines.length > 0 ? creating.lines.join("\n") : "Starting the Auis CLI"}
      </pre>
    </section>
  );
}

function Recent({ projects }: { projects: ProjectSummary[] }) {
  return (
    <section className="card" style={order(2)}>
      <h2 className="card-head">Recent</h2>
      <ul className="rows">
        {projects.map((project) => {
          const status = projectStatus(project);
          const missing = project.status === "missing";
          return (
            <li className="row" key={project.id}>
              <button
                type="button"
                className="row-main"
                disabled={missing}
                onClick={() => void desktop.launcher.openProject(project.id)}
              >
                <span className="row-name">{project.name}</span>
                <span className="row-detail">{project.displayPath}</span>
                <Status tone={status.tone}>{status.label}</Status>
              </button>
              {project.status !== "open" && (
                <IconButton
                  icon="close"
                  label={`Forget ${project.name}`}
                  onClick={() => void desktop.launcher.removeProject(project.id)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Environment({ tools }: { tools: ToolInfo[] | null }) {
  const missing = tools?.filter((tool) => REQUIRED.has(tool.name) && tool.version === null) ?? [];
  return (
    <section className="card" style={order(3)}>
      <h2 className="card-head">Your shell</h2>
      <div className="rows" role="list">
        {(tools ?? []).map((tool) => {
          const found = tool.version !== null;
          const tone: Tone = found ? "success" : REQUIRED.has(tool.name) ? "danger" : "idle";
          return (
            <div className="env-row" role="listitem" key={tool.name}>
              <span className="env-name">{TOOL_LABEL[tool.name]}</span>
              <Status tone={tone}>
                <span className="tabular">{found ? tool.version : "Not found"}</span>
              </Status>
            </div>
          );
        })}
        {tools === null && (
          <div className="env-row">
            <Status tone="busy">Reading your shell</Status>
          </div>
        )}
      </div>
      {missing.length > 0 && (
        <p className="card-note">
          {missing.map((tool) => TOOL_LABEL[tool.name]).join(" and ")}{" "}
          {missing.length === 1 ? "is" : "are"} not on your PATH. Projects cannot start until{" "}
          {missing.length === 1 ? "it is" : "they are"} installed.
        </p>
      )}
    </section>
  );
}

export function Launcher() {
  const [state, setState] = useState<LauncherState | null>(null);

  useEffect(() => {
    void desktop.launcher.state().then(setState);
    return desktop.launcher.onState(setState);
  }, []);

  if (!state) return <div className="launcher" />;

  const [featured, ...rest] = state.projects;
  const creating = state.creating;
  const busy = creating?.status === "creating";
  return (
    <div className="launcher scroll">
      <div className="titlebar" />
      <main className="page">
        <header className="hero">
          <h1>
            Auis Design
            <Icon name="south_east" size={32} />
          </h1>
          <p>Open a project and Auis runs it here: its dev server, the product and the builder, in one window.</p>
        </header>

        <div className="grid">
          <div className="stack">
            {creating && <Creating creating={creating} />}
            {/* Before the first project, the card being made takes the empty card's place. */}
            {(featured || !creating) && <Featured project={featured ?? null} />}
            {rest.length > 0 && <Recent projects={rest} />}
          </div>
          <div className="stack">
            {featured && (
              <button
                type="button"
                className="card"
                style={order(1)}
                disabled={busy}
                onClick={() => void desktop.launcher.newProject()}
              >
                <span className="stage stage-short">
                  <NewProjectPreview />
                </span>
                <span className="card-foot">
                  <span className="card-text">
                    <span className="card-title">
                      <span>New project</span>
                    </span>
                    <span className="card-support">From the Auis template</span>
                  </span>
                  <span className="go">
                    <Icon name="arrow_outward" size={16} />
                  </span>
                </span>
              </button>
            )}
            {featured && (
              <button
                type="button"
                className="card"
                style={order(2)}
                onClick={() => void desktop.launcher.openFolder()}
              >
                {/* Spans, not blocks: a button may only hold phrasing content. */}
                <span className="stage stage-short">
                  <FolderPreview />
                </span>
                <span className="card-foot">
                  <span className="card-text">
                    <span className="card-title">
                      <span>Open folder</span>
                    </span>
                    <span className="card-support">Any project with a dev script</span>
                  </span>
                  <span className="go">
                    <Icon name="arrow_outward" size={16} />
                  </span>
                </span>
              </button>
            )}
            <Environment tools={state.tools} />
          </div>
        </div>
      </main>
    </div>
  );
}
