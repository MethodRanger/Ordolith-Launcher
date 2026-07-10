import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { safeStorage } from "electron"
import { paths } from "./paths.js"
import type { Account, Instance, SavedServer } from "../shared/types.js"

interface ConfigShape {
  accounts: Account[]
  instances: Instance[]
  servers: SavedServer[]
  /** Per-account encrypted secrets (e.g. MS refresh token), base64. */
  secrets: Record<string, string>
}

const EMPTY: ConfigShape = {
  accounts: [],
  instances: [],
  servers: [],
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
      const parsed = JSON.parse(readFileSync(paths.configFile, "utf8"))
      this.cache = { ...structuredClone(EMPTY), ...parsed }
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
