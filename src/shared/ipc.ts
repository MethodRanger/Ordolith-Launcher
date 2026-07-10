/**
 * Shared IPC contract between the main and renderer processes.
 *
 * Keeping channel names and payload types in one place makes the preload
 * bridge, the main-process handlers, and the renderer client stay in sync.
 */

export const IPC = {
  app: {
    getVersion: "app:getVersion",
    getInfo: "app:getInfo",
  },
  window: {
    minimize: "window:minimize",
    maximizeToggle: "window:maximizeToggle",
    close: "window:close",
    isMaximized: "window:isMaximized",
  },
} as const

/** Basic runtime info surfaced to the renderer at startup. */
export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: NodeJS.Platform
  arch: string
}

/** The API shape exposed on `window.ordolith` via the preload bridge. */
export interface OrdolithApi {
  getVersion: () => Promise<string>
  getInfo: () => Promise<AppInfo>
  window: {
    minimize: () => void
    maximizeToggle: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
  }
}
