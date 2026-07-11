import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, Download, Loader2, Search, Sparkles, Star } from "lucide-react"
import type { ContentProject, ContentType, ModLoader, ResolvedDependency } from "@shared/ipc"
import { useI18n } from "../i18n"
import { useStore } from "../store/useStore"

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
 * When an instance is selected it resolves dependencies before installing and
 * can surface curated recommendations for an empty query.
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
  const favorites = useStore((s) => s.favorites)
  const refreshFavorites = useStore((s) => s.refreshFavorites)
  const [type, setType] = useState<ContentType>("mod")
  const [query, setQuery] = useState("")
  const [cards, setCards] = useState<ContentProject[]>([])
  const [recommended, setRecommended] = useState<ContentProject[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  /** Dependency confirmation prompt, when a chosen project pulls extras in. */
  const [prompt, setPrompt] = useState<{ project: ContentProject; deps: ResolvedDependency[] } | null>(null)

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => `${f.provider}:${f.slug}`)), [favorites])

  const search = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.ordolith.content.search({
        query,
        type,
        instanceId,
        loader: loader as ModLoader,
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

  // Curated recommendations only make sense with an empty query.
  useEffect(() => {
    let cancelled = false
    if (query.trim()) {
      setRecommended([])
      return
    }
    window.ordolith.content
      .recommended(type, loader as ModLoader, gameVersion || undefined)
      .then((list) => {
        if (!cancelled) setRecommended(list)
      })
      .catch(() => {
        if (!cancelled) setRecommended([])
      })
    return () => {
      cancelled = true
    }
  }, [type, loader, gameVersion, query])

  async function runInstall(project: ContentProject): Promise<void> {
    setBusy(project.id)
    try {
      const ok = await onInstall(type, project)
      if (ok) setDone((prev) => new Set(prev).add(project.id))
    } finally {
      setBusy(null)
    }
  }

  /** Resolve dependencies first (when scoped to an instance) then install. */
  async function install(project: ContentProject): Promise<void> {
    if (instanceId && type === "mod") {
      setBusy(project.id)
      try {
        const deps = await window.ordolith.content.resolveDependencies(instanceId, project)
        const required = deps.filter((d) => d.required)
        if (required.length > 0) {
          setPrompt({ project, deps: required })
          return
        }
      } catch {
        // Fall through to a plain install if resolution fails.
      } finally {
        setBusy(null)
      }
    }
    await runInstall(project)
  }

  async function confirmWithDeps(): Promise<void> {
    if (!prompt) return
    const { project, deps } = prompt
    setPrompt(null)
    setBusy(project.id)
    try {
      // Install dependencies first so they're present before the parent mod.
      for (const dep of deps) await onInstall("mod", dep.project)
      const ok = await onInstall(type, project)
      if (ok) setDone((prev) => new Set(prev).add(project.id))
    } finally {
      setBusy(null)
    }
  }

  async function toggleFavorite(project: ContentProject): Promise<void> {
    await window.ordolith.favorites.toggle(project, type)
    await refreshFavorites()
  }

  const isInstalled = (id: string): boolean => done.has(id) || Boolean(installedIds?.has(id))

  function renderCard(project: ContentProject): React.JSX.Element {
    const installed = isInstalled(project.id)
    const favored = favoriteIds.has(`${project.provider}:${project.slug}`)
    return (
      <motion.article
        key={`${project.provider}-${project.id}`}
        className="card glass content-card"
        whileHover={{ y: -3 }}
      >
        <button
          className={`content-card__fav ${favored ? "is-active" : ""}`}
          aria-label={favored ? t("mods.unfavorite") : t("mods.favorite")}
          onClick={() => toggleFavorite(project)}
        >
          <Star size={15} fill={favored ? "currentColor" : "none"} />
        </button>
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
        <p className="card__meta content-card__desc">{project.description}</p>
        <p className="card__sub">
          {t("mods.by", { author: project.author })} ·{" "}
          {t("mods.downloads", { count: project.downloads.toLocaleString() })}
        </p>
        <button
          className={`btn content-card__btn ${installed ? "btn-ghost" : "btn-accent"}`}
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
  }

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
            placeholder={t("mods.searchPlaceholder")}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) void search()
            }}
          />
        </div>
      </div>

      {!query.trim() && recommended.length > 0 && (
        <div className="browser__recommended">
          <h4 className="browser__section">
            <Sparkles size={15} /> {t("mods.recommended")}
          </h4>
          <div className="grid">{recommended.map(renderCard)}</div>
        </div>
      )}

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
        <>
          {!query.trim() && recommended.length > 0 && (
            <h4 className="browser__section">{t("mods.popular")}</h4>
          )}
          <div className="grid">{cards.map(renderCard)}</div>
        </>
      )}

      <AnimatePresence>
        {prompt && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPrompt(null)}
          >
            <motion.div
              className="modal glass glass-strong"
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal__head">
                <h3 className="modal__title">{t("mods.depsTitle")}</h3>
              </div>
              <p className="panel__desc">{t("mods.depsHint", { name: prompt.project.title })}</p>
              <ul className="dep-list">
                {prompt.deps.map((dep) => (
                  <li key={dep.project.id} className="dep-list__item">
                    {dep.project.iconUrl ? (
                      <img className="content-icon dep-list__icon" src={dep.project.iconUrl} alt="" />
                    ) : (
                      <span className="card__icon dep-list__icon" />
                    )}
                    <span className="dep-list__name">{dep.project.title}</span>
                    <span className="badge badge-muted">{t("mods.required")}</span>
                  </li>
                ))}
              </ul>
              <div className="modal__actions">
                <button className="btn btn-ghost" onClick={() => setPrompt(null)}>
                  {t("common.cancel")}
                </button>
                <button className="btn btn-accent" onClick={confirmWithDeps}>
                  {t("mods.installWithDeps", { n: prompt.deps.length + 1 })}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
