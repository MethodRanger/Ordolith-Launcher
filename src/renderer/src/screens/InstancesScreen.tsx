import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Clock, Download, FolderOpen, Play, Plus, Trash2, Upload } from "lucide-react"
import type { ModLoader } from "@shared/ipc"
import { useStore } from "../store/useStore"
import { useI18n } from "../i18n"

const LOADERS: ModLoader[] = ["vanilla", "fabric", "forge", "quilt", "neoforge"]
const COLORS = ["#4cc8ff", "#41d1a7", "#ffb454", "#ff6b6b", "#a78bfa", "#f472b6"]

export function InstancesScreen(): React.JSX.Element {
  const instances = useStore((s) => s.instances)
  const versions = useStore((s) => s.versions)
  const latestRelease = useStore((s) => s.latestRelease)
  const refreshInstances = useStore((s) => s.refreshInstances)
  const selectInstance = useStore((s) => s.selectInstance)
  const setView = useStore((s) => s.setView)
  const pushToast = useStore((s) => s.pushToast)
  const { t } = useI18n()

  const [creating, setCreating] = useState(false)

  function relativeTime(ts?: number): string {
    if (!ts) return t("instances.never")
    const diff = Date.now() - ts
    const mins = Math.round(diff / 60000)
    if (mins < 1) return t("instances.justNow")
    if (mins < 60) return t("instances.minsAgo", { n: mins })
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return t("instances.hrsAgo", { n: hrs })
    return t("instances.daysAgo", { n: Math.round(hrs / 24) })
  }

  async function remove(id: string): Promise<void> {
    await window.ordolith.instances.remove(id)
    await refreshInstances()
  }

  function playNow(id: string): void {
    selectInstance(id)
    setView("play")
  }

  async function exportInstance(id: string): Promise<void> {
    const res = await window.ordolith.instances.export(id)
    pushToast(res.ok ? t("toast.exported") : t("toast.error"), res.ok ? "success" : "error")
  }

  async function importInstance(): Promise<void> {
    const res = await window.ordolith.instances.import()
    if (res.ok) {
      await refreshInstances()
      pushToast(t("toast.imported"), "success")
    } else if (res.error !== "Cancelled") {
      pushToast(t("toast.error"), "error")
    }
  }

  return (
    <div className="content">
      <div className="page-head page-head--row">
        <div>
          <h2>{t("instances.title")}</h2>
          <p>{t("instances.subtitle")}</p>
        </div>
        <div className="page-head__tools">
          <button className="btn" onClick={importInstance}>
            <Upload size={16} /> {t("instances.import")}
          </button>
          <button className="btn btn-accent" onClick={() => setCreating(true)}>
            <Plus size={18} /> {t("instances.newInstance")}
          </button>
        </div>
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
                <Play size={16} /> {t("play.launch")}
              </button>
              <button
                className="btn btn-icon"
                aria-label={t("instances.open")}
                onClick={() => window.ordolith.instances.openFolder(i.id)}
              >
                <FolderOpen size={16} />
              </button>
              <button
                className="btn btn-icon"
                aria-label={t("instances.export")}
                onClick={() => exportInstance(i.id)}
              >
                <Download size={16} />
              </button>
              <button
                className="btn btn-icon"
                aria-label={t("common.remove")}
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
  const { t } = useI18n()
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
        <h3 className="modal__title">{t("instances.newInstance")}</h3>

        <div className="field">
          <label htmlFor="inst-name">{t("instances.name")}</label>
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
          <label>{t("instances.loader")}</label>
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
            {t("instances.version")}
            <button
              className="link-toggle"
              onClick={() => setShowSnapshots((v) => !v)}
              type="button"
            >
              {showSnapshots ? t("instances.hideSnapshots") : t("instances.showSnapshots")}
            </button>
          </label>
          <select
            id="inst-version"
            className="input"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          >
            {list.length === 0 && <option value="">{t("common.loading")}…</option>}
            {list.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id}
                {v.type !== "release" ? ` (${v.type})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>{t("instances.iconColor")}</label>
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
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-accent"
            onClick={submit}
            disabled={busy || !name.trim() || !version}
          >
            {busy ? `${t("common.create")}…` : t("common.create")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
