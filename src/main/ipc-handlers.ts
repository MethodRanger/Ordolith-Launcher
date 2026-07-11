import { app, BrowserWindow, dialog, ipcMain, shell } from "electron"
import { totalmem, freemem } from "node:os"
import { copyFileSync, mkdirSync } from "node:fs"
import { basename, join } from "node:path"
import { IPC, type CreateInstanceInput, type LaunchServerTarget } from "../shared/ipc.js"
import type { AppInfo } from "../shared/types.js"
import { paths } from "./paths.js"
import {
  listAccounts,
  loginMicrosoft,
  loginOffline,
  removeAccount,
  setActiveAccount,
  getValidMinecraftToken,
} from "./modules/auth.js"
import { getManifest } from "./modules/versions.js"
import {
  applyProfile,
  cloneInstance,
  createInstance,
  deleteProfile,
  getInstance,
  listInstances,
  listProfiles,
  purgeInstanceDir,
  removeInstance,
  saveProfile,
  updateInstance,
} from "./modules/instances.js"
import { addServer, listServers, pingServer, removeServer } from "./modules/servers.js"
import { launchGame, stopGame } from "./modules/launcher.js"
import { store } from "./store.js"
import {
  checkUpdates,
  getRecommended,
  installContent,
  listInstalled,
  removeContent,
  resolveDependencies,
  searchContent,
  toggleContent,
  updateContent,
} from "./modules/content.js"
import { listFavorites, toggleFavorite } from "./modules/favorites.js"
import { clearSessions, listSessions } from "./modules/sessions.js"
import { listScreenshots, removeScreenshot, revealScreenshot } from "./modules/screenshots.js"
import { createBackup, listBackups, openBackupsFolder, removeBackup, restoreBackup } from "./modules/backups.js"
import { getCrashReport } from "./crash-window.js"
import { installModpack, searchModpacks } from "./modules/modpacks.js"
import { discoverJava, downloadRecommendedJava } from "./modules/java-runtimes.js"
import { defaultExportName, exportInstance, importInstance } from "./modules/archives.js"

/**
 * Registers all main-process IPC handlers. Called once during app startup.
 * Handlers stay thin: validate, delegate to a module, return serialisable data.
 */
