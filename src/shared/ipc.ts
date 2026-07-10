import type {
  Account, AppInfo, ArchiveResult, ContentProject, ContentSearchQuery, ContentSearchResult,
  ContentType, GameLogLine, InstalledContent, Instance, InstanceSettings, JavaRuntime,
  LaunchResult, LauncherSettings, ModLoader, ProgressEvent, SavedServer, ServerStatus,
  SystemMemoryInfo, VersionManifest, VersionSummary,
} from "./types"

export const IPC = {
  app: { getInfo: "app:getInfo", openDataDir: "app:openDataDir", getSettings: "app:getSettings", saveSettings: "app:saveSettings", memory: "app:memory" },
  window: { minimize: "window:minimize", maximizeToggle: "window:maximizeToggle", close: "window:close", isMaximized: "window:isMaximized" },
  accounts: { list: "accounts:list", loginOffline: "accounts:loginOffline", loginMicrosoft: "accounts:loginMicrosoft", remove: "accounts:remove", logout: "accounts:logout", setActive: "accounts:setActive", chooseAvatar: "accounts:chooseAvatar" },
  versions: { list: "versions:list", refresh: "versions:refresh" },
  instances: { list: "instances:list", create: "instances:create", update: "instances:update", remove: "instances:remove", chooseDirectory: "instances:chooseDirectory", chooseIcon: "instances:chooseIcon", openFolder: "instances:openFolder", export: "instances:export", import: "instances:import" },
  content: { search: "content:search", install: "content:install", listInstalled: "content:listInstalled", toggle: "content:toggle", remove: "content:remove" },
  java: { discover: "java:discover", download: "java:download", onProgress: "java:onProgress" },
  servers: { list: "servers:list", add: "servers:add", remove: "servers:remove", ping: "servers:ping" },
  launcher: { launch: "launcher:launch", stop: "launcher:stop", onProgress: "launcher:onProgress", onLog: "launcher:onLog" },
} as const

export interface CreateInstanceInput {
  name: string
  versionId: string
  loader?: ModLoader
  iconColor?: string
  settings?: Partial<InstanceSettings>
}
export interface LaunchServerTarget { host: string; port: number }

export interface OrdolithApi {
  app: {
    getInfo: () => Promise<AppInfo>; openDataDir: () => void
    getSettings: () => Promise<LauncherSettings>; saveSettings: (settings: LauncherSettings) => Promise<LauncherSettings>
    memory: () => Promise<SystemMemoryInfo>
  }
  window: { minimize: () => void; maximizeToggle: () => void; close: () => void; isMaximized: () => Promise<boolean> }
  accounts: {
    list: () => Promise<Account[]>; loginOffline: (username: string) => Promise<Account>; loginMicrosoft: () => Promise<Account>
    remove: (id: string) => Promise<void>; logout: (id: string) => Promise<void>; setActive: (id: string) => Promise<void>
    chooseAvatar: (id: string) => Promise<string | null>
  }
  versions: { list: () => Promise<VersionManifest>; refresh: () => Promise<VersionManifest> }
  instances: {
    list: () => Promise<Instance[]>; create: (input: CreateInstanceInput) => Promise<Instance>
    update: (id: string, patch: Partial<Instance>) => Promise<Instance>; remove: (id: string) => Promise<void>
    chooseDirectory: (id: string) => Promise<string | null>; chooseIcon: (id: string) => Promise<string | null>
    openFolder: (id: string) => void; export: (id: string) => Promise<ArchiveResult>; import: () => Promise<ArchiveResult>
  }
  content: {
    search: (query: ContentSearchQuery) => Promise<ContentSearchResult>
    install: (instanceId: string, type: ContentType, project: ContentProject) => Promise<InstalledContent>
    listInstalled: (instanceId: string, type: ContentType) => Promise<InstalledContent[]>
    toggle: (instanceId: string, type: ContentType, fileName: string, enabled: boolean) => Promise<void>
    remove: (instanceId: string, type: ContentType, fileName: string) => Promise<void>
  }
  java: {
    discover: () => Promise<JavaRuntime[]>; download: (minecraftVersion: string) => Promise<JavaRuntime>
    onProgress: (cb: (fraction: number, detail: string) => void) => () => void
  }
  servers: { list: () => Promise<SavedServer[]>; add: (server: Omit<SavedServer, "id">) => Promise<SavedServer>; remove: (id: string) => Promise<void>; ping: (host: string, port: number) => Promise<ServerStatus> }
  launcher: {
    launch: (instanceId: string, server?: LaunchServerTarget) => Promise<LaunchResult>; stop: (instanceId: string) => void
    onProgress: (cb: (e: ProgressEvent) => void) => () => void; onLog: (cb: (e: GameLogLine) => void) => () => void
  }
}

export type { Account, AppInfo, ContentProject, ContentSearchQuery, ContentSearchResult, ContentType, GameLogLine, InstalledContent, Instance, InstanceSettings, JavaRuntime, LaunchResult, LauncherSettings, ModLoader, ProgressEvent, SavedServer, ServerStatus, VersionManifest, VersionSummary }
