import { app, safeStorage } from "electron"
import { statfs } from "node:fs/promises"
import { totalmem, freemem, release, cpus } from "node:os"
import type { DiagnosticItem, DiagnosticsReport } from "../../shared/types.js"
import { paths } from "../paths.js"
import { store } from "../store.js"
import { discoverJava } from "./java-runtimes.js"

const GiB = 1024 * 1024 * 1024

function fmtBytes(bytes: number): string {
  if (bytes >= GiB) return `${(bytes / GiB).toFixed(1)} GB`
  return `${Math.max(0, Math.round(bytes / (1024 * 1024)))} MB`
}

/** Free space on the volume that holds the launcher data directory. */
async function diskFree(): Promise<{ free: number; total: number } | null> {
  try {
    const s = await statfs(paths.root)
    return { free: s.bsize * s.bavail, total: s.bsize * s.blocks }
  } catch {
    return null
  }
}

/**
 * Collects a snapshot of environment/runtime health used by the Settings
 * diagnostics panel. Every check is best-effort and never throws.
 */
export async function collectDiagnostics(): Promise<DiagnosticsReport> {
  const items: DiagnosticItem[] = []

  items.push({
    id: "platform",
    labelKey: "diagnostics.platform",
    value: `${process.platform} ${process.arch} · ${release()}`,
    status: "info",
  })

  const core = cpus()
  items.push({
    id: "cpu",
    labelKey: "diagnostics.cpu",
    value: core.length ? `${core[0].model.trim()} · ${core.length}×` : `${core.length} cores`,
    status: "info",
  })

  const totalMb = Math.floor(totalmem() / 1048576)
  const freeMb = Math.floor(freemem() / 1048576)
  items.push({
    id: "memory",
    labelKey: "diagnostics.memory",
    value: `${freeMb} / ${totalMb} MB free`,
    status: totalMb < 4096 ? "warn" : "ok",
  })

  const disk = await diskFree()
  if (disk) {
    items.push({
      id: "disk",
      labelKey: "diagnostics.disk",
      value: `${fmtBytes(disk.free)} / ${fmtBytes(disk.total)} free`,
      status: disk.free < 2 * GiB ? "warn" : "ok",
    })
  }

  try {
    const runtimes = await discoverJava()
    items.push({
      id: "java",
      labelKey: "diagnostics.java",
      value: runtimes.length
        ? [...new Set(runtimes.map((r) => r.major))].sort((a, b) => a - b).join(", ")
        : "—",
      status: runtimes.length ? "ok" : "error",
    })
  } catch {
    items.push({ id: "java", labelKey: "diagnostics.java", value: "—", status: "error" })
  }

  items.push({
    id: "instances",
    labelKey: "diagnostics.instances",
    value: String(store.getInstances().length),
    status: "info",
  })

  items.push({
    id: "encryption",
    labelKey: "diagnostics.encryption",
    value: safeStorage.isEncryptionAvailable() ? "ok" : "unavailable",
    status: safeStorage.isEncryptionAvailable() ? "ok" : "warn",
  })

  items.push({
    id: "versions",
    labelKey: "diagnostics.runtime",
    value: `Electron ${process.versions.electron} · Node ${process.versions.node}`,
    status: "info",
  })

  items.push({
    id: "appVersion",
    labelKey: "diagnostics.appVersion",
    value: app.getVersion(),
    status: "info",
  })

  return { generatedAt: Date.now(), items }
}
