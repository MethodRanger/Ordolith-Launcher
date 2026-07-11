import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Archive, Boxes, Clock, Copy, Download, FolderOpen, Layers, Package, Play, Plus, RotateCcw, Save, Timer, Trash2, Upload } from "lucide-react"
import type { BackupEntry, ContentProject, ContentType, Instance, InstanceProfile, ModLoader } from "@shared/ipc"
import { useStore } from "../store/useStore"
import { useI18n } from "../i18n"
import { ContentBrowser } from "../components/ContentBrowser"
import { ModpackBrowser } from "../components/ModpackBrowser"

/** Human-readable total play time, e.g. "12h 34m" or "45m". */
function formatPlayTime(ms?: number): string {
  if (!ms || ms < 60000) return "—"
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** Human-readable file size, e.g. "12.4 MB". */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let size = bytes / 1024
  let i = 0
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

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
  const [managing, setManaging] = useState<Instance | null>(null)

  async function clone(id: string): Promise<void> {
    const source = instances.find((i) => i.id === id)
    if (!source) return
    await window.ordolith.instances.clone(id, t("instances.copyName", { name: source.name }))
    await refreshInstances()
    pushToast(t("toast.cloned"), "success")
  }

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
              <span className="card__sub-sep" aria-hidden>·</span>
              <Timer size={13} /> {formatPlayTime(i.totalPlayMs)}
            </p>
            <div className="card__actions">
              <button className="btn btn-accent" onClick={() => playNow(i.id)}>
                <Play size={16} /> {t("play.launch")}
              </button>
              <button
                className="btn btn-icon"
                aria-label={t("instances.manage")}
                title={t("instances.manage")}
                onClick={() => setManaging(i)}
              >
                <Layers size={16} />
              </button>
              <button
                className="btn btn-icon"
                aria-label={t("instances.clone")}
                title={t("instances.clone")}
                onClick={() => clone(i.id)}
              >
                <Copy size={16} />
              </button>
              <button
                className="btn btn-icon"
                aria-label={t("instances.open")}
                title={t("instances.open")}
                onClick={() => window.ordolith.instances.openFolder(i.id)}
              >
                <FolderOpen size={16} />
              </button>
              <button
                className="btn btn-icon"
                aria-label={t("instances.export")}
                title={t("instances.export")}
                onClick={() => exportInstance(i.id)}
              >
                <Download size={16} />
              </button>
              <button
                className="btn btn-icon"
                aria-label={t("common.remove")}
                title={t("common.remove")}
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
        {managing && (
          <ManageInstanceDialog
            instance={managing}
            onClose={() => setManaging(null)}
            onChanged={refreshInstances}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ManageInstanceDialog({
  instance,
  onClose,
  onChanged,
}: {
  instance: Instance
  onClose: () => void
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const { t } = useI18n()
  const pushToast = useStore((s) => s.pushToast)
  const [profiles, setProfiles] = useState<InstanceProfile[]>([])
  const [activeId, setActiveId] = useState<string | undefined>(instance.activeProfileId)
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState(false)
  const [backups, setBackups] = useState<BackupEntry[]>([])

  async function reload(): Promise<void> {
    const [nextProfiles, nextBackups] = await Promise.all([
      window.ordolith.instances.listProfiles(instance.id),
      window.ordolith.backups.list(instance.id),
    ])
    setProfiles(nextProfiles)
    setBackups(nextBackups)
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id])

  async function createBackup(): Promise<void> {
    setBusy(true)
    try {
      await window.ordolith.backups.create(instance.id)
      await reload()
      pushToast(t("backups.created"), "success")
    } finally {
      setBusy(false)
    }
  }

  async function restoreBackup(id: string): Promise<void> {
    setBusy(true)
    try {
      await window.ordolith.backups.restore(id)
      pushToast(t("backups.restored"), "success")
    } finally {
      setBusy(false)
    }
  }

  async function removeBackup(id: string): Promise<void> {
    await window.ordolith.backups.remove(id)
    await reload()
  }

  async function save(): Promise<void> {
    if (!newName.trim()) return
    setBusy(true)
    try {
      const profile = await window.ordolith.instances.saveProfile(instance.id, newName.trim())
      setNewName("")
      setActiveId(profile.id)
      await reload()
      await onChanged()
      pushToast(t("profiles.saved"), "success")
    } finally {
      setBusy(false)
    }
  }

  async function apply(profileId: string): Promise<void> {
    setBusy(true)
    try {
      await window.ordolith.instances.applyProfile(instance.id, profileId)
      setActiveId(profileId)
      pushToast(t("profiles.applied"), "success")
    } finally {
      setBusy(false)
    }
  }

  async function del(profileId: string): Promise<void> {
    await window.ordolith.instances.deleteProfile(instance.id, profileId)
    await reload()
    await onChanged()
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
        <div className="modal__head">
          <h3 className="modal__title">
            <Layers size={18} /> {t("profiles.title")}
          </h3>
          <p className="panel__desc">{t("profiles.subtitle", { name: instance.name })}</p>
        </div>

        <div className="field">
          <label htmlFor="profile-name">{t("profiles.newLabel")}</label>
          <div className="inline-form">
            <input
              id="profile-name"
              className="input"
              placeholder={t("profiles.namePlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button className="btn btn-accent" onClick={save} disabled={busy || !newName.trim()}>
              <Save size={16} /> {t("profiles.save")}
            </button>
          </div>
        </div>

        <div className="profile-list">
          {profiles.length === 0 && <p className="empty-hint">{t("profiles.empty")}</p>}
          {profiles.map((p) => (
            <div key={p.id} className={`profile-row ${activeId === p.id ? "is-active" : ""}`}>
              <div className="profile-row__info">
                <span className="profile-row__name">{p.name}</span>
                <span className="profile-row__meta">{t("profiles.modCount", { n: p.enabled.length })}</span>
              </div>
              <div className="profile-row__actions">
                <button className="btn btn-sm" onClick={() => apply(p.id)} disabled={busy}>
                  {activeId === p.id ? t("profiles.active") : t("profiles.apply")}
                </button>
                <button
                  className="btn btn-icon btn-sm"
                  aria-label={t("common.remove")}
                  onClick={() => del(p.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="field">
          <div className="field__head">
            <label>
              <Archive size={15} /> {t("backups.title")}
            </label>
            <button className="btn btn-sm" onClick={createBackup} disabled={busy}>
              <Save size={14} /> {t("backups.create")}
            </button>
          </div>
          <p className="panel__desc">{t("backups.desc")}</p>
          <div className="profile-list">
            {backups.length === 0 && <p className="empty-hint">{t("backups.empty")}</p>}
            {backups.map((b) => (
              <div key={b.id} className="profile-row">
                <div className="profile-row__info">
                  <span className="profile-row__name">
                    {new Date(b.createdAt).toLocaleString()}
                  </span>
                  <span className="profile-row__meta">{formatBytes(b.size)}</span>
                </div>
                <div className="profile-row__actions">
                  <button className="btn btn-sm" onClick={() => restoreBackup(b.id)} disabled={busy}>
                    <RotateCcw size={14} /> {t("backups.restore")}
                  </button>
                  <button
                    className="btn btn-icon btn-sm"
                    aria-label={t("common.remove")}
                    onClick={() => removeBackup(b.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal__actions">
          <button className="btn btn-ghost" onClick={() => window.ordolith.backups.openFolder()}>
            <FolderOpen size={15} /> {t("backups.openFolder")}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

type WizardMode = "custom" | "modpack"
type WizardStep = "basics" | "content"

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
  const pushToast = useStore((s) => s.pushToast)
  const [mode, setMode] = useState<WizardMode>("custom")
  const [step, setStep] = useState<WizardStep>("basics")
  const [name, setName] = useState("")
  const [loader, setLoader] = useState<ModLoader>("vanilla")
  const [version, setVersion] = useState(defaultVersion)
  const [showSnapshots, setShowSnapshots] = useState(false)
  const [color, setColor] = useState(COLORS[0])
  const [busy, setBusy] = useState(false)
  /** Instance created at the end of step 1, used to install content in step 2. */
  const [created, setCreated] = useState<Instance | null>(null)
  const [pending, setPending] = useState(0)

  const list = useMemo(
    () => versions.filter((v) => (showSnapshots ? true : v.type === "release")),
    [versions, showSnapshots],
  )

  async function createAndAdvance(): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed || !version) return
    setBusy(true)
    try {
      const instance = await window.ordolith.instances.create({
        name: trimmed,
        versionId: version,
        loader,
        iconColor: color,
      })
      setCreated(instance)
      setStep("content")
    } finally {
      setBusy(false)
    }
  }

  async function installPick(type: ContentType, project: ContentProject): Promise<boolean> {
    if (!created) return false
    try {
      await window.ordolith.content.install(created.id, type, project)
      setPending((n) => n + 1)
      return true
    } catch {
      pushToast(t("mods.installFailed", { name: project.title }), "error")
      return false
    }
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
        className={`modal glass glass-strong ${step === "content" || mode === "modpack" ? "modal--wide" : ""}`}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h3 className="modal__title">{t("wizard.title")}</h3>
          {mode === "custom" && (
            <div className="wizard__steps">
              <span className={step === "basics" ? "is-active" : ""}>1. {t("wizard.stepBasics")}</span>
              <span className={step === "content" ? "is-active" : ""}>2. {t("wizard.stepContent")}</span>
            </div>
          )}
        </div>

        {step === "basics" ? (
          <>
            <div className="wizard__modes">
              <button
                className={`wizard__mode ${mode === "custom" ? "is-active" : ""}`}
                onClick={() => setMode("custom")}
              >
                <Package size={20} />
                <span className="wizard__mode-title">{t("wizard.modeCustom")}</span>
                <span className="wizard__mode-desc">{t("wizard.modeCustomDesc")}</span>
              </button>
              <button
                className={`wizard__mode ${mode === "modpack" ? "is-active" : ""}`}
                onClick={() => setMode("modpack")}
              >
                <Boxes size={20} />
                <span className="wizard__mode-title">{t("wizard.modeModpack")}</span>
                <span className="wizard__mode-desc">{t("wizard.modeModpackDesc")}</span>
              </button>
            </div>

            {mode === "modpack" ? (
              <>
                <div className="wizard__browser">
                  <ModpackBrowser
                    onInstalled={() => {
                      onCreated()
                    }}
                  />
                </div>
                <div className="modal__actions">
                  <button className="btn btn-ghost" onClick={onClose}>
                    {t("common.cancel")}
                  </button>
                </div>
              </>
            ) : (
              <>
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
                    onClick={createAndAdvance}
                    disabled={busy || !name.trim() || !version}
                  >
                    {busy ? `${t("wizard.creating")}` : t("wizard.next")}
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          created && (
            <>
              <div className="wizard__content-head">
                <div>
                  <h4>{t("wizard.addMods")}</h4>
                  <p className="panel__desc">{t("wizard.contentHint")}</p>
                </div>
                {pending > 0 && <span className="badge">{t("wizard.pending", { n: pending })}</span>}
              </div>
              <div className="wizard__browser">
                <ContentBrowser
                  instanceId={created.id}
                  loader={created.loader}
                  gameVersion={created.versionId}
                  onInstall={installPick}
                  compact
                />
              </div>
              <div className="modal__actions">
                <button className="btn btn-ghost" onClick={onCreated}>
                  {t("wizard.skip")}
                </button>
                <button className="btn btn-accent" onClick={onCreated}>
                  {t("wizard.finish")}
                </button>
              </div>
            </>
          )
        )}
      </motion.div>
    </motion.div>
  )
}
