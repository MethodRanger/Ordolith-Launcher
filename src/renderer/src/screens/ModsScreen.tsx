import { useEffect, useState } from "react"
import { AlertTriangle, ArrowUpCircle, PackageOpen, Star, ToggleLeft, ToggleRight, Trash2 } from "lucide-react"
import type { ContentProject, ContentType, ContentUpdate, InstalledContent } from "@shared/ipc"
import { useStore } from "../store/useStore"
import { useI18n } from "../i18n"
import { ContentBrowser } from "../components/ContentBrowser"
import { ModpackBrowser } from "../components/ModpackBrowser"

type Tab = "modpacks" | "browse" | "installed" | "favorites"

const TYPES: ContentType[] = ["mod", "resourcepack", "shader"]
const TYPE_KEY: Record<ContentType, string> = {
  mod: "mods.typeMod",
  resourcepack: "mods.typeResourcepack",
  shader: "mods.typeShader",
}

export function ModsScreen(): React.JSX.Element {
  const { t } = useI18n()
  const instances = useStore((s) => s.instances)
  const selectedId = useStore((s) => s.selectedInstanceId)
  const selectInstance = useStore((s) => s.selectInstance)
  const refreshInstances = useStore((s) => s.refreshInstances)
  const favorites = useStore((s) => s.favorites)
  const refreshFavorites = useStore((s) => s.refreshFavorites)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>(instances.length === 0 ? "modpacks" : "browse")
  const [type, setType] = useState<ContentType>("mod")
  const [installed, setInstalled] = useState<InstalledContent[]>([])
  const [updates, setUpdates] = useState<ContentUpdate[]>([])
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  const instance = instances.find((i) => i.id === selectedId) ?? instances[0]

  async function loadInstalled(): Promise<void> {
    if (!instance) return
    setInstalled(await window.ordolith.content.listInstalled(instance.id, type))
  }

  useEffect(() => {
    setUpdates([])
    if (tab === "installed") void loadInstalled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, type, instance?.id])

  async function checkUpdates(): Promise<void> {
    if (!instance) return
    setChecking(true)
    try {
      const found = await window.ordolith.content.checkUpdates(instance.id, type)
      setUpdates(found)
      pushToast(
        found.length ? t("mods.updatesFound", { n: found.length }) : t("mods.upToDate"),
        found.length ? "info" : "success",
      )
    } catch {
      pushToast(t("toast.error"), "error")
    } finally {
      setChecking(false)
    }
  }

  async function applyUpdate(fileName: string, title: string): Promise<void> {
    if (!instance) return
    setUpdating(fileName)
    try {
      await window.ordolith.content.update(instance.id, type, fileName)
      setUpdates((u) => u.filter((x) => x.fileName !== fileName))
      await loadInstalled()
      pushToast(t("mods.updated", { name: title }), "success")
    } catch {
      pushToast(t("mods.installFailed", { name: title }), "error")
    } finally {
      setUpdating(null)
    }
  }

  async function installProject(pickedType: ContentType, project: ContentProject): Promise<boolean> {
    if (!instance) return false
    try {
      await window.ordolith.content.install(instance.id, pickedType, project)
      pushToast(t("mods.installed", { name: project.title }), "success")
      return true
    } catch {
      pushToast(t("mods.installFailed", { name: project.title }), "error")
      return false
    }
  }

  const updateFor = (fileName: string): ContentUpdate | undefined =>
    updates.find((u) => u.fileName === fileName)

  return (
    <div className="content">
      <div className="page-head page-head--row">
        <div>
          <h2>{t("mods.title")}</h2>
          <p>{t("mods.subtitle")}</p>
        </div>
        <div className="segmented">
          <button
            className={`segmented__opt ${tab === "modpacks" ? "is-active" : ""}`}
            onClick={() => setTab("modpacks")}
          >
            {t("mods.modpackTab")}
          </button>
          <button
            className={`segmented__opt ${tab === "browse" ? "is-active" : ""}`}
            onClick={() => setTab("browse")}
          >
            {t("mods.browse")}
          </button>
          <button
            className={`segmented__opt ${tab === "installed" ? "is-active" : ""}`}
            onClick={() => setTab("installed")}
          >
            {t("mods.installedTab")}
          </button>
          <button
            className={`segmented__opt ${tab === "favorites" ? "is-active" : ""}`}
            onClick={() => setTab("favorites")}
          >
            {t("mods.favoritesTab")}
          </button>
        </div>
      </div>

      {tab === "modpacks" ? (
        <ModpackBrowser
          onInstalled={async () => {
            await refreshInstances()
          }}
        />
      ) : tab === "browse" ? (
        <>
          {instances.length > 0 && (
            <div className="toolbar glass">
              <span className="toolbar__label">{t("mods.installTarget")}</span>
              <select
                className="input"
                value={instance?.id ?? ""}
                onChange={(e) => selectInstance(e.target.value)}
                aria-label={t("mods.instance")}
              >
                {instances.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.versionId} · {item.loader}
                  </option>
                ))}
              </select>
            </div>
          )}
          <ContentBrowser
            instanceId={instance?.id}
            loader={instance?.loader ?? "fabric"}
            gameVersion={instance?.versionId ?? ""}
            onInstall={installProject}
          />
        </>
      ) : tab === "favorites" ? (
        <FavoritesTab
          favorites={favorites}
          instanceId={instance?.id}
          onInstall={installProject}
          onRemoved={refreshFavorites}
        />
      ) : !instance ? (
        <div className="empty glass">
          <PackageOpen size={28} />
          <p>{t("mods.needInstance")}</p>
        </div>
      ) : (
        <>
          <div className="toolbar glass">
            <select
              className="input"
              value={instance.id}
              onChange={(e) => selectInstance(e.target.value)}
              aria-label={t("mods.instance")}
            >
              {instances.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.versionId} · {item.loader}
                </option>
              ))}
            </select>
            <button className="btn" onClick={checkUpdates} disabled={checking}>
              <ArrowUpCircle size={16} /> {checking ? t("mods.checking") : t("mods.checkUpdates")}
            </button>
          </div>

          <div className="segmented">
            {TYPES.map((item) => (
              <button
                key={item}
                className={`segmented__opt ${type === item ? "is-active" : ""}`}
                onClick={() => setType(item)}
              >
                {t(TYPE_KEY[item])}
              </button>
            ))}
          </div>
          <div className="server-list">
            {installed.length === 0 ? (
              <div className="empty glass">
                <p>{t("mods.noInstalled")}</p>
              </div>
            ) : (
              installed.map((item) => {
                const update = updateFor(item.fileName)
                return (
                  <div className="server glass" key={item.id}>
                    <PackageOpen size={22} />
                    <div className="server__info">
                      <h3>
                        {item.title}
                        {item.dependency && <span className="badge badge-muted">{t("mods.dependency")}</span>}
                      </h3>
                      <p className="server__addr">
                        {item.versionName} · {item.provider}
                      </p>
                      {item.compatible === false && (
                        <p className="server__motd server__motd--off">
                          <AlertTriangle size={13} /> {t("mods.incompatible")}
                        </p>
                      )}
                    </div>
                    {update && (
                      <button
                        className="btn btn-accent"
                        disabled={updating === item.fileName}
                        onClick={() => applyUpdate(item.fileName, item.title)}
                      >
                        <ArrowUpCircle size={15} />{" "}
                        {updating === item.fileName ? t("common.update") : update.latestVersion}
                      </button>
                    )}
                    <button
                      className="btn btn-icon"
                      aria-label={item.enabled ? t("mods.disable") : t("mods.enable")}
                      onClick={async () => {
                        await window.ordolith.content.toggle(instance.id, type, item.fileName, !item.enabled)
                        await loadInstalled()
                      }}
                    >
                      {item.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                    <button
                      className="btn btn-icon"
                      aria-label={t("common.remove")}
                      onClick={async () => {
                        await window.ordolith.content.remove(instance.id, type, item.fileName)
                        await loadInstalled()
                        pushToast(t("mods.removed", { name: item.title }), "info")
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** Saved/favourited projects that can be quickly reinstalled or unstarred. */
function FavoritesTab({
  favorites,
  instanceId,
  onInstall,
  onRemoved,
}: {
  favorites: ReturnType<typeof useStore.getState>["favorites"]
  instanceId?: string
  onInstall: (type: ContentType, project: ContentProject) => Promise<boolean>
  onRemoved: () => Promise<void>
}): React.JSX.Element {
  const { t } = useI18n()
  const [busy, setBusy] = useState<string | null>(null)

  async function unfavorite(fav: (typeof favorites)[number]): Promise<void> {
    // Reconstruct a minimal project so toggle can key it identically.
    await window.ordolith.favorites.toggle(
      {
        id: fav.id.split(":")[1] ?? fav.slug,
        provider: fav.provider,
        slug: fav.slug,
        title: fav.title,
        description: "",
        iconUrl: fav.iconUrl,
        author: fav.author,
        downloads: 0,
        updatedAt: "",
        types: [fav.type],
        loaders: [],
        gameVersions: [],
        categories: [],
      },
      fav.type,
    )
    await onRemoved()
  }

  if (favorites.length === 0) {
    return (
      <div className="empty glass">
        <Star size={28} />
        <p>{t("mods.noFavorites")}</p>
      </div>
    )
  }

  return (
    <div className="server-list">
      {favorites.map((fav) => (
        <div className="server glass" key={fav.id}>
          {fav.iconUrl ? (
            <img className="content-icon" src={fav.iconUrl} alt="" />
          ) : (
            <PackageOpen size={22} />
          )}
          <div className="server__info">
            <h3>{fav.title}</h3>
            <p className="server__addr">
              {t("mods.by", { author: fav.author })} · {fav.provider}
            </p>
          </div>
          {instanceId && (
            <button
              className="btn btn-accent"
              disabled={busy === fav.id}
              onClick={async () => {
                setBusy(fav.id)
                await onInstall(fav.type, {
                  id: fav.id.split(":")[1] ?? fav.slug,
                  provider: fav.provider,
                  slug: fav.slug,
                  title: fav.title,
                  description: "",
                  iconUrl: fav.iconUrl,
                  author: fav.author,
                  downloads: 0,
                  updatedAt: "",
                  types: [fav.type],
                  loaders: [],
                  gameVersions: [],
                  categories: [],
                })
                setBusy(null)
              }}
            >
              {t("mods.install")}
            </button>
          )}
          <button
            className="btn btn-icon"
            aria-label={t("mods.unfavorite")}
            onClick={() => unfavorite(fav)}
          >
            <Star size={17} fill="currentColor" />
          </button>
        </div>
      ))}
    </div>
  )
}
