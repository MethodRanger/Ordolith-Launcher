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
  ProgressEvent,
  SavedServer,
  ServerStatus,
  VersionManifest,
} from "./types"

export const IPC = {
  app: {
    getInfo: "app:getInfo",
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
    onProgress: "launcher:onProgress",
    onLog: "launcher:onLog",
  },
} as const

export interface CreateInstanceInput {
  name: string
  versionId: string
  loader?: Instance["loader"]
  settings?: Partial<InstanceSettings>
}

export interface LaunchInput {
  instanceId: string
  /** Optional server to auto-connect to on launch. */
  server?: { host: string; port: number }
}

/** The API shape exposed on `window.ordolith` via the preload bridge. */
export interface OrdolithApi {
  getInfo: () => Promise<AppInfo>

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
    launch: (input: LaunchInput) => Promise<LaunchResult>
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
  ProgressEvent,
  SavedServer,
  ServerStatus,
  VersionManifest,
}
