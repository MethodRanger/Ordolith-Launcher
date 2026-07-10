import { mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomUUID } from "node:crypto"
import AdmZip from "adm-zip"
import type {
  ModLoader,
  ModpackInstallProgress,
  ModpackProject,
  ModpackSearchQuery,
  ModpackSearchResult,
  Instance,
} from "../../shared/types.js"
import { downloadFile, runPool } from "./net.js"
import { createInstance } from "./instances.js"
import { paths } from "../paths.js"

const USER_AGENT = "Ordolith/0.1.0 (github.com/MethodRanger/Ordolith-Launcher)"
const MODRINTH = "https://api.modrinth.com/v2"
const CURSEFORGE = "https://api.curseforge.com/v1"
const CF_MODPACK_CLASS = 4471
const cache = new Map<string, { expires: number; value: ModpackSearchResult }>()

type ProgressFn = (progress: ModpackInstallProgress) => void

/** Map a Modrinth/CurseForge loader label onto our ModLoader union. */
function normalizeLoader(value: string): ModLoader | null {
  const v = value.toLowerCase()
  if (v.includes("neoforge")) return "neoforge"
  if (v.includes("forge")) return "forge"
  if (v.includes("fabric")) return "fabric"
  if (v.includes("quilt")) return "quilt"
  return null
}

/* -------------------------------------------------------------------- */
/* Search                                                               */
/* -------------------------------------------------------------------- */

async function modrinthSearch(query: ModpackSearchQuery): Promise<ModpackProject[]> {
  const facets: string[][] = [["project_type:modpack"]]
  if (query.loader && query.loader !== "vanilla") facets.push([`categories:${query.loader}`])
  if (query.gameVersion) facets.push([`versions:${query.gameVersion}`])
  const params = new URLSearchParams({
    query: query.query,
    limit: String(query.limit ?? 20),
    offset: String(query.offset ?? 0),
    index: query.sort === "updated" ? "updated" : query.sort === "downloads" ? "downloads" : "relevance",
    facets: JSON.stringify(facets),
  })
  const response = await fetch(`${MODRINTH}/search?${params}`, { headers: { "User-Agent": USER_AGENT } })
  if (!response.ok) throw new Error(`Modrinth returned ${response.status}`)
  const data = (await response.json()) as { hits: Array<Record<string, unknown>> }
  return data.hits.map((hit) => ({
    id: String(hit.project_id),
    provider: "modrinth" as const,
    slug: String(hit.slug),
    title: String(hit.title),
    description: String(hit.description ?? ""),
    iconUrl: typeof hit.icon_url === "string" ? hit.icon_url : undefined,
    author: String(hit.author ?? "Modrinth creator"),
    downloads: Number(hit.downloads ?? 0),
    updatedAt: String(hit.date_modified ?? ""),
    loaders: ((hit.categories as string[] | undefined) ?? [])
      .map(normalizeLoader)
      .filter((v): v is ModLoader => v !== null),
    gameVersions: (hit.versions as string[] | undefined) ?? [],
    categories: (hit.display_categories as string[] | undefined) ?? [],
  }))
}

async function curseforgeSearch(query: ModpackSearchQuery): Promise<ModpackProject[]> {
  const key = process.env.CURSEFORGE_API_KEY
  if (!key) throw new Error("CurseForge API key is not configured")
  const params = new URLSearchParams({
    gameId: "432",
    classId: String(CF_MODPACK_CLASS),
    searchFilter: query.query,
    pageSize: String(query.limit ?? 20),
    index: String(query.offset ?? 0),
    sortField: query.sort === "updated" ? "3" : query.sort === "downloads" ? "6" : "2",
    sortOrder: "desc",
  })
  if (query.gameVersion) params.set("gameVersion", query.gameVersion)
  const response = await fetch(`${CURSEFORGE}/mods/search?${params}`, { headers: { "x-api-key": key } })
  if (!response.ok) throw new Error(`CurseForge returned ${response.status}`)
  const json = (await response.json()) as { data: Array<Record<string, unknown>> }
  return json.data.map((raw) => {
    const authors = raw.authors as Array<{ name: string }> | undefined
    const logo = raw.logo as { url?: string } | undefined
    const categories = raw.categories as Array<{ name: string }> | undefined
    const latestFiles = raw.latestFilesIndexes as Array<{ gameVersion?: string }> | undefined
    return {
      id: String(raw.id),
      provider: "curseforge" as const,
      slug: String(raw.slug),
      title: String(raw.name),
      description: String(raw.summary ?? ""),
      iconUrl: logo?.url,
      author: authors?.[0]?.name ?? "CurseForge creator",
      downloads: Number(raw.downloadCount ?? 0),
      updatedAt: String(raw.dateModified ?? ""),
      loaders: [],
      gameVersions: [...new Set((latestFiles ?? []).map((f) => f.gameVersion).filter((v): v is string => !!v))],
      categories: categories?.map((item) => item.name) ?? [],
    }
  })
}

