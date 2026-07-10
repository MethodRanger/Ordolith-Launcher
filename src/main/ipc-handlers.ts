import { app, BrowserWindow, ipcMain } from "electron"
import { IPC, type AppInfo } from "../shared/ipc.js"

/**
 * Registers all main-process IPC handlers. Called once during app startup.
 * Keep handlers thin: validate input, do the work, return serialisable data.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.app.getVersion, () => app.getVersion())

  ipcMain.handle(IPC.app.getInfo, (): AppInfo => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
    }
  })

  // Window controls — resolve the sender's window so this works even with
  // multiple windows in the future.
  ipcMain.on(IPC.window.minimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on(IPC.window.maximizeToggle, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })

  ipcMain.on(IPC.window.close, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle(IPC.window.isMaximized, (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })
}
