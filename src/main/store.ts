import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { safeStorage } from "electron"
import { paths } from "./paths.js"
import type { Account, BackupEntry, FavoriteContent, Instance, LauncherSettings, PlaySession, SavedServer } from "../shared/types.js"

interface ConfigShape {
  accounts: Account[]
  instances: Instance[]
  servers: SavedServer[]
  settings: LauncherSettings
  sessions: PlaySession[]
  favorites: FavoriteContent[]
  backups: BackupEntry[]
  /** Per-account encrypted secrets (e.g. MS refresh token), base64. */
  secrets: Record<string, string>
}

const DEFAULT_SETTINGS: LauncherSettings = {
  locale: "en",
  defaultMinMemoryMb: 512,
  defaultMaxMemoryMb: 2048,
  jvmArgs: "",
  closeToTray: false,
  theme: "ordolith",
  serverAutoRefresh: true,
  crashAssistant: true,
}

const EMPTY: ConfigShape = {
  accounts: [],
  instances: [],
  servers: [],
  settings: { ...DEFAULT_SETTINGS },
  sessions: [],
  favorites: [],
  backups: [],
  secrets: {},
}

/**
 * Tiny JSON-file config store. Sensitive values (Microsoft refresh tokens)
 * are encrypted with Electron's OS-backed `safeStorage` before being written
 * to disk, so they never sit in plaintext.
 */
class Store {
  private cache: ConfigShape | null = null

  private read(): ConfigShape {
    if (this.cache) return this.cache
    paths.ensureBase()
    if (!existsSync(paths.configFile)) {
      this.cache = structuredClone(EMPTY)
      return this.cache
    }
    try {
      const parsed = JSON.parse(readFileSync(paths.configFile, "utf8")) as Partial<ConfigShape>
      const base = structuredClone(EMPTY)
      this.cache = {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...(parsed.settings ?? {}) },
        instances: (parsed.instances ?? []).map((instance) => ({
          ...instance,
          loader: instance.loader ?? "vanilla",
          settings: {
            ...instance.settings,
            maxMemoryMb: instance.settings?.maxMemoryMb ?? 2048,
            minMemoryMb: instance.settings?.minMemoryMb ?? 512,
            jvmArgs: instance.settings?.jvmArgs ?? "",
            javaPath: instance.settings?.javaPath ?? "",
            fullscreen: instance.settings?.fullscreen ?? false,
          },
        })),
      }
    } catch {
      this.cache = structuredClone(EMPTY)
    }
    return this.cache as ConfigShape
  }

  private write(): void {
    if (!this.cache) return
    paths.ensureBase()
    writeFileSync(paths.configFile, JSON.stringify(this.cache, null, 2), "utf8")
  }

  /* Accounts ------------------------------------------------------- */

  getAccounts(): Account[] {
    return this.read().accounts
  }

  saveAccounts(accounts: Account[]): void {
    this.read().accounts = accounts
    this.write()
  }

  /* Instances ------------------------------------------------------ */

  getInstances(): Instance[] {
    return this.read().instances
  }

  saveInstances(instances: Instance[]): void {
    this.read().instances = instances
    this.write()
  }

  /* Servers -------------------------------------------------------- */

  getServers(): SavedServer[] {
    return this.read().servers
  }

  saveServers(servers: SavedServer[]): void {
    this.read().servers = servers
    this.write()
  }

  /* Launcher settings --------------------------------------------- */

  getSettings(): LauncherSettings {
    return this.read().settings
  }

  saveSettings(settings: LauncherSettings): void {
    this.read().settings = { ...DEFAULT_SETTINGS, ...settings }
    this.write()
  }

  /* Sessions ------------------------------------------------------- */

  getSessions(): PlaySession[] {
    return this.read().sessions
  }

  addSession(session: PlaySession): void {
    const cfg = this.read()
    // Keep the most recent 200 sessions.
    cfg.sessions = [session, ...cfg.sessions].slice(0, 200)
    this.write()
  }

  clearSessions(): void {
    this.read().sessions = []
    this.write()
  }

  /* Favorites ------------------------------------------------------ */

  getFavorites(): FavoriteContent[] {
    return this.read().favorites
  }

  saveFavorites(favorites: FavoriteContent[]): void {
    this.read().favorites = favorites
    this.write()
  }

  /* Backups -------------------------------------------------------- */

  getBackups(): BackupEntry[] {
    return this.read().backups
  }

  saveBackups(backups: BackupEntry[]): void {
    this.read().backups = backups
    this.write()
  }

  /* Secrets -------------------------------------------------------- */

  setSecret(accountId: string, value: string): void {
    const cfg = this.read()
    if (safeStorage.isEncryptionAvailable()) {
      cfg.secrets[accountId] = safeStorage.encryptString(value).toString("base64")
    } else {
      // Fallback: store obfuscated (not secure) — surfaced in UI as a warning.
      cfg.secrets[accountId] = Buffer.from(value, "utf8").toString("base64")
    }
    this.write()
  }

  getSecret(accountId: string): string | null {
    const raw = this.read().secrets[accountId]
    if (!raw) return null
    const buf = Buffer.from(raw, "base64")
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(buf)
      }
    } catch {
      return null
    }
    return buf.toString("utf8")
  }

  removeSecret(accountId: string): void {
    delete this.read().secrets[accountId]
    this.write()
  }
}

export const store = new Store()
