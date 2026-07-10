import { existsSync, readFileSync } from "node:fs"
import { paths } from "../paths.js"
import { fetchJson, downloadFile } from "./net.js"
import type { RawVersionManifest, VersionDetail } from "./mojang-types.js"
import type { VersionManifest, VersionSummary } from "../../shared/types.js"

const MANIFEST_URL = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json"

/** Oldest release we support, per product requirements. */
const MIN_RELEASE = "1.12.2"

let cache: VersionManifest | null = null

/**
 * Fetch the official Mojang manifest and reduce it to the supported range:
 * releases from 1.12.2 up to the latest, plus any snapshots newer than that
 * cut-off (the UI hides snapshots behind a toggle). Each entry is flagged as
 * installed when its client jar is already cached on disk.
 */
export async function getManifest(force = false): Promise<VersionManifest> {
  if (cache && !force) return cache

  const raw = await fetchJson<RawVersionManifest>(MANIFEST_URL)

  const minEntry = raw.versions.find((v) => v.id === MIN_RELEASE)
  const cutoff = minEntry ? Date.parse(minEntry.releaseTime) : 0

  const versions: VersionSummary[] = raw.versions
    .filter((v) => Date.parse(v.releaseTime) >= cutoff)
    .map((v) => ({
      id: v.id,
      type: v.type,
      url: v.url,
      releaseTime: v.releaseTime,
      installed: existsSync(paths.versionJar(v.id)),
    }))

  cache = { latest: raw.latest, versions }
  return cache
}

/**
 * Return the detailed version JSON, downloading and caching it on first use.
 */
export async function getVersionDetail(summary: {
  id: string
  url: string
}): Promise<VersionDetail> {
  const localPath = paths.versionJson(summary.id)
  if (existsSync(localPath)) {
    return JSON.parse(readFileSync(localPath, "utf8")) as VersionDetail
  }
  const detail = await fetchJson<VersionDetail>(summary.url)
  await downloadFile(summary.url, localPath)
  return detail
}
