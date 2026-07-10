import { useEffect, useState } from "react"
import { PackageOpen, ToggleLeft, ToggleRight, Trash2 } from "lucide-react"
import type { ContentProject, ContentType, InstalledContent } from "@shared/ipc"
import { useStore } from "../store/useStore"
import { useI18n } from "../i18n"
import { ContentBrowser } from "../components/ContentBrowser"
import { ModpackBrowser } from "../components/ModpackBrowser"

type Tab = "modpacks" | "browse" | "installed"

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
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>(instances.length === 0 ? "modpacks" : "browse")
  const [type, setType] = useState<ContentType>("mod")
  const [installed, setInstalled] = useState<InstalledContent[]>([])

  const instance = instances.find((i) => i.id === selectedId) ?? instances[0]

  async function loadInstalled(): Promise<void> {
    if (!instance) return
    setInstalled(await window.ordolith.content.listInstalled(instance.id, type))
  }

  useEffect(() => {
    if (tab === "installed") void loadInstalled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, type, instance?.id])

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
              installed.map((item) => (
                <div className="server glass" key={item.id}>
                  <PackageOpen size={22} />
                  <div className="server__info">
                    <h3>{item.title}</h3>
                    <p className="server__addr">
                      {item.versionName} · {item.provider}
                    </p>
                  </div>
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
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
