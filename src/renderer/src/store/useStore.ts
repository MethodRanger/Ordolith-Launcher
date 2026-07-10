import { create } from "zustand"
import type {
  Account,
  GameLogLine,
  Instance,
  ProgressEvent,
  SavedServer,
  VersionSummary,
} from "@shared/ipc"

export type View = "play" | "instances" | "mods" | "servers" | "news" | "settings"

interface LaunchState {
  progress: ProgressEvent | null
  logs: GameLogLine[]
}

interface StoreState {
  ready: boolean
  view: View
  accounts: Account[]
  instances: Instance[]
  servers: SavedServer[]
  versions: VersionSummary[]
  latestRelease: string
  selectedInstanceId: string | null
  launch: LaunchState

  setView: (view: View) => void
  bootstrap: () => Promise<void>
  refreshAccounts: () => Promise<void>
  refreshInstances: () => Promise<void>
  refreshServers: () => Promise<void>
  selectInstance: (id: string | null) => void
  clearLogs: () => void
}

export const useStore = create<StoreState>((set, get) => ({
  ready: false,
  view: "play",
  accounts: [],
  instances: [],
  servers: [],
  versions: [],
  latestRelease: "",
  selectedInstanceId: null,
  launch: { progress: null, logs: [] },

  setView: (view) => set({ view }),

  bootstrap: async () => {
    const [accounts, instances, servers] = await Promise.all([
      window.ordolith.accounts.list(),
      window.ordolith.instances.list(),
      window.ordolith.servers.list(),
    ])

    // Versions can be slow / offline — never block the first paint on them.
    window.ordolith.versions
      .list()
      .then((m) => set({ versions: m.versions, latestRelease: m.latest.release }))
      .catch(() => set({ versions: [] }))

    // Stream launch progress + logs into the store.
    window.ordolith.launcher.onProgress((e) =>
      set((s) => ({ launch: { ...s.launch, progress: e } })),
    )
    window.ordolith.launcher.onLog((e) =>
      set((s) => ({ launch: { ...s.launch, logs: [...s.launch.logs, e].slice(-500) } })),
    )

    set({
      accounts,
      instances,
      servers,
      selectedInstanceId: get().selectedInstanceId ?? instances[0]?.id ?? null,
      ready: true,
    })
  },

  refreshAccounts: async () => set({ accounts: await window.ordolith.accounts.list() }),

  refreshInstances: async () => {
    const instances = await window.ordolith.instances.list()
    set((s) => ({
      instances,
      selectedInstanceId:
        s.selectedInstanceId && instances.some((i) => i.id === s.selectedInstanceId)
          ? s.selectedInstanceId
          : instances[0]?.id ?? null,
    }))
  },

  refreshServers: async () => set({ servers: await window.ordolith.servers.list() }),

  selectInstance: (id) => set({ selectedInstanceId: id }),

  clearLogs: () => set((s) => ({ launch: { ...s.launch, logs: [] } })),
}))

/** Convenience selector for the currently active account. */
export function activeAccount(accounts: Account[]): Account | null {
  return accounts.find((a) => a.active) ?? accounts[0] ?? null
}
