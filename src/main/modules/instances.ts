import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { paths } from "../paths.js"
import { store } from "../store.js"
import type { Instance, InstanceSettings } from "../../shared/types.js"
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
