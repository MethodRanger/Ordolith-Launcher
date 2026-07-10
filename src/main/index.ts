import { app, BrowserWindow } from "electron"
import { createMainWindow } from "./window.js"
import { registerIpcHandlers } from "./ipc-handlers.js"
import { paths } from "./paths.js"
import { createTray } from "./tray.js"

// A single app-wide instance lock prevents multiple launcher windows from
// fighting over the same game/instance directories.
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    paths.ensureBase()
    registerIpcHandlers()
    mainWindow = createMainWindow()
    createTray(() => mainWindow)

    app.on("activate", () => {
      // On macOS re-create a window when the dock icon is clicked and there
      // are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
      }
    })
  })

  app.on("window-all-closed", () => {
    // On macOS apps typically stay active until the user quits explicitly.
    if (process.platform !== "darwin") {
      app.quit()
    }
  })
}
