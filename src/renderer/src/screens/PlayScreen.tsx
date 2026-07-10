import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Play, Square, Terminal, Trash2 } from "lucide-react"
import { useStore } from "../store/useStore"

const STAGE_LABEL: Record<string, string> = {
  idle: "Ready",
  manifest: "Fetching version manifest",
  client: "Downloading client",
  libraries: "Downloading libraries",
  assets: "Downloading assets",
  natives: "Extracting natives",
  java: "Checking Java runtime",
  launching: "Launching",
  running: "Running",
  done: "Ready",
  error: "Error",
}

export function PlayScreen(): React.JSX.Element {
  const instances = useStore((s) => s.instances)
  const selectedId = useStore((s) => s.selectedInstanceId)
  const selectInstance = useStore((s) => s.selectInstance)
  const setView = useStore((s) => s.setView)
  const progress = useStore((s) => s.launch.progress)
  const logs = useStore((s) => s.launch.logs)
  const clearLogs = useStore((s) => s.clearLogs)
  const [showLogs, setShowLogs] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const instance = useMemo(
    () => instances.find((i) => i.id === selectedId) ?? instances[0] ?? null,
    [instances, selectedId],
  )

  const busy =
    !!progress &&
    progress.instanceId === instance?.id &&
    !["idle", "done", "error"].includes(progress.stage)
  const running = progress?.instanceId === instance?.id && progress?.stage === "running"

  async function launch(): Promise<void> {
    if (!instance) return
    setError(null)
    try {
      const res = await window.ordolith.launcher.launch(instance.id)
      if (!res.ok) setError(res.error ?? "Launch failed.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Launch failed.")
    }
  }

  if (!instance) {
    return (
      <div className="content">
        <div className="page-head">
          <h2>Play</h2>
          <p>Get started by creating your first instance.</p>
        </div>
        <div className="empty glass">
          <p>No instances yet.</p>
          <button className="btn btn-accent" onClick={() => setView("instances")}>
            Create an instance
          </button>
        </div>
      </div>
    )
  }

  const pct = Math.round((progress?.fraction ?? 0) * 100)

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
                <span>{STAGE_LABEL[progress!.stage] ?? progress!.stage}</span>
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

          {error && (
            <p className="hero__error" role="alert">
              {error}
            </p>
          )}

          <div className="hero__actions">
            {running ? (
              <button className="btn hero__stop" onClick={() => window.ordolith.launcher.stop(instance.id)}>
                <Square size={18} /> Stop
              </button>
            ) : (
              <button className="btn btn-accent hero__play" onClick={launch} disabled={busy}>
                <Play size={20} /> {busy ? `${STAGE_LABEL[progress!.stage]}…` : "Play"}
              </button>
            )}
            <button
              className="btn btn-icon"
              aria-label="Toggle game log"
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

      {showLogs && (
        <div className="logs glass">
          <div className="logs__head">
            <span>
              <Terminal size={15} /> Game output
            </span>
            <button className="btn btn-ghost btn-icon" aria-label="Clear logs" onClick={clearLogs}>
              <Trash2 size={16} />
            </button>
          </div>
          <div className="logs__body">
            {logs.length === 0 ? (
              <p className="logs__empty">No output yet. Launch the game to see logs here.</p>
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