export async function searchModpacks(query: ModpackSearchQuery): Promise<ModpackSearchResult> {
  const cacheKey = JSON.stringify(query)
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.value

  const [modrinth, curseforge] = await Promise.allSettled([modrinthSearch(query), curseforgeSearch(query)])
  const projects = [
    ...(modrinth.status === "fulfilled" ? modrinth.value : []),
    ...(curseforge.status === "fulfilled" ? curseforge.value : []),
  ]
  const value: ModpackSearchResult = {
    projects,
    total: projects.length,
    providerHealth: {
      modrinth: modrinth.status === "fulfilled" ? "online" : "error",
      curseforge: !process.env.CURSEFORGE_API_KEY
        ? "unavailable"
        : curseforge.status === "fulfilled"
          ? "online"
          : "error",
    },
  }
  cache.set(cacheKey, { value, expires: Date.now() + 60_000 })
  return value
}

/* -------------------------------------------------------------------- */
/* Install                                                              */
/* -------------------------------------------------------------------- */

interface MrpackIndex {
  name: string
  versionId?: string
  dependencies: Record<string, string>
  files: Array<{
    path: string
    downloads: string[]
    hashes: { sha1?: string; sha512?: string }
    fileSize?: number
    env?: { client?: string; server?: string }
  }>
}

/** Resolve minecraft version + loader from a .mrpack dependency map. */
function resolveMrpackTarget(deps: Record<string, string>): { versionId: string; loader: ModLoader } {
  const versionId = deps["minecraft"] ?? ""
  let loader: ModLoader = "vanilla"
  if (deps["fabric-loader"]) loader = "fabric"
  else if (deps["quilt-loader"]) loader = "quilt"
  else if (deps["neoforge"]) loader = "neoforge"
  else if (deps["forge"]) loader = "forge"
  return { versionId, loader }
}

async function fetchModrinthVersionFile(projectId: string): Promise<{ url: string; name: string }> {
  const response = await fetch(`${MODRINTH}/project/${projectId}/version`, { headers: { "User-Agent": USER_AGENT } })
  if (!response.ok) throw new Error("Could not list Modrinth modpack versions")
  const versions = (await response.json()) as Array<Record<string, unknown>>
  const version = versions[0]
  if (!version) throw new Error("Modpack has no published version")
  const files = version.files as Array<Record<string, unknown>>
  const file = files.find((f) => String(f.filename).endsWith(".mrpack")) ?? files.find((f) => f.primary) ?? files[0]
  if (!file) throw new Error("No downloadable modpack file")
  return { url: String(file.url), name: String(version.name ?? projectId) }
}

