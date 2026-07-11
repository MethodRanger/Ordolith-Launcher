import { app, BrowserWindow, shell } from "electron"
import { join } from "node:path"
import { IPC } from "../shared/ipc.js"
import type { CrashReport } from "../shared/types.js"

let crashWindow: BrowserWindow | null = null
let latest: CrashReport | null = null

/** The most recent crash report, requested by the crash window on load. */
export function getCrashReport(): CrashReport | null {
  return latest
}

/**
 * Inspect a game log and return translation keys describing the most likely
 * cause of a crash, ordered from most to least specific.
 */
export function analyzeCrash(log: string): string[] {
  const hints: string[] = []
  const test = (re: RegExp): boolean => re.test(log)
  if (test(/OutOfMemoryError|GC overhead limit|unable to create new native thread/i)) hints.push("crash.hint.memory")
  if (test(/UnsupportedClassVersionError|compiled by a more recent version|class file version/i)) hints.push("crash.hint.java")
  if (test(/Mixin apply failed|mixin\.|MixinTransformerError|InvalidMixinException/i)) hints.push("crash.hint.mixin")
  if (test(/Missing or unsupported mandatory dependencies|requires .*which is missing|Incompatible mod set|Mod resolution failed/i)) hints.push("crash.hint.dependency")
  if (test(/NoSuchMethodError|NoClassDefFoundError|LinkageError|duplicate mods/i)) hints.push("crash.hint.conflict")
  if (test(/Pixel format not accelerated|Failed to create window|GLFW error|OpenGL|Couldn't set pixel format/i)) hints.push("crash.hint.graphics")
  if (hints.length === 0) hints.push("crash.hint.generic")
  return hints
}

/**
 * Open (or focus) the standalone crash-assistant window. It reuses the main
 * renderer bundle via a `?view=crash` flag so no extra build entry is needed.
 */
export function openCrashWindow(report: CrashReport): void {
  latest = report
  if (crashWindow && !crashWindow.isDestroyed()) {
    crashWindow.webContents.send(IPC.crash.onOpen, report)
    crashWindow.show()
    crashWindow.focus()
    return
  }

  const icon = app.isPackaged
    ? join(process.resourcesPath, "icons", "ordolith-256.png")
    : join(__dirname, "../../build/icons/ordolith-256.png")

  crashWindow = new BrowserWindow({
    width: 760,
    height: 680,
    minWidth: 560,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b0d12",
    title: "Ordolith — Crash Assistant",
    icon,
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  crashWindow.on("ready-to-show", () => crashWindow?.show())
  crashWindow.on("closed", () => {
    crashWindow = null
  })
  crashWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: "deny" }
  })
  crashWindow.webContents.on("did-finish-load", () => {
    crashWindow?.webContents.send(IPC.crash.onOpen, report)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void crashWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}?view=crash`)
  } else {
    void crashWindow.loadFile(join(__dirname, "../renderer/index.html"), { query: { view: "crash" } })
  }
}
