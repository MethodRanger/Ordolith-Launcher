import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { randomUUID } from "node:crypto"
import { shell } from "electron"
import AdmZip from "adm-zip"
import { paths } from "../paths.js"
import { store } from "../store.js"
import { getInstance } from "./instances.js"
import type { BackupEntry, Instance } from "../../shared/types.js"

/** Folders/files captured in a backup (worlds + configuration). */
const TARGETS = ["saves", "config", "options.txt", "servers.dat"]

function backupsRoot(): string {
  const dir = join(paths.root, "backups")
  mkdirSync(dir, { recursive: true })
  return dir
}

function gameOf(instance: Instance): string {
  return instance.settings.gameDirectory || instance.gameDirectory || paths.gameDir(instance.dirName)
}

function assertSafe(rel: string): void {
  const normalized = rel.replace(/\\/g, "/")
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) throw new Error("Unsafe backup path")
}

function addPath(zip: AdmZip, root: string, current: string): void {
  if (!existsSync(current)) return
  const stat = statSync(current)
  if (stat.isDirectory()) {
    for (const entry of readdirSync(current)) addPath(zip, root, join(current, entry))
  } else if (stat.size <= 512 * 1024 * 1024) {
    const rel = relative(root, current).replace(/\\/g, "/")
    assertSafe(rel)
    zip.addFile(rel, readFileSync(current))
  }
}

/** Create a timestamped ZIP backup of an instance's worlds + config. */
export function createBackup(instanceId: string): BackupEntry {
  const instance = getInstance(instanceId)
  if (!instance) throw new Error("Instance not found")
  const game = gameOf(instance)
  const zip = new AdmZip()
  for (const target of TARGETS) addPath(zip, game, join(game, target))
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const fileName = `${instance.dirName}-${stamp}.zip`
  const dir = join(backupsRoot(), instanceId)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, fileName)
  zip.writeZip(path)
  const entry: BackupEntry = {
    id: randomUUID(),
    instanceId,
    instanceName: instance.name,
    fileName,
    path,
    size: statSync(path).size,
    createdAt: Date.now(),
  }
  store.saveBackups([entry, ...store.getBackups()])
  return entry
}

export function listBackups(instanceId: string): BackupEntry[] {
  return store.getBackups().filter((b) => b.instanceId === instanceId)
}

/** Extract a backup back into its instance's game directory (ZIP-slip safe). */
export function restoreBackup(id: string): void {
  const entry = store.getBackups().find((b) => b.id === id)
  if (!entry) throw new Error("Backup not found")
  const instance = getInstance(entry.instanceId)
  if (!instance) throw new Error("Instance not found")
  if (!existsSync(entry.path)) throw new Error("Backup file missing")
  const game = gameOf(instance)
  const zip = new AdmZip(entry.path)
  for (const zipEntry of zip.getEntries()) {
    if (zipEntry.isDirectory) continue
    assertSafe(zipEntry.entryName)
    const target = resolve(game, zipEntry.entryName)
    if (!target.startsWith(resolve(game))) throw new Error("Backup path escaped instance directory")
    mkdirSync(join(target, ".."), { recursive: true })
    writeFileSync(target, zipEntry.getData())
  }
}

export function removeBackup(id: string): void {
  const entry = store.getBackups().find((b) => b.id === id)
  if (entry) rmSync(entry.path, { force: true })
  store.saveBackups(store.getBackups().filter((b) => b.id !== id))
}

export function openBackupsFolder(): void {
  void shell.openPath(backupsRoot())
}