async function installModrinthPack(project: ModpackProject, onProgress: ProgressFn): Promise<Instance> {
  onProgress({ fraction: 0.02, detail: "Fetching modpack metadata" })
  const { url } = await fetchModrinthVersionFile(project.id)

  const work = join(tmpdir(), `ordolith-mrpack-${randomUUID()}`)
  mkdirSync(work, { recursive: true })
  const packPath = join(work, "pack.mrpack")
  try {
    onProgress({ fraction: 0.08, detail: "Downloading modpack archive" })
    await downloadFile(url, packPath)

    const zip = new AdmZip(packPath)
    const indexEntry = zip.getEntry("modrinth.index.json")
    if (!indexEntry) throw new Error("Invalid .mrpack: missing modrinth.index.json")
    const index = JSON.parse(zip.readAsText(indexEntry)) as MrpackIndex

    const { versionId, loader } = resolveMrpackTarget(index.dependencies)
    if (!versionId) throw new Error("Modpack does not declare a Minecraft version")

    const instance = createInstance({ name: project.title, versionId, loader })
    const gameDir = paths.gameDir(instance.dirName)
    mkdirSync(gameDir, { recursive: true })

    // 1. Client-side declared files.
    const clientFiles = index.files.filter((f) => f.env?.client !== "unsupported")
    let done = 0
    await runPool(clientFiles, 8, async (file) => {
      const dest = join(gameDir, file.path)
      await downloadFile(file.downloads[0], dest, { sha1: file.hashes.sha1, size: file.fileSize })
      done++
      onProgress({
        fraction: 0.1 + 0.75 * (done / Math.max(clientFiles.length, 1)),
        detail: `Downloading files (${done}/${clientFiles.length})`,
      })
    })

    // 2. Overrides bundled inside the archive.
    onProgress({ fraction: 0.9, detail: "Applying overrides" })
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue
      const name = entry.entryName
      const prefix = name.startsWith("overrides/") ? "overrides/" : name.startsWith("client-overrides/") ? "client-overrides/" : null
      if (!prefix) continue
      const rel = name.slice(prefix.length)
      if (!rel) continue
      const target = join(gameDir, rel)
      mkdirSync(join(target, ".."), { recursive: true })
      zip.extractEntryTo(entry, join(gameDir, rel, ".."), false, true)
    }

    onProgress({ fraction: 1, detail: "Modpack installed" })
    return instance
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

interface CurseManifest {
  minecraft: { version: string; modLoaders: Array<{ id: string; primary?: boolean }> }
  name: string
  files: Array<{ projectID: number; fileID: number; required?: boolean }>
  overrides?: string
}

async function cfFileDownloadUrl(projectId: number, fileId: number, key: string): Promise<{ url: string; name: string } | null> {
  const response = await fetch(`${CURSEFORGE}/mods/${projectId}/files/${fileId}`, { headers: { "x-api-key": key } })
  if (!response.ok) return null
  const json = (await response.json()) as { data?: { downloadUrl?: string; fileName?: string } }
  const url = json.data?.downloadUrl
  if (!url) return null
  return { url, name: json.data?.fileName ?? String(fileId) }
}

async function installCursePack(project: ModpackProject, onProgress: ProgressFn): Promise<Instance> {
  const key = process.env.CURSEFORGE_API_KEY
  if (!key) throw new Error("CurseForge API key is not configured")

  onProgress({ fraction: 0.02, detail: "Fetching modpack metadata" })
  const filesRes = await fetch(`${CURSEFORGE}/mods/${project.id}/files?pageSize=1`, { headers: { "x-api-key": key } })
  if (!filesRes.ok) throw new Error("Could not list CurseForge modpack files")
  const filesJson = (await filesRes.json()) as { data: Array<{ id: number; downloadUrl?: string }> }
  const latest = filesJson.data[0]
  if (!latest?.downloadUrl) throw new Error("Modpack file is not downloadable")

  const work = join(tmpdir(), `ordolith-cfpack-${randomUUID()}`)
  mkdirSync(work, { recursive: true })
  const packPath = join(work, "pack.zip")
  try {
    onProgress({ fraction: 0.08, detail: "Downloading modpack archive" })
    await downloadFile(latest.downloadUrl, packPath)

    const zip = new AdmZip(packPath)
    const manifestEntry = zip.getEntry("manifest.json")
    if (!manifestEntry) throw new Error("Invalid modpack: missing manifest.json")
    const manifest = JSON.parse(zip.readAsText(manifestEntry)) as CurseManifest

    const versionId = manifest.minecraft.version
    const loaderId = (manifest.minecraft.modLoaders.find((l) => l.primary) ?? manifest.minecraft.modLoaders[0])?.id ?? ""
    const loader = normalizeLoader(loaderId) ?? "vanilla"

    const instance = createInstance({ name: manifest.name || project.title, versionId, loader })
    const gameDir = paths.gameDir(instance.dirName)
    const modsDir = join(gameDir, "mods")
    mkdirSync(modsDir, { recursive: true })

    let done = 0
    await runPool(manifest.files, 6, async (file) => {
      const resolved = await cfFileDownloadUrl(file.projectID, file.fileID, key)
      if (resolved) await downloadFile(resolved.url, join(modsDir, resolved.name))
      done++
      onProgress({
        fraction: 0.1 + 0.75 * (done / Math.max(manifest.files.length, 1)),
        detail: `Downloading mods (${done}/${manifest.files.length})`,
      })
    })

    onProgress({ fraction: 0.9, detail: "Applying overrides" })
    const overridesDir = manifest.overrides ?? "overrides"
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue
      const name = entry.entryName
      if (!name.startsWith(`${overridesDir}/`)) continue
      const rel = name.slice(overridesDir.length + 1)
      if (!rel) continue
      mkdirSync(join(gameDir, rel, ".."), { recursive: true })
      zip.extractEntryTo(entry, join(gameDir, rel, ".."), false, true)
    }

    onProgress({ fraction: 1, detail: "Modpack installed" })
    return instance
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

export async function installModpack(project: ModpackProject, onProgress: ProgressFn): Promise<Instance> {
  return project.provider === "modrinth"
    ? installModrinthPack(project, onProgress)
    : installCursePack(project, onProgress)
}
