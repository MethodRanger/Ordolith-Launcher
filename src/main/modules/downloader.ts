import { join } from "node:path"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import AdmZip from "adm-zip"
import { paths } from "../paths.js"
import { downloadFile, fetchJson, runPool } from "./net.js"
import { getVersionDetail } from "./versions.js"
import { libraryApplies, nativesClassifier } from "./rules.js"
import type { AssetIndex, Artifact, VersionDetail } from "./mojang-types.js"
import type { ProgressStage } from "../../shared/types.js"

const ASSET_BASE = "https://resources.download.minecraft.net"

export interface InstallResult {
  detail: VersionDetail
  /** Absolute paths of every jar that belongs on the classpath. */
  classpath: string[]
  /** Directory holding extracted native libraries for this launch. */
  nativesDir: string
}

type ProgressFn = (stage: ProgressStage, fraction: number, detail: string) => void

/** Resolve a library artifact's on-disk path under the shared libraries dir. */
function libPath(artifact: Artifact): string {
  return join(paths.libraries, artifact.path ?? "")
}

/**
 * Ensure every file needed to launch `versionId` is present on disk, then
 * return the classpath and natives directory used to spawn the JVM. Already
 * cached files (matching SHA-1) are skipped, so re-launches are fast.
 */
export async function installVersion(
  params: { versionId: string; versionUrl: string; dirName: string },
  onProgress: ProgressFn,
): Promise<InstallResult> {
  const { versionId, versionUrl, dirName } = params

  onProgress("manifest", 0, `Reading metadata for ${versionId}`)
  const detail = await getVersionDetail({ id: versionId, url: versionUrl })

  // 1. Client jar -------------------------------------------------------
  onProgress("client", 0, "Downloading client.jar")
  const clientPath = paths.versionJar(versionId)
  await downloadFile(detail.downloads.client.url, clientPath, {
    sha1: detail.downloads.client.sha1,
    size: detail.downloads.client.size,
  })
  onProgress("client", 1, "client.jar ready")

  // 2. Libraries + native jars -----------------------------------------
  const applicable = detail.libraries.filter(libraryApplies)
  const classpath: string[] = []
  const nativeJars: { path: string; exclude?: string[] }[] = []

  let libDone = 0
  await runPool(applicable, 8, async (lib) => {
    const artifact = lib.downloads?.artifact
    if (artifact?.path) {
      const dest = libPath(artifact)
      await downloadFile(artifact.url, dest, { sha1: artifact.sha1, size: artifact.size })
      classpath.push(dest)
    }

    const classifierKey = nativesClassifier(lib)
    if (classifierKey && lib.downloads?.classifiers?.[classifierKey]) {
      const nat = lib.downloads.classifiers[classifierKey]
      const dest = join(paths.libraries, nat.path ?? `${lib.name}-${classifierKey}.jar`)
      await downloadFile(nat.url, dest, { sha1: nat.sha1, size: nat.size })
      nativeJars.push({ path: dest, exclude: lib.extract?.exclude })
    }

    libDone++
    onProgress("libraries", libDone / applicable.length, `Libraries (${libDone}/${applicable.length})`)
  })

  // 3. Extract natives into a per-instance directory --------------------
  onProgress("natives", 0, "Extracting native libraries")
  const nativesDir = paths.nativesDir(dirName, versionId)
  mkdirSync(nativesDir, { recursive: true })
  for (const { path, exclude } of nativeJars) {
    const zip = new AdmZip(path)
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue
      const name = entry.entryName
      if (exclude?.some((ex) => name.startsWith(ex))) continue
      if (name.startsWith("META-INF/")) continue
      zip.extractEntryTo(entry, nativesDir, false, true)
    }
  }
  onProgress("natives", 1, "Natives ready")

  // 4. Assets -----------------------------------------------------------
  onProgress("assets", 0, "Reading asset index")
  const indexPath = join(paths.assetIndexes, `${detail.assetIndex.id}.json`)
  await downloadFile(detail.assetIndex.url, indexPath, {
    sha1: detail.assetIndex.sha1,
    size: detail.assetIndex.size,
  })
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as AssetIndex

  const objects = Object.entries(index.objects)
  let assetDone = 0
  await runPool(objects, 16, async ([, obj]) => {
    const sub = obj.hash.slice(0, 2)
    const dest = join(paths.assetObjects, sub, obj.hash)
    await downloadFile(`${ASSET_BASE}/${sub}/${obj.hash}`, dest, {
      sha1: obj.hash,
      size: obj.size,
    })
    assetDone++
    if (assetDone % 20 === 0 || assetDone === objects.length) {
      onProgress("assets", assetDone / objects.length, `Assets (${assetDone}/${objects.length})`)
    }
  })

  classpath.push(clientPath)
  return { detail, classpath, nativesDir }
}

/** Re-export so other modules can prefetch a full asset index if needed. */
export async function fetchAssetIndex(url: string): Promise<AssetIndex> {
  return fetchJson<AssetIndex>(url)
}

/** Whether a version already has its client jar + json cached. */
export function isVersionInstalled(versionId: string): boolean {
  return existsSync(paths.versionJar(versionId)) && existsSync(paths.versionJson(versionId))
}

/** Marker file writer used by other modules to persist small metadata. */
export function writeMeta(dir: string, name: string, data: unknown): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2), "utf8")
}
