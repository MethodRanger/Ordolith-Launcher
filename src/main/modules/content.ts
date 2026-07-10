import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import type {
  ContentFile,
  ContentProject,
  ContentSearchQuery,
  ContentSearchResult,
  ContentUpdate,
  InstalledContent,
  Instance,
  ModLoader,
  ResolvedDependency,
} from "../../shared/types.js"
import { downloadFile } from "./net.js"
import { getInstance } from "./instances.js"
import { paths } from "../paths.js"

const USER_AGENT = "Ordolith/0.1.0 (github.com/MethodRanger/Ordolith-Launcher)"
const MODRINTH = "https://api.modrinth.com/v2"
const CURSEFORGE = "https://api.curseforge.com/v1"
const cache = new Map<string, { expires: number; value: ContentSearchResult }>()

function safeFileName(value: string): string {
  const name = basename(value).replace(/[^a-zA-Z0-9._+()-]/g, "_")
  if (!name || name === "." || name === "..") throw new Error("Unsafe content filename")
  return name
}

function contentDir(instance: Instance, type: ContentSearchQuery["type"]): string {
  const game = instance.settings.gameDirectory || instance.gameDirectory || paths.gameDir(instance.dirName)
  return join(game, type === "mod" ? "mods" : type === "resourcepack" ? "resourcepacks" : "shaderpacks")
}

function loaderFacet(loader: ModLoader): string | null {
  return loader === "vanilla" ? null : loader
}

interface SearchScope {
  loader: ModLoader
  gameVersion?: string
}

async function modrinthSearch(query: ContentSearchQuery, scope: SearchScope): Promise<ContentProject[]> {
  const facets: string[][] = [[`project_type:${query.type === "resourcepack" ? "resourcepack" : query.type}`]]
  if (scope.gameVersion) facets.push([`versions:${scope.gameVersion}`])
  const loader = loaderFacet(scope.loader)
  if (loader && query.type === "mod") facets.push([`categories:${loader}`])
  if (query.category) facets.push([`categories:${query.category}`])
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
    provider: "modrinth",
    slug: String(hit.slug),
    title: String(hit.title),
    description: String(hit.description ?? ""),
    iconUrl: typeof hit.icon_url === "string" ? hit.icon_url : undefined,
    author: String(hit.author ?? "Modrinth creator"),
    downloads: Number(hit.downloads ?? 0),
    updatedAt: String(hit.date_modified ?? ""),
    types: [query.type],
    loaders: ((hit.categories as string[] | undefined) ?? []).filter((v): v is ModLoader => ["fabric", "forge", "quilt", "neoforge"].includes(v)),
    gameVersions: ((hit.versions as string[] | undefined) ?? []),
    categories: ((hit.categories as string[] | undefined) ?? []),
  }))
}

async function curseforgeSearch(query: ContentSearchQuery, scope: SearchScope): Promise<ContentProject[]> {
  const key = process.env.CURSEFORGE_API_KEY
  if (!key) throw new Error("CurseForge API key is not configured")
  const classId = query.type === "mod" ? 6 : query.type === "resourcepack" ? 12 : 6552
  const params = new URLSearchParams({
    gameId: "432",
    classId: String(classId),
    searchFilter: query.query,
    pageSize: String(query.limit ?? 20),
    index: String(query.offset ?? 0),
  })
  if (scope.gameVersion) params.set("gameVersion", scope.gameVersion)
  const response = await fetch(`${CURSEFORGE}/mods/search?${params}`, { headers: { "x-api-key": key } })
  if (!response.ok) throw new Error(`CurseForge returned ${response.status}`)
  const json = (await response.json()) as { data: Array<Record<string, unknown>> }
  return json.data.map((raw) => {
    const authors = raw.authors as Array<{ name: string }> | undefined
    const logo = raw.logo as { url?: string } | undefined
    const categories = raw.categories as Array<{ name: string }> | undefined
    return {
      id: String(raw.id), provider: "curseforge", slug: String(raw.slug), title: String(raw.name),
      description: String(raw.summary ?? ""), iconUrl: logo?.url, author: authors?.[0]?.name ?? "CurseForge creator",
      downloads: Number(raw.downloadCount ?? 0), updatedAt: String(raw.dateModified ?? ""), types: [query.type],
      loaders: [], gameVersions: scope.gameVersion ? [scope.gameVersion] : (raw.latestFilesIndexes as Array<{ gameVersion?: string }> | undefined)?.map((f) => f.gameVersion ?? "").filter(Boolean) ?? [], categories: categories?.map((item) => item.name) ?? [],
    }
  })
}

