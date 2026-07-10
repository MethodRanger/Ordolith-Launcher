import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Boxes, Clock, Download, FolderOpen, Package, Play, Plus, Trash2, Upload } from "lucide-react"
import type { ContentProject, ContentType, Instance, ModLoader } from "@shared/ipc"
import { useStore } from "../store/useStore"
import { useI18n } from "../i18n"
import { ContentBrowser } from "../components/ContentBrowser"
import { ModpackBrowser } from "../components/ModpackBrowser"

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
        className={`modal glass glass-strong ${step === "content" ? "modal--wide" : ""}`}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h3 className="modal__title">{t("wizard.title")}</h3>
          <div className="wizard__steps">
            <span className={step === "basics" ? "is-active" : ""}>1. {t("wizard.stepBasics")}</span>
            <span className={step === "content" ? "is-active" : ""}>2. {t("wizard.stepContent")}</span>
          </div>
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
                <ModpackBrowser
                  onInstalled={() => {
                    onCreated()
                  }}
                />
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