export function registerIpcHandlers(): void {
  /* App + window ---------------------------------------------------- */

  ipcMain.handle(IPC.app.getInfo, (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    dataDir: paths.root,
  }))

  ipcMain.on(IPC.app.openDataDir, () => { void shell.openPath(paths.root) })
  ipcMain.handle(IPC.app.getSettings, () => store.getSettings())
  ipcMain.handle(IPC.app.saveSettings, (_e, settings) => { store.saveSettings(settings); return settings })
  ipcMain.handle(IPC.app.memory, () => ({ totalMb: Math.floor(totalmem() / 1048576), freeMb: Math.floor(freemem() / 1048576) }))

  ipcMain.on(IPC.window.minimize, (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on(IPC.window.maximizeToggle, (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.on(IPC.window.close, (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.handle(IPC.window.isMaximized, (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false)

  /* Accounts -------------------------------------------------------- */

  ipcMain.handle(IPC.accounts.list, () => listAccounts())
  ipcMain.handle(IPC.accounts.loginOffline, (_e, username: string) => loginOffline(username))
  ipcMain.handle(IPC.accounts.loginMicrosoft, () => loginMicrosoft())
  ipcMain.handle(IPC.accounts.remove, (_e, id: string) => removeAccount(id))
  ipcMain.handle(IPC.accounts.logout, (_e, id: string) => removeAccount(id))
  ipcMain.handle(IPC.accounts.setActive, (_e, id: string) => setActiveAccount(id))
  ipcMain.handle(IPC.accounts.chooseAvatar, async (_e, id: string) => {
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }] })
    if (result.canceled) return null
    const dir = join(paths.root, "avatars"); mkdirSync(dir, { recursive: true })
    const target = join(dir, `${id}-${basename(result.filePaths[0])}`); copyFileSync(result.filePaths[0], target)
    store.saveAccounts(store.getAccounts().map((account) => account.id === id ? { ...account, avatarUrl: target } : account))
    return target
  })

  /* Versions -------------------------------------------------------- */

  ipcMain.handle(IPC.versions.list, () => getManifest(false))
  ipcMain.handle(IPC.versions.refresh, () => getManifest(true))

  /* Instances ------------------------------------------------------- */

  ipcMain.handle(IPC.instances.list, () => listInstances())
  ipcMain.handle(IPC.instances.create, (_e, input: CreateInstanceInput) => createInstance(input))
  ipcMain.handle(IPC.instances.update, (_e, id: string, patch) => updateInstance(id, patch))
  ipcMain.handle(IPC.instances.remove, (_e, id: string) => {
    const instance = getInstance(id)
    removeInstance(id)
    if (instance) purgeInstanceDir(instance.dirName)
  })
  ipcMain.handle(IPC.instances.clone, (_e, id: string, name: string) => cloneInstance(id, name))
  ipcMain.handle(IPC.instances.listProfiles, (_e, id: string) => listProfiles(id))
  ipcMain.handle(IPC.instances.saveProfile, (_e, id: string, name: string) => saveProfile(id, name))
  ipcMain.handle(IPC.instances.applyProfile, (_e, id: string, profileId: string) => applyProfile(id, profileId))
  ipcMain.handle(IPC.instances.deleteProfile, (_e, id: string, profileId: string) => deleteProfile(id, profileId))
  ipcMain.handle(IPC.instances.chooseDirectory, async (_e, id: string) => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] })
    if (result.canceled) return null
    updateInstance(id, { gameDirectory: result.filePaths[0], settings: { gameDirectory: result.filePaths[0] } as never })
    return result.filePaths[0]
  })
  ipcMain.handle(IPC.instances.chooseIcon, async (_e, id: string) => {
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }] })
    if (result.canceled) return null
    const dir = join(paths.root, "icons"); mkdirSync(dir, { recursive: true })
    const target = join(dir, `${id}-${basename(result.filePaths[0])}`); copyFileSync(result.filePaths[0], target)
    updateInstance(id, { iconPath: target }); return target
  })
  ipcMain.on(IPC.instances.openFolder, (_e, id: string) => {
    const instance = getInstance(id); if (instance) void shell.openPath(instance.gameDirectory || paths.gameDir(instance.dirName))
  })
  ipcMain.handle(IPC.instances.export, async (_e, id: string) => {
    const instance = getInstance(id); if (!instance) return { ok: false, error: "Instance not found" }
    const result = await dialog.showSaveDialog({ defaultPath: defaultExportName(instance), filters: [{ name: "Ordolith instance", extensions: ["zip"] }] })
    return result.canceled || !result.filePath ? { ok: false, error: "Cancelled" } : exportInstance(id, result.filePath)
  })
  ipcMain.handle(IPC.instances.import, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "Ordolith instance", extensions: ["zip"] }] })
    return result.canceled ? { ok: false, error: "Cancelled" } : importInstance(result.filePaths[0])
  })

  /* Content -------------------------------------------------------- */
  ipcMain.handle(IPC.content.search, (_e, query) => searchContent(query))
  ipcMain.handle(IPC.content.install, (_e, instanceId, type, project) => installContent(instanceId, type, project))
  ipcMain.handle(IPC.content.listInstalled, (_e, instanceId, type) => listInstalled(instanceId, type))
  ipcMain.handle(IPC.content.toggle, (_e, instanceId, type, fileName, enabled) => toggleContent(instanceId, type, fileName, enabled))
  ipcMain.handle(IPC.content.remove, (_e, instanceId, type, fileName) => removeContent(instanceId, type, fileName))
  ipcMain.handle(IPC.content.resolveDependencies, (_e, instanceId, project) => resolveDependencies(instanceId, project))
  ipcMain.handle(IPC.content.checkUpdates, (_e, instanceId, type) => checkUpdates(instanceId, type))
  ipcMain.handle(IPC.content.update, (_e, instanceId, type, fileName) => updateContent(instanceId, type, fileName))
  ipcMain.handle(IPC.content.recommended, (_e, type, loader, gameVersion) => getRecommended(type, loader, gameVersion))

  /* Favorites ------------------------------------------------------- */
  ipcMain.handle(IPC.favorites.list, () => listFavorites())
  ipcMain.handle(IPC.favorites.toggle, (_e, project, type) => toggleFavorite(project, type))

  /* Sessions -------------------------------------------------------- */
  ipcMain.handle(IPC.sessions.list, () => listSessions())
  ipcMain.handle(IPC.sessions.clear, () => clearSessions())

  /* Screenshots ----------------------------------------------------- */
  ipcMain.handle(IPC.screenshots.list, (_e, instanceId) => listScreenshots(instanceId))
  ipcMain.on(IPC.screenshots.reveal, (_e, path: string) => revealScreenshot(path))
  ipcMain.handle(IPC.screenshots.remove, (_e, instanceId, name) => removeScreenshot(instanceId, name))

  /* Backups --------------------------------------------------------- */
  ipcMain.handle(IPC.backups.create, (_e, instanceId) => createBackup(instanceId))
  ipcMain.handle(IPC.backups.list, (_e, instanceId) => listBackups(instanceId))
  ipcMain.handle(IPC.backups.restore, (_e, id) => restoreBackup(id))
  ipcMain.handle(IPC.backups.remove, (_e, id) => removeBackup(id))
  ipcMain.on(IPC.backups.openFolder, () => openBackupsFolder())

  /* Crash assistant ------------------------------------------------- */
  ipcMain.handle(IPC.crash.getData, () => getCrashReport())

  /* Modpacks -------------------------------------------------------- */
  ipcMain.handle(IPC.modpacks.search, (_e, query) => searchModpacks(query))
  ipcMain.handle(IPC.modpacks.install, (e, project) =>
    installModpack(project, (progress) => {
      if (!e.sender.isDestroyed()) e.sender.send(IPC.modpacks.onProgress, progress)
    }),
  )

  /* Java ----------------------------------------------------------- */
  ipcMain.handle(IPC.java.discover, () => discoverJava())
  ipcMain.handle(IPC.java.download, (e, version: string) => downloadRecommendedJava(version, (fraction, detail) => {
    if (!e.sender.isDestroyed()) e.sender.send(IPC.java.onProgress, fraction, detail)
  }))

  /* Servers --------------------------------------------------------- */

  ipcMain.handle(IPC.servers.list, () => listServers())
  ipcMain.handle(IPC.servers.add, (_e, server) => addServer(server))
  ipcMain.handle(IPC.servers.remove, (_e, id: string) => removeServer(id))
  ipcMain.handle(IPC.servers.ping, (_e, host: string, port: number) => pingServer(host, port))

  /* Launcher -------------------------------------------------------- */

  ipcMain.handle(
    IPC.launcher.launch,
    async (e, instanceId: string, server?: LaunchServerTarget) => {
      const instance = getInstance(instanceId)
      if (!instance) return { ok: false, error: "Instance not found." }

      const account = listAccounts().find((a) => a.active) ?? listAccounts()[0]
      if (!account) return { ok: false, error: "Add an account before launching." }

      // Real token for Microsoft accounts; a harmless dummy for offline play.
      let accessToken = "0"
      if (account.kind === "microsoft") {
        try {
          accessToken = await getValidMinecraftToken(account.id)
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) }
        }
      }

      const sender = e.sender
      return launchGame(
        { instance, account, accessToken, server },
        {
          onProgress: (ev) => {
            if (!sender.isDestroyed()) sender.send(IPC.launcher.onProgress, ev)
          },
          onLog: (ev) => {
            if (!sender.isDestroyed()) sender.send(IPC.launcher.onLog, ev)
          },
          onResource: (sample) => {
            if (!sender.isDestroyed()) sender.send(IPC.resources.onSample, sample)
          },
        },
      )
    },
  )

  ipcMain.on(IPC.launcher.stop, (_e, instanceId: string) => stopGame(instanceId))
}
