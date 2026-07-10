import type {
  Account, AppInfo, AppLocale, ArchiveResult, BackupEntry, ContentProject, ContentSearchQuery, ContentSearchResult,
  ContentType, ContentUpdate, CrashReport, FavoriteContent, GameLogLine, InstalledContent, Instance, InstanceProfile, InstanceSettings, JavaRuntime,
  LaunchResult, LauncherSettings, ModLoader, ModpackInstallProgress, ModpackProject, ModpackSearchQuery,
  ModpackSearchResult, PlaySession, ProgressEvent, ResolvedDependency, ResourceSample, SavedServer, Screenshot, ServerStatus,
  SystemMemoryInfo, VersionManifest, VersionSummary,
} from "./types"

export const IPC = {
  app: { getInfo: "app:getInfo", openDataDir: "app:openDataDir", getSettings: "app:getSettings", saveSettings: "app:saveSettings", memory: "app:memory" },
  window: { minimize: "window:minimize", maximizeToggle: "window:maximizeToggle", close: "window:close", isMaximized: "window:isMaximized" },
  accounts: { list: "accounts:list", loginOffline: "accounts:loginOffline", loginMicrosoft: "accounts:loginMicrosoft", remove: "accounts:remove", logout: "accounts:logout", setActive: "accounts:setActive", chooseAvatar: "accounts:chooseAvatar" },
  versions: { list: "versions:list", refresh: "versions:refresh" },
  instances: { list: "instances:list", create: "instances:create", update: "instances:update", remove: "instances:remove", clone: "instances:clone", chooseDirectory: "instances:chooseDirectory", chooseIcon: "instances:chooseIcon", openFolder: "instances:openFolder", export: "instances:export", import: "instances:import", listProfiles: "instances:listProfiles", saveProfile: "instances:saveProfile", applyProfile: "instances:applyProfile", deleteProfile: "instances:deleteProfile" },
  content: { search: "content:search", install: "content:install", listInstalled: "content:listInstalled", toggle: "content:toggle", remove: "content:remove", resolveDependencies: "content:resolveDependencies", checkUpdates: "content:checkUpdates", update: "content:update", recommended: "content:recommended" },
  favorites: { list: "favorites:list", toggle: "favorites:toggle" },
  modpacks: { search: "modpacks:search", install: "modpacks:install", onProgress: "modpacks:onProgress" },
  java: { discover: "java:discover", download: "java:download", onProgress: "java:onProgress" },
  servers: { list: "servers:list", add: "servers:add", remove: "servers:remove", ping: "servers:ping" },
  sessions: { list: "sessions:list", clear: "sessions:clear" },
  resources: { onSample: "resources:onSample" },
  screenshots: { list: "screenshots:list", reveal: "screenshots:reveal", remove: "screenshots:remove" },
  backups: { create: "backups:create", list: "backups:list", restore: "backups:restore", remove: "backups:remove", openFolder: "backups:openFolder" },
  crash: { getData: "crash:getData", onOpen: "crash:onOpen" },
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
    clone: (id: string, name: string) => Promise<Instance>
    chooseDirectory: (id: string) => Promise<string | null>; chooseIcon: (id: string) => Promise<string | null>
    openFolder: (id: string) => void; export: (id: string) => Promise<ArchiveResult>; import: () => Promise<ArchiveResult>
    listProfiles: (id: string) => Promise<InstanceProfile[]>
    saveProfile: (id: string, name: string) => Promise<InstanceProfile>
    applyProfile: (id: string, profileId: string) => Promise<void>
    deleteProfile: (id: string, profileId: string) => Promise<void>
  }
  content: {
    search: (query: ContentSearchQuery) => Promise<ContentSearchResult>
    install: (instanceId: string, type: ContentType, project: ContentProject) => Promise<InstalledContent>
    listInstalled: (instanceId: string, type: ContentType) => Promise<InstalledContent[]>
    toggle: (instanceId: string, type: ContentType, fileName: string, enabled: boolean) => Promise<void>
    remove: (instanceId: string, type: ContentType, fileName: string) => Promise<void>
    resolveDependencies: (instanceId: string, project: ContentProject) => Promise<ResolvedDependency[]>
    checkUpdates: (instanceId: string, type: ContentType) => Promise<ContentUpdate[]>
    update: (instanceId: string, type: ContentType, fileName: string) => Promise<InstalledContent>
    recommended: (type: ContentType, loader?: ModLoader, gameVersion?: string) => Promise<ContentProject[]>
  }
  favorites: {
    list: () => Promise<FavoriteContent[]>
    toggle: (project: ContentProject, type: ContentType) => Promise<FavoriteContent[]>
  }
  modpacks: {
    search: (query: ModpackSearchQuery) => Promise<ModpackSearchResult>
    install: (project: ModpackProject) => Promise<Instance>
    onProgress: (cb: (progress: ModpackInstallProgress) => void) => () => void
  }
  java: {
    discover: () => Promise<JavaRuntime[]>; download: (minecraftVersion: string) => Promise<JavaRuntime>
    onProgress: (cb: (fraction: number, detail: string) => void) => () => void
  }
  servers: { list: () => Promise<SavedServer[]>; add: (server: Omit<SavedServer, "id">) => Promise<SavedServer>; remove: (id: string) => Promise<void>; ping: (host: string, port: number) => Promise<ServerStatus> }
  sessions: { list: () => Promise<PlaySession[]>; clear: () => Promise<void> }
  resources: { onSample: (cb: (sample: ResourceSample) => void) => () => void }
  screenshots: {
    list: (instanceId: string) => Promise<Screenshot[]>
    reveal: (path: string) => void
    remove: (instanceId: string, name: string) => Promise<void>
  }
  backups: {
    create: (instanceId: string) => Promise<BackupEntry>
    list: (instanceId: string) => Promise<BackupEntry[]>
    restore: (id: string) => Promise<void>
    remove: (id: string) => Promise<void>
    openFolder: () => void
  }
  crash: {
    getData: () => Promise<CrashReport | null>
    onOpen: (cb: (report: CrashReport) => void) => () => void
  }
  launcher: {
    launch: (instanceId: string, server?: LaunchServerTarget) => Promise<LaunchResult>; stop: (instanceId: string) => void
    onProgress: (cb: (e: ProgressEvent) => void) => () => void; onLog: (cb: (e: GameLogLine) => void) => () => void
  }
}

export type { Account, AppInfo, AppLocale, ArchiveResult, BackupEntry, ContentProject, ContentSearchQuery, ContentSearchResult, ContentType, ContentUpdate, CrashReport, FavoriteContent, GameLogLine, InstalledContent, Instance, InstanceProfile, InstanceSettings, JavaRuntime, LaunchResult, LauncherSettings, ModLoader, ModpackInstallProgress, ModpackProject, ModpackSearchQuery, ModpackSearchResult, PlaySession, ProgressEvent, ResolvedDependency, ResourceSample, SavedServer, Screenshot, ServerStatus, SystemMemoryInfo, ThemeId, VersionManifest, VersionSummary }
