import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron"
import { IPC, type OrdolithApi } from "../shared/ipc.js"
import type { CrashReport, GameLogLine, ProgressEvent, ResourceSample } from "../shared/types.js"

const api: OrdolithApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC.app.getInfo), openDataDir: () => ipcRenderer.send(IPC.app.openDataDir),
    getSettings: () => ipcRenderer.invoke(IPC.app.getSettings), saveSettings: (settings) => ipcRenderer.invoke(IPC.app.saveSettings, settings),
    memory: () => ipcRenderer.invoke(IPC.app.memory),
  },
  window: {
    minimize: () => ipcRenderer.send(IPC.window.minimize), maximizeToggle: () => ipcRenderer.send(IPC.window.maximizeToggle),
    close: () => ipcRenderer.send(IPC.window.close), isMaximized: () => ipcRenderer.invoke(IPC.window.isMaximized),
  },
  accounts: {
    list: () => ipcRenderer.invoke(IPC.accounts.list), loginOffline: (username) => ipcRenderer.invoke(IPC.accounts.loginOffline, username),
    loginMicrosoft: () => ipcRenderer.invoke(IPC.accounts.loginMicrosoft), remove: (id) => ipcRenderer.invoke(IPC.accounts.remove, id),
    logout: (id) => ipcRenderer.invoke(IPC.accounts.logout, id), setActive: (id) => ipcRenderer.invoke(IPC.accounts.setActive, id),
    chooseAvatar: (id) => ipcRenderer.invoke(IPC.accounts.chooseAvatar, id),
  },
  versions: { list: () => ipcRenderer.invoke(IPC.versions.list), refresh: () => ipcRenderer.invoke(IPC.versions.refresh) },
  instances: {
    list: () => ipcRenderer.invoke(IPC.instances.list), create: (input) => ipcRenderer.invoke(IPC.instances.create, input),
    update: (id, patch) => ipcRenderer.invoke(IPC.instances.update, id, patch), remove: (id) => ipcRenderer.invoke(IPC.instances.remove, id),
    clone: (id, name) => ipcRenderer.invoke(IPC.instances.clone, id, name),
    chooseDirectory: (id) => ipcRenderer.invoke(IPC.instances.chooseDirectory, id), chooseIcon: (id) => ipcRenderer.invoke(IPC.instances.chooseIcon, id),
    openFolder: (id) => ipcRenderer.send(IPC.instances.openFolder, id), export: (id) => ipcRenderer.invoke(IPC.instances.export, id),
    import: () => ipcRenderer.invoke(IPC.instances.import),
    listProfiles: (id) => ipcRenderer.invoke(IPC.instances.listProfiles, id),
    saveProfile: (id, name) => ipcRenderer.invoke(IPC.instances.saveProfile, id, name),
    applyProfile: (id, profileId) => ipcRenderer.invoke(IPC.instances.applyProfile, id, profileId),
    deleteProfile: (id, profileId) => ipcRenderer.invoke(IPC.instances.deleteProfile, id, profileId),
  },
  content: {
    search: (query) => ipcRenderer.invoke(IPC.content.search, query),
    install: (instanceId, type, project) => ipcRenderer.invoke(IPC.content.install, instanceId, type, project),
    listInstalled: (instanceId, type) => ipcRenderer.invoke(IPC.content.listInstalled, instanceId, type),
    toggle: (instanceId, type, fileName, enabled) => ipcRenderer.invoke(IPC.content.toggle, instanceId, type, fileName, enabled),
    remove: (instanceId, type, fileName) => ipcRenderer.invoke(IPC.content.remove, instanceId, type, fileName),
    resolveDependencies: (instanceId, project) => ipcRenderer.invoke(IPC.content.resolveDependencies, instanceId, project),
    checkUpdates: (instanceId, type) => ipcRenderer.invoke(IPC.content.checkUpdates, instanceId, type),
    update: (instanceId, type, fileName) => ipcRenderer.invoke(IPC.content.update, instanceId, type, fileName),
    recommended: (type, loader, gameVersion) => ipcRenderer.invoke(IPC.content.recommended, type, loader, gameVersion),
  },
  favorites: {
    list: () => ipcRenderer.invoke(IPC.favorites.list),
    toggle: (project, type) => ipcRenderer.invoke(IPC.favorites.toggle, project, type),
  },
  modpacks: {
    search: (query) => ipcRenderer.invoke(IPC.modpacks.search, query),
    install: (project) => ipcRenderer.invoke(IPC.modpacks.install, project),
    onProgress: (cb) => {
      const listener = (_e: IpcRendererEvent, progress: { fraction: number; detail: string }): void => cb(progress)
      ipcRenderer.on(IPC.modpacks.onProgress, listener)
      return () => ipcRenderer.removeListener(IPC.modpacks.onProgress, listener)
    },
  },
  java: {
    discover: () => ipcRenderer.invoke(IPC.java.discover), download: (version) => ipcRenderer.invoke(IPC.java.download, version),
    onProgress: (cb) => {
      const listener = (_e: IpcRendererEvent, fraction: number, detail: string): void => cb(fraction, detail)
      ipcRenderer.on(IPC.java.onProgress, listener)
      return () => ipcRenderer.removeListener(IPC.java.onProgress, listener)
    },
  },
  servers: {
    list: () => ipcRenderer.invoke(IPC.servers.list), add: (server) => ipcRenderer.invoke(IPC.servers.add, server),
    remove: (id) => ipcRenderer.invoke(IPC.servers.remove, id), ping: (host, port) => ipcRenderer.invoke(IPC.servers.ping, host, port),
  },
  sessions: {
    list: () => ipcRenderer.invoke(IPC.sessions.list), clear: () => ipcRenderer.invoke(IPC.sessions.clear),
  },
  resources: {
    onSample: (cb) => {
      const listener = (_e: IpcRendererEvent, sample: ResourceSample): void => cb(sample)
      ipcRenderer.on(IPC.resources.onSample, listener)
      return () => ipcRenderer.removeListener(IPC.resources.onSample, listener)
    },
  },
  screenshots: {
    list: (instanceId) => ipcRenderer.invoke(IPC.screenshots.list, instanceId),
    reveal: (path) => ipcRenderer.send(IPC.screenshots.reveal, path),
    remove: (instanceId, name) => ipcRenderer.invoke(IPC.screenshots.remove, instanceId, name),
  },
  backups: {
    create: (instanceId) => ipcRenderer.invoke(IPC.backups.create, instanceId),
    list: (instanceId) => ipcRenderer.invoke(IPC.backups.list, instanceId),
    restore: (id) => ipcRenderer.invoke(IPC.backups.restore, id),
    remove: (id) => ipcRenderer.invoke(IPC.backups.remove, id),
    openFolder: () => ipcRenderer.send(IPC.backups.openFolder),
  },
  crash: {
    getData: () => ipcRenderer.invoke(IPC.crash.getData),
    onOpen: (cb) => {
      const listener = (_e: IpcRendererEvent, report: CrashReport): void => cb(report)
      ipcRenderer.on(IPC.crash.onOpen, listener)
      return () => ipcRenderer.removeListener(IPC.crash.onOpen, listener)
    },
  },
  launcher: {
    launch: (instanceId, server) => ipcRenderer.invoke(IPC.launcher.launch, instanceId, server), stop: (instanceId) => ipcRenderer.send(IPC.launcher.stop, instanceId),
    onProgress: (cb) => { const listener = (_e: IpcRendererEvent, payload: ProgressEvent): void => cb(payload); ipcRenderer.on(IPC.launcher.onProgress, listener); return () => ipcRenderer.removeListener(IPC.launcher.onProgress, listener) },
    onLog: (cb) => { const listener = (_e: IpcRendererEvent, payload: GameLogLine): void => cb(payload); ipcRenderer.on(IPC.launcher.onLog, listener); return () => ipcRenderer.removeListener(IPC.launcher.onLog, listener) },
  },
}

if (process.contextIsolated) contextBridge.exposeInMainWorld("ordolith", api)
else {
  // @ts-expect-error fallback for disabled context isolation
  window.ordolith = api
}