export async function searchContent(query: ContentSearchQuery): Promise<ContentSearchResult> {
  const instance = query.instanceId ? getInstance(query.instanceId) : undefined
  const scope: SearchScope = {
    loader: instance?.loader ?? query.loader ?? "vanilla",
    gameVersion: instance?.versionId ?? query.gameVersion,
  }
  const key = JSON.stringify(query)
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return cached.value
  const [modrinth, curseforge] = await Promise.allSettled([modrinthSearch(query, scope), curseforgeSearch(query, scope)])
  const projects = [
    ...(modrinth.status === "fulfilled" ? modrinth.value : []),
    ...(curseforge.status === "fulfilled" ? curseforge.value : []),
  ]
  const seen = new Set<string>()
  const value: ContentSearchResult = {
    projects: projects.filter((project) => {
      const id = project.title.toLowerCase().replace(/\W/g, "")
      if (seen.has(id)) return false
      seen.add(id)
      return true
    }),
    total: projects.length,
    providerHealth: {
      modrinth: modrinth.status === "fulfilled" ? "online" : "error",
      curseforge: !process.env.CURSEFORGE_API_KEY ? "unavailable" : curseforge.status === "fulfilled" ? "online" : "error",
    },
  }
  cache.set(key, { value, expires: Date.now() + 60_000 })
  return value
}

export async function getCompatibleFile(project: ContentProject, instanceId: string): Promise<ContentFile> {
  const instance = getInstance(instanceId)
  if (!instance) throw new Error("Instance not found")
  if (project.provider === "modrinth") {
    const params = new URLSearchParams({ game_versions: JSON.stringify([instance.versionId]) })
    if (instance.loader !== "vanilla") params.set("loaders", JSON.stringify([instance.loader]))
    const response = await fetch(`${MODRINTH}/project/${project.id}/version?${params}`, { headers: { "User-Agent": USER_AGENT } })
    if (!response.ok) throw new Error("No compatible Modrinth file")
    const versions = (await response.json()) as Array<Record<string, unknown>>
    const version = versions[0]
    if (!version) throw new Error("No compatible version found")
    const files = version.files as Array<Record<string, unknown>>
    const file = files.find((item) => item.primary) ?? files[0]
    return {
      id: String(version.id), projectId: project.id, provider: "modrinth", name: String(version.name),
      fileName: safeFileName(String(file.filename)), downloadUrl: String(file.url), size: Number(file.size ?? 0),
      hashes: (file.hashes as ContentFile["hashes"]) ?? {}, gameVersions: (version.game_versions as string[]) ?? [],
      loaders: (version.loaders as ModLoader[]) ?? [], dependencies: ((version.dependencies as Array<Record<string, unknown>>) ?? []).map((dep) => ({
        projectId: String(dep.project_id ?? dep.version_id), provider: "modrinth", required: dep.dependency_type === "required",
      })),
    }
  }
  const key = process.env.CURSEFORGE_API_KEY
  if (!key) throw new Error("CurseForge API key is not configured")
  const response = await fetch(`${CURSEFORGE}/mods/${project.id}/files`, { headers: { "x-api-key": key } })
  if (!response.ok) throw new Error("No compatible CurseForge file")
  const json = (await response.json()) as { data: Array<Record<string, unknown>> }
  const raw = json.data.find((file) => (file.gameVersions as string[] | undefined)?.includes(instance.versionId))
  if (!raw) throw new Error("No compatible version found")
  return {
    id: String(raw.id), projectId: project.id, provider: "curseforge", name: String(raw.displayName),
    fileName: safeFileName(String(raw.fileName)), downloadUrl: String(raw.downloadUrl), size: Number(raw.fileLength ?? 0),
    hashes: {}, gameVersions: (raw.gameVersions as string[]) ?? [], loaders: [], dependencies: [],
  }
}

