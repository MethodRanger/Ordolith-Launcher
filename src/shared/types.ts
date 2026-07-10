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
  /** Optional resolution overrides. */
  width?: number
  height?: number
}

export type ModLoader = "vanilla" | "fabric" | "forge" | "quilt"

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
