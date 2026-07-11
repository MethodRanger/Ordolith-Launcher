import { create } from "zustand"
import type {
  Account,
  FavoriteContent,
  GameLogLine,
  Instance,
  LauncherSettings,
  PlaySession,
  ProgressEvent,
  ResourceSample,
  SavedServer,
  VersionSummary,
} from "@shared/ipc"
import { useI18nStore } from "../i18n"

export type View = "play" | "instances" | "mods" | "servers" | "news" | "stats" | "settings"

interface LaunchState {
  progress: ProgressEvent | null
  logs: GameLogLine[]
  /** Latest live resource sample for the running instance. */
  resource: ResourceSample | null
}

export interface Toast {
  id: string
  message: string
  kind: "success" | "error" | "info"
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
  settings: LauncherSettings | null
  sessions: PlaySession[]
  favorites: FavoriteContent[]
  toasts: Toast[]

  setView: (view: View) => void
  bootstrap: () => Promise<void>
  refreshAccounts: () => Promise<void>
  refreshInstances: () => Promise<void>
  refreshServers: () => Promise<void>
  refreshSettings: () => Promise<void>
  refreshSessions: () => Promise<void>
  refreshFavorites: () => Promise<void>
  saveSettings: (patch: Partial<LauncherSettings>) => Promise<void>
  selectInstance: (id: string | null) => void
  clearLogs: () => void
  pushToast: (message: string, kind?: Toast["kind"]) => void
  dismissToast: (id: string) => void
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
  launch: { progress: null, logs: [], resource: null },
  settings: null,
  sessions: [],
  favorites: [],
  toasts: [],

  setView: (view) => set({ view }),

  bootstrap: async () => {
    const [accounts, instances, servers, settings, sessions, favorites] = await Promise.all([
      window.ordolith.accounts.list(),
      window.ordolith.instances.list(),
      window.ordolith.servers.list(),
      window.ordolith.app.getSettings(),
      window.ordolith.sessions.list(),
      window.ordolith.favorites.list(),
    ])

    // Apply the persisted interface language.
    useI18nStore.setState({ locale: settings.locale })

    // Versions can be slow / offline — never block the first paint on them.
    window.ordolith.versions
      .list()
      .then((m) => set({ versions: m.versions, latestRelease: m.latest.release }))
      .catch(() => set({ versions: [] }))

    // Stream launch progress + logs into the store.
    window.ordolith.launcher.onProgress((e) => {
      set((s) => ({ launch: { ...s.launch, progress: e } }))
      // A finished/failed session updates history + clears the live sample.
      if (e.stage === "done" || e.stage === "error") {
        set((s) => ({ launch: { ...s.launch, resource: null } }))
        void get().refreshSessions()
        void get().refreshInstances()
      }
    })
    window.ordolith.launcher.onLog((e) =>
      set((s) => ({ launch: { ...s.launch, logs: [...s.launch.logs, e].slice(-500) } })),
    )
    window.ordolith.resources.onSample((sample) =>
      set((s) => ({ launch: { ...s.launch, resource: sample } })),
    )

    set({
      accounts,
      instances,
      servers,
      settings,
      sessions,
      favorites,
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

  refreshSettings: async () => set({ settings: await window.ordolith.app.getSettings() }),

  refreshSessions: async () => set({ sessions: await window.ordolith.sessions.list() }),

  refreshFavorites: async () => set({ favorites: await window.ordolith.favorites.list() }),

  saveSettings: async (patch) => {
    const current = get().settings
    if (!current) return
    const next = await window.ordolith.app.saveSettings({ ...current, ...patch })
    set({ settings: next })
  },

  selectInstance: (id) => set({ selectedInstanceId: id }),

  clearLogs: () => set((s) => ({ launch: { ...s.launch, logs: [] } })),

  pushToast: (message, kind = "info") => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Convenience selector for the currently active account. */
export function activeAccount(accounts: Account[]): Account | null {
  return accounts.find((a) => a.active) ?? accounts[0] ?? null
}

/**
 * Resolve a displayable avatar URL for an account. Falls back to a deterministic
 * Minecraft head render (Steve/Alex for unknown names) so every account — even
 * older offline profiles stored without an avatar — shows a real head.
 */
export function accountAvatar(account: Pick<Account, "avatarUrl" | "username"> | null | undefined): string | undefined {
  if (!account) return undefined
  if (account.avatarUrl) return account.avatarUrl
  if (account.username) return `https://mc-heads.net/avatar/${encodeURIComponent(account.username)}/64`
  return undefined
}

/**
 * Resolve the full-body skin texture (64x64 PNG) for an account, used by the
 * 3D character viewer. Falls back to the deterministic default skin for
 * unknown names.
 */
export function accountSkin(account: Pick<Account, "username"> | null | undefined): string | undefined {
  if (!account?.username) return undefined
  return `https://mc-heads.net/skin/${encodeURIComponent(account.username)}`
}
