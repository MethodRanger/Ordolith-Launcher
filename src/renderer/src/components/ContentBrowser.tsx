import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Check, Download, Loader2, Search } from "lucide-react"
import type { ContentProject, ContentType } from "@shared/ipc"
import { useI18n } from "../i18n"

const TYPE_KEYS: { id: ContentType; key: string }[] = [
  { id: "mod", key: "mods.typeMod" },
  { id: "resourcepack", key: "mods.typeResourcepack" },
  { id: "shader", key: "mods.typeShader" },
]

export interface ContentBrowserProps {
  /** Target instance for install + facet scoping. Optional when just browsing. */
  instanceId?: string
  loader: string
  gameVersion: string
  /** Install a picked project. Return true on success. */
  onInstall: (type: ContentType, project: ContentProject) => Promise<boolean>
  /** Ids that are already installed / selected, keyed for the current session. */
  installedIds?: Set<string>
  /** Show a compact layout for the wizard. */
  compact?: boolean
}

/**
 * Modrinth-style content browser: type tabs, search bar and a responsive grid
 * of project cards. Shared by the Content screen and the create-instance wizard.
 */
export function ContentBrowser({
  instanceId,
  loader,
  gameVersion,
  onInstall,
  installedIds,
  compact,
}: ContentBrowserProps): React.JSX.Element {
  const { t } = useI18n()
  const [type, setType] = useState<ContentType>("mod")
  const [query, setQuery] = useState("")
  const [cards, setCards] = useState<ContentProject[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())

  const search = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.ordolith.content.search({
        query,
        type,
        instanceId,
        loader: loader as never,
        gameVersion,
        limit: 40,
      })
      setCards(result.projects)
    } catch {
      setCards([])
    } finally {
      setLoading(false)
    }
  }, [query, type, instanceId, loader, gameVersion])

  useEffect(() => {
    void search()
  }, [search])

  async function install(project: ContentProject): Promise<void> {
    setBusy(project.id)
    try {
      const ok = await onInstall(type, project)
      if (ok) setDone((prev) => new Set(prev).add(project.id))
    } finally {
      setBusy(null)
    }
  }

  const isInstalled = (id: string): boolean => done.has(id) || Boolean(installedIds?.has(id))

  return (
    <div className={`browser ${compact ? "browser--compact" : ""}`}>
      <div className="browser__bar">
        <div className="segmented">
          {TYPE_KEYS.map((item) => (
            <button
              key={item.id}
              className={`segmented__opt ${type === item.id ? "is-active" : ""}`}
              onClick={() => setType(item.id)}
            >
              {t(item.key)}
            </button>
          ))}
        </div>
        <div className="searchbar glass">
          <Search size={18} />
          <input
            className="input"
            value={query}
            placeholder={t("mods.searchPlaceholder", { loader, version: gameVersion })}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) void search()
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card glass skeleton-card" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="empty glass">
          <p>{t("mods.noResults")}</p>
        </div>
      ) : (
        <div className="grid">
          {cards.map((project) => {
            const installed = isInstalled(project.id)
            return (
              <motion.article
                key={`${project.provider}-${project.id}`}
                className="card glass"
                whileHover={{ y: -3 }}
              >
                <div className="card__top">
                  {project.iconUrl ? (
                    <img className="content-icon" src={project.iconUrl} alt="" />
                  ) : (
                    <span className="card__icon" />
                  )}
                  <div className="card__heading">
                    <h3>{project.title}</h3>
                    <span className="badge badge-muted">{project.provider}</span>
                  </div>
                </div>
                <p className="card__meta">{project.description}</p>
                <p className="card__sub">
                  {t("mods.by", { author: project.author })} ·{" "}
                  {t("mods.downloads", { count: project.downloads.toLocaleString() })}
                </p>
                <button
                  className={`btn ${installed ? "btn-ghost" : "btn-accent"}`}
                  disabled={busy === project.id || installed}
                  onClick={() => install(project)}
                >
                  {busy === project.id ? (
                    <Loader2 className="spin" size={16} />
                  ) : installed ? (
                    <Check size={16} />
                  ) : (
                    <Download size={16} />
                  )}{" "}
                  {installed ? t("wizard.added") : t("mods.install")}
                </button>
              </motion.article>
            )
          })}
        </div>
      )}
    </div>
  )
}
