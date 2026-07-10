import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Download, Loader2, Search } from "lucide-react"
import type { ModpackProject } from "@shared/ipc"
import { useI18n } from "../i18n"
import { useStore } from "../store/useStore"

/**
 * Modrinth/CurseForge-style modpack browser. Searching queries both providers
 * and installing a pack creates a brand new instance on the main process,
 * streaming progress back over IPC.
 */
export function ModpackBrowser({
  onInstalled,
}: {
  onInstalled?: (instanceId: string) => void
}): React.JSX.Element {
  const { t } = useI18n()
  const pushToast = useStore((s) => s.pushToast)
  const [query, setQuery] = useState("")
  const [projects, setProjects] = useState<ModpackProject[]>([])
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ fraction: number; detail: string } | null>(null)
  const disposeRef = useRef<(() => void) | null>(null)

  async function search(): Promise<void> {
    setLoading(true)
    try {
      const result = await window.ordolith.modpacks.search({ query, sort: "downloads", limit: 24 })
      setProjects(result.projects)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void search()
    return () => disposeRef.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function install(project: ModpackProject): Promise<void> {
    setInstalling(project.id)
    setProgress({ fraction: 0, detail: "" })
    disposeRef.current = window.ordolith.modpacks.onProgress((p) => setProgress(p))
    try {
      const instance = await window.ordolith.modpacks.install(project)
      onInstalled?.(instance.id)
      pushToast(t("mods.modpackInstalled", { name: project.title }), "success")
    } catch {
      pushToast(t("mods.modpackFailed", { name: project.title }), "error")
    } finally {
      disposeRef.current?.()
      disposeRef.current = null
      setInstalling(null)
      setProgress(null)
    }
  }

  return (
    <div className="modpack-browser">
      <div className="searchbar glass">
        <Search size={18} />
        <input
          className="input"
          value={query}
          placeholder={t("mods.modpackSearchPlaceholder")}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) void search()
          }}
        />
        <button className="btn btn-accent" onClick={search}>
          {t("mods.search")}
        </button>
      </div>

      {loading ? (
        <div className="grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card glass skeleton-card" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="empty glass">
          <p>{t("mods.noResults")}</p>
        </div>
      ) : (
        <div className="grid">
          {projects.map((project) => {
            const busy = installing === project.id
            return (
              <motion.article
                key={`${project.provider}-${project.id}`}
                className="card glass content-card"
                whileHover={{ y: -3 }}
              >
                <div className="card__top">
                  {project.iconUrl ? (
                    <img className="content-icon" src={project.iconUrl} alt="" />
                  ) : (
                    <span className="card__icon" aria-hidden />
                  )}
                  <div className="card__heading">
                    <h3>{project.title}</h3>
                    <span className="badge badge-muted">{project.provider}</span>
                  </div>
                </div>
                <p className="card__meta content-card__desc">{project.description}</p>
                <p className="card__sub">
                  {t("mods.by", { author: project.author })} ·{" "}
                  {t("mods.downloads", { count: project.downloads.toLocaleString() })}
                </p>
                {busy && progress ? (
                  <div className="progress content-card__btn">
                    <div className="progress__track">
                      <div className="progress__fill" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
                    </div>
                    <p className="progress__detail">{progress.detail || t("mods.modpackInstalling")}</p>
                  </div>
                ) : (
                  <button
                    className="btn btn-accent content-card__btn"
                    disabled={!!installing}
                    onClick={() => install(project)}
                  >
                    {busy ? <Loader2 className="spin" size={16} /> : <Download size={16} />}{" "}
                    {t("mods.modpackInstall")}
                  </button>
                )}
              </motion.article>
            )
          })}
        </div>
      )}
    </div>
  )
}
