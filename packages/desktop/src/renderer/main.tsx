// One bundle, two pages. `launcher.html` and `project.html` load the same
// script and say which screen they are through `data-view` on the body.

import { createRoot } from "react-dom/client";
import "./desktop.css";
import { Launcher } from "./Launcher.tsx";
import { ProjectChrome } from "./ProjectChrome.tsx";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(document.body.dataset.view === "project" ? <ProjectChrome /> : <Launcher />);
}
