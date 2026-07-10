import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron"
import { IPC, type OrdolithApi } from "../shared/ipc.js"
import type { GameLogLine, ProgressEvent } from "../shared/types.js"

/**
 * The single, explicit surface exposed to the renderer. Nothing else from
 * Node or Electron leaks through — contextIsolation keeps this boundary safe.
 */
const api: OrdolithApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC.app.getInfo),
    openDataDir: () => ipcRenderer.send(IPC.app.openDataDir),
  },

  window: {
    minimize: () => ipcRenderer.send(IPC.window.minimize),
    maximizeToggle: () => ipcRenderer.send(IPC.window.maximizeToggle),
    close: () => ipcRenderer.send(IPC.window.close),
    isMaximized: () => ipcRenderer.invoke(IPC.window.isMaximized),
  },

  accounts: {
    list: () => ipcRenderer.invoke(IPC.accounts.list),
    loginOffline: (username) => ipcRenderer.invoke(IPC.accounts.loginOffline, username),
    loginMicrosoft: () => ipcRenderer.invoke(IPC.accounts.loginMicrosoft),
    remove: (id) => ipcRenderer.invoke(IPC.accounts.remove, id),
    logout: (id) => ipcRenderer.invoke(IPC.accounts.logout, id),
    setActive: (id) => ipcRenderer.invoke(IPC.accounts.setActive, id),
  },

  versions: {
    list: () => ipcRenderer.invoke(IPC.versions.list),
    refresh: () => ipcRenderer.invoke(IPC.versions.refresh),
  },

  instances: {
    list: () => ipcRenderer.invoke(IPC.instances.list),
    create: (input) => ipcRenderer.invoke(IPC.instances.create, input),
    update: (id, patch) => ipcRenderer.invoke(IPC.instances.update, id, patch),
    remove: (id) => ipcRenderer.invoke(IPC.instances.remove, id),
  },

  servers: {
    list: () => ipcRenderer.invoke(IPC.servers.list),
    add: (server) => ipcRenderer.invoke(IPC.servers.add, server),
    remove: (id) => ipcRenderer.invoke(IPC.servers.remove, id),
    ping: (host, port) => ipcRenderer.invoke(IPC.servers.ping, host, port),
  },

  launcher: {
    launch: (instanceId, server) => ipcRenderer.invoke(IPC.launcher.launch, instanceId, server),
    stop: (instanceId) => ipcRenderer.send(IPC.launcher.stop, instanceId),
    onProgress: (cb) => {
      const listener = (_e: IpcRendererEvent, payload: ProgressEvent): void => cb(payload)
      ipcRenderer.on(IPC.launcher.onProgress, listener)
      return () => ipcRenderer.removeListener(IPC.launcher.onProgress, listener)
    },
    onLog: (cb) => {
      const listener = (_e: IpcRendererEvent, payload: GameLogLine): void => cb(payload)
      ipcRenderer.on(IPC.launcher.onLog, listener)
      return () => ipcRenderer.removeListener(IPC.launcher.onLog, listener)
    },
  },
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("ordolith", api)
} else {
  // Fallback for the (discouraged) non-isolated case.
  // @ts-expect-error - define on window when context isolation is disabled
  window.ordolith = api
}
