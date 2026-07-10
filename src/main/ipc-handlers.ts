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
  createInstance,
  getInstance,
  listInstances,
  removeInstance,
  updateInstance,
} from "./modules/instances.js"
import { addServer, listServers, pingServer, removeServer } from "./modules/servers.js"
import { launchGame, stopGame } from "./modules/launcher.js"
import { store } from "./store.js"
import { installContent, listInstalled, removeContent, searchContent, toggleContent } from "./modules/content.js"
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
  ipcMain.handle(IPC.instances.remove, (_e, id: string) => removeInstance(id))
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
        },
      )
    },
  )

  ipcMain.on(IPC.launcher.stop, (_e, instanceId: string) => stopGame(instanceId))
}
