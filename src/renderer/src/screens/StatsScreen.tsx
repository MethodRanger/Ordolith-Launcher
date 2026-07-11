import { useMemo } from "react"
import { motion } from "framer-motion"
import { Activity, AlertTriangle, BarChart3, Clock, Flame, Gamepad2, Timer, Trophy } from "lucide-react"
import { useStore } from "../store/useStore"
import { useI18n } from "../i18n"

/** Compact millisecond duration formatter, e.g. `12h 34m`, `45m`, `—`. */
function formatDuration(ms: number): string {
  if (!ms || ms < 60000) return ms >= 1000 ? `${Math.round(ms / 1000)}s` : "—"
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const DAY_MS = 86_400_000
const ACTIVITY_DAYS = 14

export function StatsScreen(): React.JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const instances = useStore((s) => s.instances)
  const setView = useStore((s) => s.setView)
  const { t, locale } = useI18n()

  const stats = useMemo(() => {
    const totalMs = sessions.reduce((sum, s) => sum + s.durationMs, 0)
    const totalSessions = sessions.length
    const crashed = sessions.filter((s) => s.crashed).length
    const crashRate = totalSessions ? Math.round((crashed / totalSessions) * 100) : 0
    const avgMs = totalSessions ? totalMs / totalSessions : 0
    const longest = sessions.reduce((max, s) => Math.max(max, s.durationMs), 0)

    // Per-instance playtime, richest first.
    const byInstance = new Map<string, { name: string; ms: number; count: number; color: string }>()
    for (const s of sessions) {
      const inst = instances.find((i) => i.id === s.instanceId)
      const key = s.instanceId
      const prev = byInstance.get(key)
      byInstance.set(key, {
        name: inst?.name ?? s.instanceName,
        ms: (prev?.ms ?? 0) + s.durationMs,
        count: (prev?.count ?? 0) + 1,
        color: inst?.iconColor ?? "#34d399",
      })
    }
    const instanceRows = [...byInstance.values()].sort((a, b) => b.ms - a.ms)
    const maxInstanceMs = instanceRows.reduce((max, r) => Math.max(max, r.ms), 0)

    // Rolling activity window (oldest → newest).
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const days: { label: string; ms: number }[] = []
    for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
      const dayStart = startOfToday.getTime() - i * DAY_MS
      const dayEnd = dayStart + DAY_MS
      const ms = sessions
        .filter((s) => s.startedAt >= dayStart && s.startedAt < dayEnd)
        .reduce((sum, s) => sum + s.durationMs, 0)
      days.push({
        label: new Intl.DateTimeFormat(locale, { weekday: "short" }).format(dayStart),
        ms,
      })
    }
    const maxDayMs = days.reduce((max, d) => Math.max(max, d.ms), 0)

    return { totalMs, totalSessions, crashed, crashRate, avgMs, longest, instanceRows, maxInstanceMs, days, maxDayMs }
  }, [sessions, instances, locale])

  if (sessions.length === 0) {
    return (
      <div className="content">
        <div className="page-head">
          <span className="eyebrow">{t("stats.eyebrow")}</span>
          <h2>{t("stats.title")}</h2>
          <p>{t("stats.subtitle")}</p>
        </div>
        <div className="empty glass">
          <BarChart3 size={40} aria-hidden />
          <p>{t("stats.empty")}</p>
          <button className="btn btn-accent" onClick={() => setView("play")}>
            {t("stats.goPlay")}
          </button>
        </div>
      </div>
    )
  }

  const cards = [
    { icon: Clock, label: t("stats.totalTime"), value: formatDuration(stats.totalMs) },
    { icon: Gamepad2, label: t("stats.sessions"), value: String(stats.totalSessions) },
    { icon: Timer, label: t("stats.avgSession"), value: formatDuration(stats.avgMs) },
    { icon: Trophy, label: t("stats.longest"), value: formatDuration(stats.longest) },
    { icon: AlertTriangle, label: t("stats.crashRate"), value: `${stats.crashRate}%` },
    { icon: Flame, label: t("stats.instancesPlayed"), value: String(stats.instanceRows.length) },
  ]

  return (
    <div className="content">
      <div className="page-head">
        <span className="eyebrow">{t("stats.eyebrow")}</span>
        <h2>{t("stats.title")}</h2>
        <p>{t("stats.subtitle")}</p>
      </div>

      {/* Summary metric cards ---------------------------------------- */}
      <div className="stat-cards">
        {cards.map((c, idx) => (
          <motion.div
            key={c.label}
            className="stat-card glass"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="stat-card__icon">
              <c.icon size={18} />
            </span>
            <span className="stat-card__value">{c.value}</span>
            <span className="stat-card__label">{c.label}</span>
          </motion.div>
        ))}
      </div>

      <div className="stats-grid">
        {/* Activity chart -------------------------------------------- */}
        <section className="panel glass">
          <div className="panel__head">
            <h3>
              <Activity size={16} /> {t("stats.activity")}
            </h3>
            <span className="panel__hint">{t("stats.activityHint", { n: ACTIVITY_DAYS })}</span>
          </div>
          <div className="activity-chart" role="img" aria-label={t("stats.activity")}>
            {stats.days.map((d, idx) => {
              const height = stats.maxDayMs ? Math.max(4, Math.round((d.ms / stats.maxDayMs) * 100)) : 4
              return (
                <div key={idx} className="activity-col" title={formatDuration(d.ms)}>
                  <div className="activity-col__track">
                    <motion.div
                      className="activity-col__bar"
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ duration: 0.4, delay: idx * 0.02, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="activity-col__label">{d.label}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Per-instance breakdown ------------------------------------ */}
        <section className="panel glass">
          <div className="panel__head">
            <h3>
              <BarChart3 size={16} /> {t("stats.byInstance")}
            </h3>
          </div>
          <div className="bar-list">
            {stats.instanceRows.map((row) => {
              const width = stats.maxInstanceMs ? Math.max(3, Math.round((row.ms / stats.maxInstanceMs) * 100)) : 3
              return (
                <div key={row.name} className="bar-row">
                  <div className="bar-row__head">
                    <span className="bar-row__dot" style={{ background: row.color }} aria-hidden />
                    <span className="bar-row__name">{row.name}</span>
                    <span className="bar-row__value">{formatDuration(row.ms)}</span>
                  </div>
                  <div className="bar-row__track">
                    <motion.div
                      className="bar-row__fill"
                      style={{ background: row.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="bar-row__count">{t("stats.sessionsCount", { n: row.count })}</span>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
