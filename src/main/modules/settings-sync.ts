import { dialog } from "electron"
import { readFileSync, writeFileSync } from "node:fs"
import type { ArchiveResult, LauncherSettings, SavedServer } from "../../shared/types.js"
import { store } from "../store.js"

interface SettingsBundle {
  format: 1
  exportedAt: string
  settings: LauncherSettings
  servers: SavedServer[]
}

/**
 * Exports portable preferences (launcher settings + saved servers) to a JSON
 * file the user picks. Deliberately excludes accounts, secrets and instances
 * so the file is safe to share or sync across machines.
 */
export async function exportSettings(): Promise<ArchiveResult> {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Export settings",
      defaultPath: "ordolith-settings.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    })
    if (canceled || !filePath) return { ok: false, error: "cancelled" }
    const bundle: SettingsBundle = {
      format: 1,
      exportedAt: new Date().toISOString(),
      settings: store.getSettings(),
      servers: store.getServers(),
    }
    writeFileSync(filePath, JSON.stringify(bundle, null, 2), "utf8")
    return { ok: true, path: filePath }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Imports a previously exported settings bundle, merging servers by address. */
export async function importSettings(): Promise<ArchiveResult> {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Import settings",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    })
    if (canceled || filePaths.length === 0) return { ok: false, error: "cancelled" }
    const parsed = JSON.parse(readFileSync(filePaths[0], "utf8")) as Partial<SettingsBundle>
    if (parsed.format !== 1 || !parsed.settings) throw new Error("Unsupported settings file")

    store.saveSettings(parsed.settings)

    if (Array.isArray(parsed.servers)) {
      const existing = store.getServers()
      const seen = new Set(existing.map((s) => `${s.host}:${s.port}`))
      const merged = [...existing]
      for (const srv of parsed.servers) {
        const key = `${srv.host}:${srv.port}`
        if (seen.has(key)) continue
        seen.add(key)
        merged.push({ ...srv, id: `srv_${Date.now()}_${merged.length}` })
      }
      store.saveServers(merged)
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
