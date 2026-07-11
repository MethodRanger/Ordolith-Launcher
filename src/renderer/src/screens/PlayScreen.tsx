import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Cpu, History, Image as ImageIcon, MemoryStick, Play, Square, Terminal, Timer, Trash2 } from "lucide-react"
import type { Screenshot } from "@shared/ipc"
import { useStore } from "../store/useStore"
import { useI18n } from "../i18n"
import logo from "../assets/logo"

/** Format a millisecond duration as compact `1h 20m` / `45s`. */
function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function PlayScreen(): React.JSX.Element {
  const instances = useStore((s) => s.instances)
  const selectedId = useStore((s) => s.selectedInstanceId)
  const selectInstance = useStore((s) => s.selectInstance)
  const setView = useStore((s) => s.setView)
  const progress = useStore((s) => s.launch.progress)
  const resource = useStore((s) => s.launch.resource)
  const logs = useStore((s) => s.launch.logs)
  const clearLogs = useStore((s) => s.clearLogs)
  const sessions = useStore((s) => s.sessions)
  const { t, locale } = useI18n()
  const stageLabel = (stage: string): string => t(`stage.${stage}`)
  const [showLogs, setShowLogs] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])

  const instance = useMemo(
    () => instances.find((i) => i.id === selectedId) ?? instances[0] ?? null,
    [instances, selectedId],
  )

  const instanceSessions = useMemo(
    () => sessions.filter((s) => s.instanceId === instance?.id).slice(0, 8),
    [sessions, instance?.id],
  )

  useEffect(() => {
    if (!instance) return
    window.ordolith.screenshots.list(instance.id).then(setScreenshots).catch(() => setScreenshots([]))
  }, [instance?.id, progress?.stage])

  const busy =
    !!progress &&
    progress.instanceId === instance?.id &&
    !["idle", "done", "error"].includes(progress.stage)
  const running = progress?.instanceId === instance?.id && progress?.stage === "running"
  const liveResource = running && resource?.instanceId === instance?.id ? resource : null

  async function launch(): Promise<void> {
    if (!instance) return
    setError(null)
    try {
      const res = await window.ordolith.launcher.launch(instance.id)
      if (!res.ok) setError(res.error ?? t("play.launchFailed"))
    } catch (e) {
      setError(e instanceof Error ? e.message : t("play.launchFailed"))
    }
  }

  if (!instance) {
    return (
      <div className="content">
        <div className="page-head">
          <h2>{t("nav.play")}</h2>
          <p>{t("play.getStarted")}</p>
        </div>
        <div className="empty glass">
          <img className="empty__logo" src={logo} alt="" aria-hidden />
          <p>{t("instances.empty")}</p>
          <button className="btn btn-accent" onClick={() => setView("instances")}>
            {t("instances.newInstance")}
          </button>
        </div>
      </div>
    )
  }

  const pct = Math.round((progress?.fraction ?? 0) * 100)
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" })

  return (
    <div className="content">
      <motion.div
        className="hero glass"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="hero__glow" aria-hidden />
        <div className="hero__body">
          <span className="badge badge-muted">{instance.loader}</span>
          <h2 className="hero__title">{instance.name}</h2>
          <p className="hero__version">Minecraft {instance.versionId}</p>

          {busy && (
            <div className="progress" aria-live="polite">
              <div className="progress__meta">
                <span>{stageLabel(progress!.stage)}</span>
                <span>{pct}%</span>
              </div>
              <div className="progress__track">
                <motion.div
                  className="progress__fill"
                  animate={{ width: `${pct}%` }}
                  transition={{ ease: "linear", duration: 0.2 }}
                />
              </div>
              <p className="progress__detail">{progress!.detail}</p>
            </div>
          )}

          {liveResource && (
            <div className="resmon" aria-live="polite">
              <span className="resmon__stat">
                <Cpu size={15} /> {liveResource.cpu}%
              </span>
              <span className="resmon__stat">
                <MemoryStick size={15} /> {liveResource.memoryMb} MB
              </span>
              <span className="resmon__stat">
                <Timer size={15} /> {formatDuration(liveResource.uptimeMs)}
              </span>
            </div>
          )}

          {error && (
            <p className="hero__error" role="alert">
              {error}
            </p>
          )}

          <div className="hero__actions">
            {running ? (
              <button className="btn hero__stop" onClick={() => window.ordolith.launcher.stop(instance.id)}>
                <Square size={18} /> {t("play.stop")}
              </button>
            ) : (
              <button className="btn btn-accent hero__play" onClick={launch} disabled={busy}>
                <Play size={20} /> {busy ? `${stageLabel(progress!.stage)}…` : t("play.launch")}
              </button>
            )}
            <button
              className="btn btn-icon"
              aria-label={t("play.logs")}
              onClick={() => setShowLogs((v) => !v)}
            >
              <Terminal size={18} />
            </button>
          </div>
        </div>
      </motion.div>

      <div className="instance-strip">
        {instances.map((i) => (
          <button
            key={i.id}
            className={`instance-chip ${i.id === instance.id ? "is-active" : ""}`}
            onClick={() => selectInstance(i.id)}
          >
            <span className="instance-chip__dot" style={{ background: i.iconColor }} aria-hidden />
            <span className="instance-chip__name">{i.name}</span>
            <span className="instance-chip__ver">{i.versionId}</span>
          </button>
        ))}
      </div>

      <div className="play-grid">
        <section className="panel glass">
          <div className="panel__head">
            <h3>
              <History size={16} /> {t("play.history")}
            </h3>
          </div>
          {instanceSessions.length === 0 ? (
            <p className="panel__empty">{t("play.noHistory")}</p>
          ) : (
            <ul className="session-list">
              {instanceSessions.map((s) => (
                <li key={s.id} className="session-row">
                  <span className={`session-row__dot ${s.crashed ? "is-crash" : ""}`} aria-hidden />
                  <span className="session-row__date">{dateFmt.format(s.startedAt)}</span>
                  <span className="session-row__dur">{formatDuration(s.durationMs)}</span>
                  {s.crashed && <span className="badge badge-danger">{t("play.crashed")}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel glass">
          <div className="panel__head">
            <h3>
              <ImageIcon size={16} /> {t("play.screenshots")}
            </h3>
          </div>
          {screenshots.length === 0 ? (
            <p className="panel__empty">{t("play.noScreenshots")}</p>
          ) : (
            <div className="shot-grid">
              {screenshots.slice(0, 9).map((shot) => (
                <button
                  key={shot.name}
                  className="shot"
                  onClick={() => window.ordolith.screenshots.reveal(shot.path)}
                  title={shot.name}
                >
                  <img src={shot.url} alt={shot.name} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {showLogs && (
        <div className="logs glass">
          <div className="logs__head">
            <span>
              <Terminal size={15} /> {t("play.logs")}
            </span>
            <button className="btn btn-ghost btn-icon" aria-label={t("play.clearLogs")} onClick={clearLogs}>
              <Trash2 size={16} />
            </button>
          </div>
          <div className="logs__body">
            {logs.length === 0 ? (
              <p className="logs__empty">{t("play.noLogs")}</p>
            ) : (
              logs.map((l, idx) => (
                <div key={idx} className={`logs__line logs__line--${l.level}`}>
                  {l.line}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
