import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { basename, join, relative, resolve } from "node:path"
import AdmZip from "adm-zip"
import type { ArchiveResult, Instance } from "../../shared/types.js"
import { paths } from "../paths.js"
import { createInstance, getInstance, updateInstance } from "./instances.js"

const INCLUDED = ["mods", "resourcepacks", "shaderpacks", "config", "saves"]

function assertSafe(relativePath: string): void {
  const normalized = relativePath.replace(/\\/g, "/")
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) throw new Error("Archive contains an unsafe path")
}

function addDirectory(zip: AdmZip, root: string, current: string): void {
  if (!existsSync(current)) return
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name)
    const rel = relative(root, path).replace(/\\/g, "/")
    assertSafe(rel)
    if (entry.isDirectory()) addDirectory(zip, root, path)
    else if (statSync(path).size <= 512 * 1024 * 1024) zip.addFile(`game/${rel}`, readFileSync(path))
  }
}

export function exportInstance(instanceId: string, destination: string): ArchiveResult {
  try {
    const instance = getInstance(instanceId)
    if (!instance) throw new Error("Instance not found")
    const zip = new AdmZip()
    const manifest = { format: 1, exportedAt: new Date().toISOString(), instance }
    zip.addFile("ordolith-instance.json", Buffer.from(JSON.stringify(manifest, null, 2)))
    const gameDir = instance.settings.gameDirectory || instance.gameDirectory || paths.gameDir(instance.dirName)
    for (const folder of INCLUDED) addDirectory(zip, gameDir, join(gameDir, folder))
    const target = destination.toLowerCase().endsWith(".zip") ? destination : `${destination}.zip`
    zip.writeZip(target)
    return { ok: true, path: target }
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) } }
}

export function importInstance(source: string): ArchiveResult {
  try {
    const zip = new AdmZip(source)
    const manifestEntry = zip.getEntry("ordolith-instance.json")
    if (!manifestEntry) throw new Error("Not an Ordolith instance archive")
    const manifest = JSON.parse(manifestEntry.getData().toString("utf8")) as { format: number; instance: Instance }
    if (manifest.format !== 1) throw new Error("Unsupported archive format")
    const imported = createInstance({
      name: `${manifest.instance.name} (Imported)`, versionId: manifest.instance.versionId,
      loader: manifest.instance.loader, settings: manifest.instance.settings, iconColor: manifest.instance.iconColor,
    })
    const gameRoot = paths.gameDir(imported.dirName)
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || !entry.entryName.startsWith("game/")) continue
      const rel = entry.entryName.slice(5)
      assertSafe(rel)
      const target = resolve(gameRoot, rel)
      if (!target.startsWith(resolve(gameRoot))) throw new Error("Archive path escaped instance directory")
      mkdirSync(join(target, ".."), { recursive: true })
      writeFileSync(target, entry.getData())
    }
    updateInstance(imported.id, { iconPath: manifest.instance.iconPath })
    return { ok: true, instanceId: imported.id }
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) } }
}

export function defaultExportName(instance: Instance): string {
  return `${basename(instance.name).replace(/[^a-z0-9_-]/gi, "-") || "instance"}.ordolith.zip`
}
