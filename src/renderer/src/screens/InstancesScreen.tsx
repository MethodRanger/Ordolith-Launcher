import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Clock, Play, Plus, Trash2 } from "lucide-react"
import type { ModLoader } from "@shared/ipc"
import { useStore } from "../store/useStore"

const LOADERS: ModLoader[] = ["vanilla", "fabric", "forge", "quilt"]
const COLORS = ["#4cc8ff", "#41d1a7", "#ffb454", "#ff6b6b", "#a78bfa", "#f472b6"]

function relativeTime(ts?: number): string {
  if (!ts) return "Never played"
  const diff = Date.now() - ts
  const mins = Math.round(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export function InstancesScreen(): React.JSX.Element {
  const instances = useStore((s) => s.instances)
  const versions = useStore((s) => s.versions)
  const latestRelease = useStore((s) => s.latestRelease)
  const refreshInstances = useStore((s) => s.refreshInstances)
  const selectInstance = useStore((s) => s.selectInstance)
  const setView = useStore((s) => s.setView)

  const [creating, setCreating] = useState(false)

  async function remove(id: string): Promise<void> {
    await window.ordolith.instances.remove(id)
    await refreshInstances()
  }

  function playNow(id: string): void {
    selectInstance(id)
    setView("play")
  }

  return (
    <div className="content">
      <div className="page-head page-head--row">
        <div>
          <h2>Instances</h2>
          <p>Isolated game folders, each with its own version, mods and settings.</p>
        </div>
        <button className="btn btn-accent" onClick={() => setCreating(true)}>
          <Plus size={18} /> New instance
        </button>
      </div>

      <div className="grid">
        {instances.map((i) => (
          <motion.div
            key={i.id}
            layout
            className="card glass"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="card__top">
              <span className="card__icon" style={{ background: i.iconColor }} aria-hidden />
              <div className="card__heading">
                <h3>{i.name}</h3>
                <span className="badge badge-muted">{i.loader}</span>
              </div>
            </div>
            <p className="card__meta">Minecraft {i.versionId}</p>
            <p className="card__sub">
              <Clock size={13} /> {relativeTime(i.lastPlayed)}
            </p>
            <div className="card__actions">
              <button className="btn btn-accent" onClick={() => playNow(i.id)}>
                <Play size={16} /> Play
              </button>
              <button
                className="btn btn-icon"
                aria-label={`Delete ${i.name}`}
                onClick={() => remove(i.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {creating && (
          <CreateInstanceDialog
            versions={versions}
            defaultVersion={latestRelease}
            onClose={() => setCreating(false)}
            onCreated={async () => {
              setCreating(false)
              await refreshInstances()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function CreateInstanceDialog({
  versions,
  defaultVersion,
  onClose,
  onCreated,
}: {
  versions: ReturnType<typeof useStore.getState>["versions"]
  defaultVersion: string
  onClose: () => void
  onCreated: () => void
}): React.JSX.Element {
  const [name, setName] = useState("")
  const [loader, setLoader] = useState<ModLoader>("vanilla")
  const [version, setVersion] = useState(defaultVersion)
  const [showSnapshots, setShowSnapshots] = useState(false)
  const [color, setColor] = useState(COLORS[0])
  const [busy, setBusy] = useState(false)

  const list = useMemo(
    () => versions.filter((v) => (showSnapshots ? true : v.type === "release")),
    [versions, showSnapshots],
  )

  async function submit(): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed || !version) return
    setBusy(true)
    await window.ordolith.instances.create({
      name: trimmed,
      versionId: version,
      loader,
      iconColor: color,
    })
    onCreated()
  }

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal glass glass-strong"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal__title">New instance</h3>

        <div className="field">
          <label htmlFor="inst-name">Name</label>
          <input
            id="inst-name"
            className="input"
            placeholder="My world"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="field">
          <label>Mod loader</label>
          <div className="segmented">
            {LOADERS.map((l) => (
              <button
                key={l}
                className={`segmented__opt ${loader === l ? "is-active" : ""}`}
                onClick={() => setLoader(l)}
              >
                {l[0].toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="inst-version">
            Version
            <button
              className="link-toggle"
              onClick={() => setShowSnapshots((v) => !v)}
              type="button"
            >
              {showSnapshots ? "Hide snapshots" : "Show snapshots"}
            </button>
          </label>
          <select
            id="inst-version"
            className="input"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          >
            {list.length === 0 && <option value="">Loading versions…</option>}
            {list.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id}
                {v.type !== "release" ? ` (${v.type})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Accent</label>
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${color === c ? "is-active" : ""}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="modal__actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-accent"
            onClick={submit}
            disabled={busy || !name.trim() || !version}
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
