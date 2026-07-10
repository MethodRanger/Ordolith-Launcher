/**
 * Domain models shared across the main and renderer processes.
 * These describe the launcher's core entities: accounts, versions,
 * instances, servers and launch/download progress events.
 */

/* ------------------------------------------------------------------ */
/* Accounts                                                           */
/* ------------------------------------------------------------------ */

export type AccountKind = "microsoft" | "offline"

export interface Account {
  id: string
  kind: AccountKind
  /** In-game username (gamertag for MS, free text for offline). */
  username: string
  /** Minecraft profile UUID (dashed form). */
  uuid: string
  /** Whether this is the account the launcher will use to start the game. */
  active: boolean
  /** MS only: epoch ms when the Minecraft token expires. */
  expiresAt?: number
  /** Optional avatar/skin head URL. */
  avatarUrl?: string
}

/* ------------------------------------------------------------------ */
/* Versions                                                            */
/* ------------------------------------------------------------------ */

export type VersionType = "release" | "snapshot" | "old_beta" | "old_alpha"

/** A single entry from the Mojang version manifest. */
export interface VersionSummary {
  id: string
  type: VersionType
  url: string
  releaseTime: string
  /** True when the version's files are already fully cached locally. */
  installed: boolean
}

export interface VersionManifest {
  latest: { release: string; snapshot: string }
  versions: VersionSummary[]
}

/* ------------------------------------------------------------------ */
/* Instances                                                           */
/* ------------------------------------------------------------------ */

export interface InstanceSettings {
  /** Max heap in MB (-Xmx). */
  maxMemoryMb: number
  /** Min heap in MB (-Xms). */
  minMemoryMb: number
  /** Extra raw JVM arguments. */
  jvmArgs: string
  /** Absolute path to a specific Java binary, or empty to auto-detect. */
  javaPath: string
  /** Window and display options. */
  width?: number
  height?: number
  fullscreen?: boolean
  /** Optional isolated game directory override. */
  gameDirectory?: string
  /** Optional managed icon path. */
  iconPath?: string
  /** Optional GC tuning preset. */
  gcPreset?: "default" | "g1gc" | "zgc" | "shenandoah"
}

export type ModLoader = "vanilla" | "fabric" | "forge" | "quilt" | "neoforge"
export type AppLocale = "ru" | "en" | "es" | "zh"
export type ContentType = "mod" | "resourcepack" | "shader"
export type ContentProvider = "modrinth" | "curseforge"

/** A discoverable modpack from a provider's catalog. */
export interface ModpackProject {
  id: string
  provider: ContentProvider
  slug: string
  title: string
  description: string
  iconUrl?: string
  author: string
  downloads: number
  updatedAt: string
  loaders: ModLoader[]
  gameVersions: string[]
  categories: string[]
}

export interface ModpackSearchQuery {
  query: string
  loader?: ModLoader
  gameVersion?: string
  sort?: "relevance" | "downloads" | "updated"
  offset?: number
  limit?: number
}

export interface ModpackSearchResult {
  projects: ModpackProject[]
  total: number
  providerHealth: Record<ContentProvider, "online" | "unavailable" | "error" | "cached">
}

/** Progress emitted while a modpack is being installed. */
export interface ModpackInstallProgress {
  fraction: number
  detail: string
}

export interface WindowSettings {
  width: number
  height: number
  fullscreen: boolean
}

export interface JavaRuntime {
  id: string
  path: string
  version: string
  major: number
  vendor: string
  managed: boolean
  compatible: boolean
}

export interface ContentSearchQuery {
  query: string
  /** Optional: scope results/facets to an existing instance's loader + version. */
  instanceId?: string
  /** Optional loader filter used when browsing without an instance. */
  loader?: ModLoader
  /** Optional Minecraft version filter used when browsing without an instance. */
  gameVersion?: string
  type: ContentType
  category?: string
  sort?: "relevance" | "downloads" | "updated"
  offset?: number
  limit?: number
}

export interface ContentProject {
  id: string
  provider: ContentProvider
  slug: string
  title: string
  description: string
  iconUrl?: string
  author: string
  downloads: number
  updatedAt: string
  types: ContentType[]
  loaders: ModLoader[]
  gameVersions: string[]
  categories: string[]
}

export interface ContentDependency {
  projectId: string
  provider: ContentProvider
  required: boolean
  title?: string
}

export interface ContentFile {
  id: string
  projectId: string
  provider: ContentProvider
  name: string
  fileName: string
  downloadUrl: string
  size: number
  hashes: { sha1?: string; sha512?: string; murmur2?: string }
  gameVersions: string[]
  loaders: ModLoader[]
  dependencies: ContentDependency[]
}

export interface InstalledContent {
  id: string
  projectId: string
  provider: ContentProvider
  instanceId: string
  type: ContentType
  title: string
  fileName: string
  versionName: string
  enabled: boolean
  installedAt: number
  updateAvailable?: boolean
}

export interface ContentSearchResult {
  projects: ContentProject[]
  total: number
  providerHealth: Record<ContentProvider, "online" | "unavailable" | "error" | "cached">
}

export interface LauncherSettings {
  locale: AppLocale
  defaultMinMemoryMb: number
  defaultMaxMemoryMb: number
  jvmArgs: string
  closeToTray: boolean
}

export interface SystemMemoryInfo {
  totalMb: number
  freeMb: number
}

export interface ArchiveResult {
  ok: boolean
  path?: string
  instanceId?: string
  error?: string
}

export interface ChangelogEntry {
  version: string
  releaseDate: string
  titleKey: string
  summaryKey: string
  highlights: string[]
}

export interface Instance {
  id: string
  name: string
  versionId: string
  loader: ModLoader
  /** Directory name under the launcher's instances root. */
  dirName: string
  settings: InstanceSettings
  createdAt: number
  lastPlayed?: number
  iconColor: string
  iconPath?: string
  gameDirectory?: string
}

/* ------------------------------------------------------------------ */
/* Servers                                                             */
/* ------------------------------------------------------------------ */

export interface SavedServer {
  id: string
  name: string
  host: string
  port: number
}

export interface ServerStatus {
  online: boolean
  motd?: string
  playersOnline?: number
  playersMax?: number
  version?: string
  latencyMs?: number
  favicon?: string
  error?: string
}

/* ------------------------------------------------------------------ */
/* Download & launch progress                                          */
/* ------------------------------------------------------------------ */

export type ProgressStage =
  | "idle"
  | "manifest"
  | "client"
  | "libraries"
  | "assets"
  | "natives"
  | "java"
  | "launching"
  | "running"
  | "done"
  | "error"

export interface ProgressEvent {
  instanceId: string
  stage: ProgressStage
  /** 0..1 for the current stage. */
  fraction: number
  /** Human-readable detail, e.g. the file currently downloading. */
  detail: string
  /** Set when stage === "error". */
  error?: string
}

export interface GameLogLine {
  instanceId: string
  level: "info" | "warn" | "error"
  line: string
  ts: number
}

/** Result of a launch request. */
export interface LaunchResult {
  ok: boolean
  pid?: number
  error?: string
}

/** Basic runtime info surfaced to the renderer at startup. */
export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: NodeJS.Platform
  arch: string
  /** Absolute path to the launcher data directory. */
  dataDir: string
}
