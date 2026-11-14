// The launcher: the app's home. One job — get into a project — so the most
// recent project carries the screen's only primary button, and everything else
// is a quieter way to the same place.

import { useEffect, useState, type CSSProperties } from "react";
import type { LauncherState, ProjectSummary, ToolInfo, ToolName } from "../shared/ipc.ts";
import { FolderPreview, ProjectPreview } from "./previews.tsx";
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
            <p className="card-support">Open a folder that has a dev script. Auis starts it here.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void desktop.launcher.openFolder()}>
            Open folder
            <Icon name="arrow_forward" size={16} />
          </button>
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
            <Featured project={featured ?? null} />
            {rest.length > 0 && <Recent projects={rest} />}
          </div>
          <div className="stack">
            {featured && (
              <button
                type="button"
                className="card"
                style={order(1)}
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
