import { contextBridge, ipcRenderer } from "electron"
import { IPC, type OrdolithApi } from "../shared/ipc.js"

/**
 * The single, explicit surface exposed to the renderer. Nothing else from
 * Node or Electron leaks through — contextIsolation keeps this boundary safe.
 */
const api: OrdolithApi = {
  getVersion: () => ipcRenderer.invoke(IPC.app.getVersion),
  getInfo: () => ipcRenderer.invoke(IPC.app.getInfo),
  window: {
    minimize: () => ipcRenderer.send(IPC.window.minimize),
    maximizeToggle: () => ipcRenderer.send(IPC.window.maximizeToggle),
    close: () => ipcRenderer.send(IPC.window.close),
    isMaximized: () => ipcRenderer.invoke(IPC.window.isMaximized),
  },
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("ordolith", api)
} else {
  // Fallback for the (discouraged) non-isolated case.
  // @ts-expect-error - define on window when context isolation is disabled
  window.ordolith = api
}
