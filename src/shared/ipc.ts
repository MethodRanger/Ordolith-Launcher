/**
 * Shared IPC contract between the main and renderer processes.
 *
 * Keeping channel names and payload types in one place keeps the preload
 * bridge, the main-process handlers, and the renderer client in sync.
 */

import type {
  Account,
  AppInfo,
  GameLogLine,
  Instance,
  InstanceSettings,
  LaunchResult,
  ModLoader,
  ProgressEvent,
  SavedServer,
  ServerStatus,
  VersionManifest,
  VersionSummary,
} from "./types"

export const IPC = {
  app: {
    getInfo: "app:getInfo",
    openDataDir: "app:openDataDir",
  },
  window: {
    minimize: "window:minimize",
    maximizeToggle: "window:maximizeToggle",
    close: "window:close",
    isMaximized: "window:isMaximized",
  },
  accounts: {
    list: "accounts:list",
    loginOffline: "accounts:loginOffline",
    loginMicrosoft: "accounts:loginMicrosoft",
    remove: "accounts:remove",
    logout: "accounts:logout",
    setActive: "accounts:setActive",
  },
  versions: {
    list: "versions:list",
    refresh: "versions:refresh",
  },
  instances: {
    list: "instances:list",
    create: "instances:create",
    update: "instances:update",
    remove: "instances:remove",
  },
  servers: {
    list: "servers:list",
    add: "servers:add",
    remove: "servers:remove",
    ping: "servers:ping",
  },
  launcher: {
    launch: "launcher:launch",
    stop: "launcher:stop",
    onProgress: "launcher:onProgress",
    onLog: "launcher:onLog",
  },
} as const

export interface CreateInstanceInput {
  name: string
  versionId: string
  loader?: ModLoader
  iconColor?: string
  settings?: Partial<InstanceSettings>
}

/** Optional server to auto-connect to on launch. */
export interface LaunchServerTarget {
  host: string
  port: number
}

/** The API shape exposed on `window.ordolith` via the preload bridge. */
export interface OrdolithApi {
  app: {
    getInfo: () => Promise<AppInfo>
    openDataDir: () => void
  }

  window: {
    minimize: () => void
    maximizeToggle: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
  }

  accounts: {
    list: () => Promise<Account[]>
    loginOffline: (username: string) => Promise<Account>
    loginMicrosoft: () => Promise<Account>
    remove: (id: string) => Promise<void>
    logout: (id: string) => Promise<void>
    setActive: (id: string) => Promise<void>
  }

  versions: {
    list: () => Promise<VersionManifest>
    refresh: () => Promise<VersionManifest>
  }

  instances: {
    list: () => Promise<Instance[]>
    create: (input: CreateInstanceInput) => Promise<Instance>
    update: (id: string, patch: Partial<Instance>) => Promise<Instance>
    remove: (id: string) => Promise<void>
  }

  servers: {
    list: () => Promise<SavedServer[]>
    add: (server: Omit<SavedServer, "id">) => Promise<SavedServer>
    remove: (id: string) => Promise<void>
    ping: (host: string, port: number) => Promise<ServerStatus>
  }

  launcher: {
    launch: (instanceId: string, server?: LaunchServerTarget) => Promise<LaunchResult>
    stop: (instanceId: string) => void
    onProgress: (cb: (e: ProgressEvent) => void) => () => void
    onLog: (cb: (e: GameLogLine) => void) => () => void
  }
}

export type {
  Account,
  AppInfo,
  GameLogLine,
  Instance,
  InstanceSettings,
  LaunchResult,
  ModLoader,
  ProgressEvent,
  SavedServer,
  ServerStatus,
  VersionManifest,
  VersionSummary,
}