export async function installContent(
  instanceId: string,
  type: ContentSearchQuery["type"],
  project: ContentProject,
  opts: { dependency?: boolean } = {},
): Promise<InstalledContent> {
  const instance = getInstance(instanceId)
  if (!instance) throw new Error("Instance not found")
  const file = await getCompatibleFile(project, instanceId)
  const dir = contentDir(instance, type)
  mkdirSync(dir, { recursive: true })
  await downloadFile(file.downloadUrl, join(dir, safeFileName(file.fileName)), { sha1: file.hashes.sha1, size: file.size })
  const installed: InstalledContent = {
    id: `${project.provider}:${project.id}`, projectId: project.id, provider: project.provider, instanceId, type,
    title: project.title, fileName: file.fileName, versionName: file.name, enabled: true, installedAt: Date.now(),
    compatible: true, dependency: opts.dependency ?? false, iconUrl: project.iconUrl,
  }
  writeFileSync(join(dir, `${safeFileName(file.fileName)}.ordolith.json`), JSON.stringify(installed, null, 2))
  return installed
}

/** Fetch a single project's metadata by id, normalised to `ContentProject`. */
async function getProjectById(provider: ContentProject["provider"], id: string, type: ContentSearchQuery["type"]): Promise<ContentProject | null> {
  try {
    if (provider === "modrinth") {
      const response = await fetch(`${MODRINTH}/project/${id}`, { headers: { "User-Agent": USER_AGENT } })
      if (!response.ok) return null
      const p = (await response.json()) as Record<string, unknown>
      return {
        id: String(p.id), provider: "modrinth", slug: String(p.slug), title: String(p.title),
        description: String(p.description ?? ""), iconUrl: typeof p.icon_url === "string" ? p.icon_url : undefined,
        author: "Modrinth", downloads: Number(p.downloads ?? 0), updatedAt: String(p.updated ?? ""),
        types: [type], loaders: ((p.loaders as string[]) ?? []).filter((v): v is ModLoader => ["fabric", "forge", "quilt", "neoforge"].includes(v)),
        gameVersions: (p.game_versions as string[]) ?? [], categories: (p.categories as string[]) ?? [],
      }
    }
    const key = process.env.CURSEFORGE_API_KEY
    if (!key) return null
    const response = await fetch(`${CURSEFORGE}/mods/${id}`, { headers: { "x-api-key": key } })
    if (!response.ok) return null
    const raw = ((await response.json()) as { data: Record<string, unknown> }).data
    const logo = raw.logo as { url?: string } | undefined
    return {
      id: String(raw.id), provider: "curseforge", slug: String(raw.slug), title: String(raw.name),
      description: String(raw.summary ?? ""), iconUrl: logo?.url, author: "CurseForge",
      downloads: Number(raw.downloadCount ?? 0), updatedAt: String(raw.dateModified ?? ""),
      types: [type], loaders: [], gameVersions: [], categories: [],
    }
  } catch {
    return null
  }
}

/**
 * Recursively resolve the required (and directly optional) dependencies of a
 * project against an instance, with cycle protection, so the UI can confirm
 * everything that will be installed alongside the user's pick.
 */
export async function resolveDependencies(instanceId: string, project: ContentProject): Promise<ResolvedDependency[]> {
  const out: ResolvedDependency[] = []
  const seen = new Set<string>([`${project.provider}:${project.id}`])
  const queue: Array<{ id: string; required: boolean }> = []

  const root = await getCompatibleFile(project, instanceId)
  for (const dep of root.dependencies) queue.push({ id: dep.projectId, required: dep.required })

  while (queue.length > 0) {
    const next = queue.shift()!
    if (!next.id) continue
    const key = `${project.provider}:${next.id}`
    if (seen.has(key)) continue
    seen.add(key)
    const depProject = await getProjectById(project.provider, next.id, "mod")
    if (!depProject) continue
    try {
      const depFile = await getCompatibleFile(depProject, instanceId)
      out.push({ project: depProject, file: depFile, required: next.required })
      for (const sub of depFile.dependencies) if (sub.required) queue.push({ id: sub.projectId, required: true })
    } catch {
      // No compatible dependency file — skip rather than blocking the install.
    }
  }
  return out
}

