// The only bridge between the app's chrome and the main process. It exposes
// named functions, never `ipcRenderer` itself, so a script running in the
// chrome can ask for exactly these things and nothing else. Project pages get
// no preload at all.

import { contextBridge, ipcRenderer } from "electron";
import {
  CHANNELS,
  type DesktopBridge,
  type LauncherState,
  type NavigateAction,
  type ProjectState,
} from "../shared/ipc.ts";

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: unknown, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const bridge: DesktopBridge = {
  launcher: {
    state: () => ipcRenderer.invoke(CHANNELS.launcherState),
    onState: (listener) => subscribe<LauncherState>(CHANNELS.launcherChanged, listener),
    openFolder: () => ipcRenderer.invoke(CHANNELS.launcherOpenFolder),
    openProject: (id: string) => ipcRenderer.invoke(CHANNELS.launcherOpenProject, id),
    removeProject: (id: string) => ipcRenderer.invoke(CHANNELS.launcherRemoveProject, id),
  },
  project: {
    state: () => ipcRenderer.invoke(CHANNELS.projectState),
    onState: (listener) => subscribe<ProjectState>(CHANNELS.projectChanged, listener),
    logs: () => ipcRenderer.invoke(CHANNELS.projectLogs),
    onLog: (listener) => subscribe<string[]>(CHANNELS.projectLog, listener),
    navigate: (action: NavigateAction) => ipcRenderer.invoke(CHANNELS.projectNavigate, action),
    setLogsOpen: (open: boolean) => ipcRenderer.invoke(CHANNELS.projectSetLogsOpen, open),
    restart: () => ipcRenderer.invoke(CHANNELS.projectRestart),
    install: () => ipcRenderer.invoke(CHANNELS.projectInstall),
    openInBrowser: () => ipcRenderer.invoke(CHANNELS.projectOpenInBrowser),
    copyNoticeCommand: () => ipcRenderer.invoke(CHANNELS.projectCopyNoticeCommand),
    dismissNotice: () => ipcRenderer.invoke(CHANNELS.projectDismissNotice),
  },
};

contextBridge.exposeInMainWorld("auisDesktop", bridge);
