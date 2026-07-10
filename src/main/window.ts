import { join } from "node:path"
import { BrowserWindow, shell } from "electron"

/**
 * Creates the primary launcher window. The window stays hidden until the
 * renderer signals it is ready-to-show to avoid a white flash on startup.
 */
export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0e0f13",
    title: "Ordolith",
    frame: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  window.on("ready-to-show", () => {
    window.show()
  })

  // Open target=_blank / external links in the user's browser, never in-app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  // electron-vite injects ELECTRON_RENDERER_URL in dev for HMR; in production
  // we load the bundled HTML file from disk.
  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(__dirname, "../renderer/index.html"))
  }

  return window
}
