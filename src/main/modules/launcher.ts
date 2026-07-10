import { spawn } from "node:child_process"
import { delimiter } from "node:path"
import { app } from "electron"
import { paths } from "../paths.js"
import { installVersion } from "./downloader.js"
import { detectJava } from "./java.js"
import { getManifest } from "./versions.js"
import { rulesAllow } from "./rules.js"
import { markPlayed } from "./instances.js"
import type { ArgValue, VersionDetail } from "./mojang-types.js"
import type { Account, GameLogLine, Instance, LaunchResult, ProgressEvent } from "../../shared/types.js"

export interface LaunchCallbacks {
  onProgress: (e: ProgressEvent) => void
  onLog: (e: GameLogLine) => void
}

export interface LaunchContext {
  instance: Instance
  account: Account
  /** Minecraft access token (real for MS accounts, a dummy for offline). */
  accessToken: string
  server?: { host: string; port: number }
}

/** Expand the ${...} placeholders Mojang uses in launch arguments. */
function makeReplacer(vars: Record<string, string>) {
  return (arg: string): string => arg.replace(/\$\{(\w+)\}/g, (_m, key: string) => vars[key] ?? `\${${key}}`)
}

/** Flatten modern argument entries, keeping only OS-applicable plain strings. */
function resolveModernArgs(entries: ArgValue[]): string[] {
  const out: string[] = []
  for (const entry of entries) {
    if (typeof entry === "string") {
      out.push(entry)
      continue
    }
    // Skip feature-gated args (demo mode, custom resolution, quickPlay, ...).
    if (!rulesAllow(entry.rules)) continue
    if (entry.rules?.some((r) => r.features)) continue
    out.push(...(Array.isArray(entry.value) ? entry.value : [entry.value]))
  }
  return out
}

function buildGameArgs(detail: VersionDetail, replace: (s: string) => string): string[] {
  if (detail.arguments?.game) {
    return resolveModernArgs(detail.arguments.game).map(replace)
  }
  // Legacy (1.12.2 and earlier) uses a single templated string.
  if (detail.minecraftArguments) {
    return detail.minecraftArguments.split(" ").map(replace)
  }
  return []
}

function buildJvmArgs(detail: VersionDetail, replace: (s: string) => string): string[] {
  if (detail.arguments?.jvm) {
    return resolveModernArgs(detail.arguments.jvm).map(replace)
  }
  // Legacy default JVM args.
  return ["-Djava.library.path=${natives_directory}", "-cp", "${classpath}"].map(replace)
}

/**
 * Full launch pipeline for an instance: ensure files are installed, resolve
 * Java, assemble the command line and spawn the JVM. Download and runtime
 * progress/logs are streamed back through the provided callbacks.
 */
export async function launchGame(ctx: LaunchContext, cb: LaunchCallbacks): Promise<LaunchResult> {
  const { instance, account, accessToken, server } = ctx
  const emit = (e: Omit<ProgressEvent, "instanceId">): void =>
    cb.onProgress({ instanceId: instance.id, ...e })

  try {
    const manifest = await getManifest()
    const summary = manifest.versions.find((v) => v.id === instance.versionId)
    if (!summary) throw new Error(`Version ${instance.versionId} is not in the supported manifest.`)

    // 1. Ensure all files are present.
    const { detail, classpath, nativesDir } = await installVersion(
      { versionId: summary.id, versionUrl: summary.url, dirName: instance.dirName },
      (stage, fraction, detailText) => emit({ stage, fraction, detail: detailText }),
    )

    // 2. Resolve Java.
    emit({ stage: "java", fraction: 0, detail: "Locating Java runtime" })
    const javaBin = await detectJava(instance.settings.javaPath)
    if (!javaBin) {
      throw new Error("No Java runtime found. Install Java 17+ or set a Java path in instance settings.")
    }
    emit({ stage: "java", fraction: 1, detail: `Using ${javaBin}` })

    // 3. Assemble arguments.
    const gameDir = paths.gameDir(instance.dirName)
    const vars: Record<string, string> = {
      auth_player_name: account.username,
      version_name: instance.versionId,
      game_directory: gameDir,
      assets_root: paths.assets,
      assets_index_name: detail.assetIndex.id,
      auth_uuid: account.uuid.replace(/-/g, ""),
      auth_access_token: accessToken,
      clientid: "",
      auth_xuid: "",
      user_type: account.kind === "microsoft" ? "msa" : "legacy",
      version_type: summary.type,
      natives_directory: nativesDir,
      launcher_name: "Ordolith",
      launcher_version: app.getVersion(),
      classpath: classpath.join(delimiter),
      user_properties: "{}",
    }
    const replace = makeReplacer(vars)

    const memoryArgs = [`-Xmx${instance.settings.maxMemoryMb}M`, `-Xms${instance.settings.minMemoryMb}M`]
    const extraJvm = instance.settings.jvmArgs.trim() ? instance.settings.jvmArgs.trim().split(/\s+/) : []

    const jvmArgs = buildJvmArgs(detail, replace)
    const gameArgs = buildGameArgs(detail, replace)

    if (server) {
      // Works through 1.19; 1.20+ maps these onto quick-play internally.
      gameArgs.push("--server", server.host, "--port", String(server.port))
    }

    const args = [...memoryArgs, ...extraJvm, ...jvmArgs, detail.mainClass, ...gameArgs]

    // 4. Spawn.
    emit({ stage: "launching", fraction: 1, detail: "Starting Minecraft" })
    const child = spawn(javaBin, args, { cwd: gameDir })

    child.stdout.on("data", (buf: Buffer) => {
      cb.onLog({ instanceId: instance.id, level: "info", line: buf.toString(), ts: Date.now() })
    })
    child.stderr.on("data", (buf: Buffer) => {
      cb.onLog({ instanceId: instance.id, level: "error", line: buf.toString(), ts: Date.now() })
    })
    child.on("error", (err) => {
      emit({ stage: "error", fraction: 0, detail: "Failed to start", error: err.message })
    })
    child.on("close", (code) => {
      emit({
        stage: code === 0 ? "done" : "error",
        fraction: 1,
        detail: `Game exited with code ${code ?? "unknown"}`,
        error: code === 0 ? undefined : `Exit code ${code}`,
      })
    })

    markPlayed(instance.id)
    emit({ stage: "running", fraction: 1, detail: "Minecraft is running" })
    return { ok: true, pid: child.pid }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    emit({ stage: "error", fraction: 0, detail: "Launch failed", error: message })
    return { ok: false, error: message }
  }
}