/** Compare installed files against the latest compatible version per project. */
export async function checkUpdates(instanceId: string, type: ContentSearchQuery["type"]): Promise<ContentUpdate[]> {
  const installed = listInstalled(instanceId, type)
  const updates: ContentUpdate[] = []
  await Promise.all(
    installed.map(async (item) => {
      try {
        const project = await getProjectById(item.provider, item.projectId, type)
        if (!project) return
        const latest = await getCompatibleFile(project, instanceId)
        if (latest.fileName !== item.fileName) {
          updates.push({
            fileName: item.fileName, title: item.title, currentVersion: item.versionName,
            latestVersion: latest.name, latestFileName: latest.fileName, size: latest.size,
          })
        }
      } catch {
        // Ignore projects we can't resolve right now.
      }
    }),
  )
  return updates
}

/** Replace an installed file with the latest compatible version. */
export async function updateContent(instanceId: string, type: ContentSearchQuery["type"], fileName: string): Promise<InstalledContent> {
  const existing = listInstalled(instanceId, type).find((item) => item.fileName === fileName)
  if (!existing) throw new Error("Installed content not found")
  const project = await getProjectById(existing.provider, existing.projectId, type)
  if (!project) throw new Error("Project metadata unavailable")
  removeContent(instanceId, type, fileName)
  return installContent(instanceId, type, project, { dependency: existing.dependency })
}

/** Curated/popular projects for the recommendations rail (Modrinth catalog). */
export async function getRecommended(type: ContentSearchQuery["type"], loader?: ModLoader, gameVersion?: string): Promise<ContentProject[]> {
  try {
    return await modrinthSearch(
      { query: "", type, sort: "downloads", limit: 8, offset: 0 } as ContentSearchQuery,
      { loader: loader ?? "vanilla", gameVersion },
    )
  } catch {
    return []
  }
}

export function listInstalled(instanceId: string, type: ContentSearchQuery["type"]): InstalledContent[] {
  const instance = getInstance(instanceId)
  if (!instance) return []
  const dir = contentDir(instance, type)
  if (!existsSync(dir)) return []
  const jars = new Set(readdirSync(dir).filter((n) => n.endsWith(".jar") || n.endsWith(".jar.disabled")))
  return readdirSync(dir).filter((name) => name.endsWith(".ordolith.json")).flatMap((name) => {
    try {
      const item = JSON.parse(readFileSync(join(dir, name), "utf8")) as InstalledContent
      // Reflect the real on-disk enabled state (.jar vs .jar.disabled).
      const enabled = jars.has(item.fileName) || existsSync(join(dir, item.fileName))
      return [{ ...item, enabled, compatible: item.compatible ?? true }]
    } catch {
      return []
    }
  })
}

export function toggleContent(instanceId: string, type: ContentSearchQuery["type"], fileName: string, enabled: boolean): void {
  const instance = getInstance(instanceId)
  if (!instance) throw new Error("Instance not found")
  const dir = contentDir(instance, type)
  const current = join(dir, safeFileName(fileName))
  const disabled = `${current}.disabled`
  if (enabled && existsSync(disabled)) renameSync(disabled, current)
  if (!enabled && existsSync(current)) renameSync(current, disabled)
}

export function removeContent(instanceId: string, type: ContentSearchQuery["type"], fileName: string): void {
  const instance = getInstance(instanceId)
  if (!instance) throw new Error("Instance not found")
  const dir = contentDir(instance, type)
  rmSync(join(dir, safeFileName(fileName)), { force: true })
  rmSync(join(dir, `${safeFileName(fileName)}.disabled`), { force: true })
  rmSync(join(dir, `${safeFileName(fileName)}.ordolith.json`), { force: true })
}
