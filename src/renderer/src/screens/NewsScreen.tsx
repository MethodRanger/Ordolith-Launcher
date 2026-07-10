import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { CalendarDays, Minus, Plus, RefreshCw, Search, Sparkles, Wrench } from "lucide-react"
import { useI18n } from "../i18n"
import { CHANGELOG, type ChangeKind } from "../data/changelog"

const KIND_META: {
  kind: ChangeKind
  labelKey: string
  icon: React.ComponentType<{ size?: number }>
  className: string
}[] = [
  { kind: "added", labelKey: "news.added", icon: Plus, className: "is-added" },
  { kind: "changed", labelKey: "news.changed", icon: RefreshCw, className: "is-changed" },
  { kind: "fixed", labelKey: "news.fixed", icon: Wrench, className: "is-fixed" },
  { kind: "removed", labelKey: "news.removed", icon: Minus, className: "is-removed" },
]

export function NewsScreen(): React.JSX.Element {
  const { t, locale } = useI18n()
  const [query, setQuery] = useState("")

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CHANGELOG
    return CHANGELOG.filter((entry) => {
      const haystack = [
        entry.version,
        entry.title[locale],
        entry.summary[locale],
        ...Object.values(entry.changes).flatMap((list) => list?.[locale] ?? []),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [query, locale])

  return (
    <div className="content">
      <div className="page-head page-head--row">
        <div>
          <h2>{t("news.title")}</h2>
          <p>{t("news.subtitle")}</p>
        </div>
        <div className="searchbar glass news-search">
          <Search size={18} />
          <input
            className="input"
            value={query}
            placeholder={t("news.searchPlaceholder")}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty glass">
          <p>{t("news.noResults")}</p>
        </div>
      ) : (
        <div className="release-list">
          {entries.map((entry, index) => (
            <motion.article
              key={entry.version}
              className="release glass"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 26 }}
            >
              <div className="release__mark">
                <Sparkles size={18} />
              </div>
              <div className="release__body">
                <div className="release__title">
                  <h3>
                    Minecraft {entry.version} · {entry.title[locale]}
                  </h3>
                  <span>
                    <CalendarDays size={13} />
                    {new Date(entry.date).toLocaleDateString(locale)}
                  </span>
                </div>
                <p className="release__summary">{entry.summary[locale]}</p>
                <div className="changelog">
                  {KIND_META.map(({ kind, labelKey, icon: Icon, className }) => {
                    const items = entry.changes[kind]?.[locale]
                    if (!items || items.length === 0) return null
                    return (
                      <section key={kind} className={`changelog__group ${className}`}>
                        <h4 className="changelog__label">
                          <Icon size={13} />
                          {t(labelKey)}
                        </h4>
                        <ul>
                          {items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </section>
                    )
                  })}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  )
}
