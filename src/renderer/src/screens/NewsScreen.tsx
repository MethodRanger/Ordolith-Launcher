import { motion } from "framer-motion"
import { CalendarDays, Sparkles } from "lucide-react"
import { useI18n } from "../i18n"

const RELEASES = [
  { version: "1.21", date: "2024-06-13" },
  { version: "1.20", date: "2023-06-07" },
  { version: "1.19", date: "2022-06-07" },
  { version: "1.18", date: "2021-11-30" },
] as const

export function NewsScreen(): React.JSX.Element {
  const { t } = useI18n()

  return (
    <div className="content">
      <div className="page-head">
        <h2>{t("news.title")}</h2>
        <p>{t("news.subtitle")}</p>
      </div>
      <div className="release-list">
        {RELEASES.map((release, index) => (
          <motion.article
            key={release.version}
            className="release glass"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, type: "spring", stiffness: 300, damping: 26 }}
          >
            <div className="release__mark">
              <Sparkles size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="release__title">
                <h3>
                  Minecraft {release.version} · {t(`changelog.${release.version}.title`)}
                </h3>
                <span>
                  <CalendarDays size={13} />
                  {new Date(release.date).toLocaleDateString()}
                </span>
              </div>
              <p>{t(`changelog.${release.version}.summary`)}</p>
              <ul>
                {t.list(`changelog.${release.version}.highlights`).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  )
}
