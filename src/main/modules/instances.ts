import { randomUUID } from "node:crypto"
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs"
import { join } from "node:path"
import { paths } from "../paths.js"
import { store } from "../store.js"
import type { Instance, InstanceProfile, InstanceSettings } from "../../shared/types.js"
import type { CreateInstanceInput } from "../../shared/ipc.js"

const ICON_COLORS = ["#5b8cff", "#41d1a7", "#f0a020", "#ff6b6b", "#b06bff", "#38bdf8"]

const DEFAULT_SETTINGS: InstanceSettings = {
  maxMemoryMb: 2048,
  minMemoryMb: 512,
  jvmArgs: "",
  javaPath: "",
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "instance"
  )
}

export function listInstances(): Instance[] {
  return store.getInstances()
}

export function createInstance(input: CreateInstanceInput): Instance {
  const id = randomUUID()
  const dirName = `${slugify(input.name)}-${id.slice(0, 8)}`

  const instance: Instance = {
    id,
    name: input.name.trim() || "New Instance",
    versionId: input.versionId,
    loader: input.loader ?? "vanilla",
    dirName,
    settings: { ...DEFAULT_SETTINGS, ...input.settings },
    createdAt: Date.now(),
    iconColor: ICON_COLORS[Math.floor(Math.random() * ICON_COLORS.length)],
  }

  // Materialise the isolated game directory up front.
  mkdirSync(paths.gameDir(dirName), { recursive: true })

  store.saveInstances([...store.getInstances(), instance])
  return instance
}

export function updateInstance(id: string, patch: Partial<Instance>): Instance {
  const instances = store.getInstances()
  const idx = instances.findIndex((i) => i.id === id)
  if (idx === -1) throw new Error("Unknown instance.")

  const merged: Instance = {
    ...instances[idx],
    ...patch,
    // Never let a patch rewrite identity/directory fields.
    id: instances[idx].id,
    dirName: instances[idx].dirName,
    settings: { ...instances[idx].settings, ...patch.settings },
  }
  instances[idx] = merged
  store.saveInstances(instances)
  return merged
}

export function removeInstance(id: string): void {
  store.saveInstances(store.getInstances().filter((i) => i.id !== id))
}

export function markPlayed(id: string): void {
  const instances = store.getInstances().map((i) => (i.id === id ? { ...i, lastPlayed: Date.now() } : i))
  store.saveInstances(instances)
}

export function getInstance(id: string): Instance | undefined {
  return store.getInstances().find((i) => i.id === id)
}

/** Deep-copy an existing instance (game directory included) under a new name. */
export function cloneInstance(id: string, name: string): Instance {
  const source = getInstance(id)
  if (!source) throw new Error("Unknown instance.")
  const newId = randomUUID()
  const dirName = `${slugify(name)}-${newId.slice(0, 8)}`
  const clone: Instance = {
    ...source,
    id: newId,
    name: name.trim() || `${source.name} (Copy)`,
    dirName,
    createdAt: Date.now(),
    lastPlayed: undefined,
    totalPlayMs: 0,
    // A clone starts self-contained; drop any custom external game directory.
    gameDirectory: undefined,
    settings: { ...source.settings, gameDirectory: undefined },
    profiles: source.profiles ? source.profiles.map((p) => ({ ...p })) : undefined,
  }
  const targetGame = paths.gameDir(dirName)
  mkdirSync(targetGame, { recursive: true })
  const sourceGame = source.settings.gameDirectory || source.gameDirectory || paths.gameDir(source.dirName)
  if (existsSync(sourceGame)) {
    cpSync(sourceGame, targetGame, { recursive: true })
  }
  store.saveInstances([...store.getInstances(), clone])
  return clone
}

/** Record elapsed play time when a session ends. */
export function addPlayTime(id: string, ms: number): void {
  const instances = store.getInstances().map((i) =>
    i.id === id ? { ...i, totalPlayMs: (i.totalPlayMs ?? 0) + Math.max(0, ms) } : i,
  )
  store.saveInstances(instances)
}

/* Mod profiles ----------------------------------------------------- */

function modsDir(instance: Instance): string {
  const game = instance.settings.gameDirectory || instance.gameDirectory || paths.gameDir(instance.dirName)
  return join(game, "mods")
}

/** File names of mods currently enabled (present as `.jar`, not `.jar.disabled`). */
function enabledMods(instance: Instance): string[] {
  const dir = modsDir(instance)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((n) => n.endsWith(".jar"))
}

export function listProfiles(id: string): InstanceProfile[] {
  return getInstance(id)?.profiles ?? []
}

/** Capture the current enabled-mod set as a named profile. */
export function saveProfile(id: string, name: string): InstanceProfile {
  const instance = getInstance(id)
  if (!instance) throw new Error("Unknown instance.")
  const profile: InstanceProfile = {
    id: randomUUID(),
    name: name.trim() || "Profile",
    enabled: enabledMods(instance),
    createdAt: Date.now(),
  }
  updateInstance(id, { profiles: [...(instance.profiles ?? []), profile], activeProfileId: profile.id })
  return profile
}

/** Enable exactly the mods stored in a profile, disabling the rest. */
export function applyProfile(id: string, profileId: string): void {
  const instance = getInstance(id)
  if (!instance) throw new Error("Unknown instance.")
  const profile = (instance.profiles ?? []).find((p) => p.id === profileId)
  if (!profile) throw new Error("Unknown profile.")
  const dir = modsDir(instance)
  if (existsSync(dir)) {
    const wanted = new Set(profile.enabled)
    for (const entry of readdirSync(dir)) {
      const isJar = entry.endsWith(".jar")
      const isDisabled = entry.endsWith(".jar.disabled")
      if (!isJar && !isDisabled) continue
      const base = isDisabled ? entry.slice(0, -".disabled".length) : entry
      const shouldEnable = wanted.has(base)
      if (shouldEnable && isDisabled) renameSync(join(dir, entry), join(dir, base))
      if (!shouldEnable && isJar) renameSync(join(dir, entry), join(dir, `${entry}.disabled`))
    }
  }
  updateInstance(id, { activeProfileId: profileId })
}

export function deleteProfile(id: string, profileId: string): void {
  const instance = getInstance(id)
  if (!instance) throw new Error("Unknown instance.")
  updateInstance(id, {
    profiles: (instance.profiles ?? []).filter((p) => p.id !== profileId),
    activeProfileId: instance.activeProfileId === profileId ? undefined : instance.activeProfileId,
  })
}

/** Remove an instance's game directory when the instance itself is deleted. */
export function purgeInstanceDir(dirName: string): void {
  rmSync(paths.instanceDir(dirName), { recursive: true, force: true })
}
