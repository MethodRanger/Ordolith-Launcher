import { lazy, Suspense, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Activity, Check, Code2, Download, FolderOpen, Globe, HardDrive, LifeBuoy, LogOut, Palette, RefreshCw, ServerCog, ShieldAlert, Upload, User, UserPlus } from "lucide-react"
import type { AppInfo, DiagnosticsReport, JavaRuntime, SystemMemoryInfo, ThemeId } from "@shared/ipc"
import { accountAvatar, accountSkin, activeAccount, useStore } from "../store/useStore"
import { LOCALES, useI18n } from "../i18n"

const SkinViewer = lazy(() => import("../components/SkinViewer").then((m) => ({ default: m.SkinViewer })))

const AIKARS_FLAGS =
  "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:G1HeapRegionSize=8M"

/** Selectable UI themes, each mapped to a preview accent + base swatch. */
const THEMES: { id: ThemeId; accent: string; base: string }[] = [
  { id: "ordolith", accent: "#4cc8ff", base: "#0e1118" },
  { id: "midnight", accent: "#6ea8fe", base: "#0a0c14" },
  { id: "nebula", accent: "#c77dff", base: "#120e1a" },
  { id: "forest", accent: "#54d18c", base: "#0b120e" },
  { id: "sunset", accent: "#ff9d54", base: "#160f0d" },
  { id: "mono", accent: "#c4c9d4", base: "#101216" },
]

export function SettingsScreen(): React.JSX.Element {
  const accounts = useStore((s) => s.accounts)
  const refreshAccounts = useStore((s) => s.refreshAccounts)
  const settings = useStore((s) => s.settings)
  const saveSettingsStore = useStore((s) => s.saveSettings)
  const pushToast = useStore((s) => s.pushToast)
  const { t, locale, setLocale } = useI18n()

  const [info, setInfo] = useState<AppInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [offlineName, setOfflineName] = useState("")
  const [runtimes, setRuntimes] = useState<JavaRuntime[] | null>(null)
  const [memory, setMemory] = useState<SystemMemoryInfo | null>(null)
  const [jvmArgs, setJvmArgs] = useState("")
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null)
  const [diagBusy, setDiagBusy] = useState(false)

  async function runDiagnostics(): Promise<void> {
    setDiagBusy(true)
    try {
      setDiagnostics(await window.ordolith.app.diagnostics())
    } finally {
      setDiagBusy(false)
    }
  }

  async function exportSettingsFile(): Promise<void> {
    const res = await window.ordolith.app.exportSettings()
    if (res.ok) pushToast(t("sync.exported"), "success")
    else if (res.error !== "cancelled") pushToast(t("toast.error"), "error")
  }

  async function importSettingsFile(): Promise<void> {
    const res = await window.ordolith.app.importSettings()
    if (res.ok) {
      await useStore.getState().refreshSettings()
      await useStore.getState().refreshServers()
      pushToast(t("sync.imported"), "success")
    } else if (res.error !== "cancelled") {
      pushToast(t("toast.error"), "error")
    }
  }

  useEffect(() => {
    window.ordolith.app.getInfo().then(setInfo)
    window.ordolith.app.memory().then(setMemory)
    window.ordolith.java.discover().then(setRuntimes)
  }, [])

  useEffect(() => {
    if (settings) setJvmArgs(settings.jvmArgs ?? "")
  }, [settings])

  async function patchSettings(patch: Partial<NonNullable<typeof settings>>): Promise<void> {
    await saveSettingsStore(patch)
  }

  async function setActive(id: string): Promise<void> {
    await window.ordolith.accounts.setActive(id)
    await refreshAccounts()
  }

  async function logout(id: string): Promise<void> {
    await window.ordolith.accounts.logout(id)
    await refreshAccounts()
  }

  async function addMicrosoft(): Promise<void> {
    setBusy(true)
    try {
      await window.ordolith.accounts.loginMicrosoft()
      await refreshAccounts()
      pushToast(t("toast.accountAdded"), "success")
    } catch {
      pushToast(t("toast.error"), "error")
    } finally {
      setBusy(false)
    }
  }

  async function addOffline(): Promise<void> {
    const name = offlineName.trim()
    if (name.length < 3) return
    await window.ordolith.accounts.loginOffline(name)
    setOfflineName("")
    await refreshAccounts()
    pushToast(t("toast.accountAdded"), "success")
  }

  async function changeAvatar(id: string): Promise<void> {
    await window.ordolith.accounts.chooseAvatar(id)
    await refreshAccounts()
  }

  async function downloadJava(): Promise<void> {
    setBusy(true)
    try {
      await window.ordolith.java.download("21")
      setRuntimes(await window.ordolith.java.discover())
      pushToast(t("toast.javaDownloaded"), "success")
    } catch {
      pushToast(t("toast.javaFailed"), "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <h2>{t("settings.title")}</h2>
      </div>

      {/* Language ---------------------------------------------------- */}
      <section className="panel glass">
        <div className="panel__head">
          <h3>
            <Globe size={16} /> {t("settings.language")}
          </h3>
        </div>
        <p className="panel__desc">{t("settings.languageDesc")}</p>
        <div className="lang-grid">
          {LOCALES.map((l) => (
            <button
              key={l.id}
              className={`lang-opt ${locale === l.id ? "is-active" : ""}`}
              onClick={() => setLocale(l.id)}
            >
              {l.label}
              {locale === l.id && <Check size={15} />}
            </button>
          ))}
        </div>
      </section>

      {/* Appearance -------------------------------------------------- */}
      <section className="panel glass">
        <div className="panel__head">
          <h3>
            <Palette size={16} /> {t("settings.appearance")}
          </h3>
        </div>
        <p className="panel__desc">{t("settings.themeDesc")}</p>
        <div className="theme-grid">
          {THEMES.map((th) => (
            <button
              key={th.id}
              className={`theme-opt ${settings?.theme === th.id ? "is-active" : ""}`}
              onClick={() => patchSettings({ theme: th.id })}
              style={{ background: th.base }}
            >
              <span className="theme-opt__swatch" style={{ background: th.accent }} aria-hidden />
              <span className="theme-opt__name">{t(`settings.theme.${th.id}`)}</span>
              {settings?.theme === th.id && <Check size={14} className="theme-opt__check" />}
            </button>
          ))}
        </div>
      </section>

      {/* Preferences ------------------------------------------------- */}
      <section className="panel glass">
        <div className="panel__head">
          <h3>
            <ServerCog size={16} /> {t("settings.preferences")}
          </h3>
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings?.serverAutoRefresh ?? true}
            onChange={(e) => patchSettings({ serverAutoRefresh: e.target.checked })}
          />
          {t("settings.serverAutoRefresh")}
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings?.crashAssistant ?? true}
            onChange={(e) => patchSettings({ crashAssistant: e.target.checked })}
          />
          <ShieldAlert size={15} /> {t("settings.crashAssistant")}
        </label>
      </section>

      {/* Accounts ---------------------------------------------------- */}
      <section className="panel glass">
        <div className="panel__head">
          <h3>{t("settings.accounts")}</h3>
          <button className="btn" onClick={addMicrosoft} disabled={busy}>
            <UserPlus size={16} /> {t("settings.addMicrosoft")}
          </button>
        </div>
        <p className="panel__desc">{t("settings.accountsDesc")}</p>
        <div className="account-list">
          {accounts.map((a) => (
            <motion.div key={a.id} layout className={`account-row ${a.active ? "is-active" : ""}`}>
              <button
                className="account-row__avatar"
                style={{ backgroundImage: accountAvatar(a) ? `url(${accountAvatar(a)})` : undefined }}
                onClick={() => changeAvatar(a.id)}
                title={t("settings.avatar")}
              >
                {!accountAvatar(a) && a.username[0]?.toUpperCase()}
              </button>
              <div className="account-row__meta">
                <span className="account-row__name">{a.username}</span>
                <span className="account-row__kind">
                  {a.kind === "microsoft" ? "Microsoft" : t("common.offline")}
                </span>
              </div>
              {a.active ? (
                <span className="badge">
                  <Check size={13} /> {t("settings.active")}
                </span>
              ) : (
                <button className="btn btn-ghost" onClick={() => setActive(a.id)}>
                  {t("settings.setActive")}
                </button>
              )}
              <button
                className="btn btn-icon"
                aria-label={`Sign out ${a.username}`}
                onClick={() => logout(a.id)}
              >
                <LogOut size={16} />
              </button>
            </motion.div>
          ))}
          {accounts.length === 0 && <p className="panel__empty">{t("common.offline")}</p>}
        </div>
        <div className="inline-form inline-form--flat">
          <input
            className="input"
            placeholder={t("settings.addOffline")}
            value={offlineName}
            maxLength={16}
            onChange={(e) => setOfflineName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) addOffline()
            }}
          />
          <button className="btn btn-accent" onClick={addOffline}>
            <UserPlus size={16} /> {t("common.add")}
          </button>
        </div>
      </section>

      {/* 3D character ------------------------------------------------ */}
      {(() => {
        const current = activeAccount(accounts)
        const skin = accountSkin(current)
        return (
          <section className="panel glass">
            <div className="panel__head">
              <h3>
                <User size={16} /> {t("character.title")}
              </h3>
            </div>
            <p className="panel__desc">{t("character.desc")}</p>
            {current && skin ? (
              <div className="character-stage">
                <Suspense fallback={<div className="skin-viewer__fallback" />}>
                  <SkinViewer skinUrl={skin} />
                </Suspense>
                <span className="character-stage__name">{current.username}</span>
              </div>
            ) : (
              <p className="panel__empty">{t("character.empty")}</p>
            )}
          </section>
        )
      })()}

      {/* Java + memory defaults ------------------------------------- */}
      <section className="panel glass">
        <div className="panel__head">
          <h3>{t("settings.java")}</h3>
          <button className="btn" onClick={downloadJava} disabled={busy}>
            <Download size={16} /> {t("settings.javaDownload")}
          </button>
        </div>
        <p className="panel__desc">{t("settings.javaAuto")}</p>
        <div className="runtime-list">
          {runtimes === null && <p className="panel__empty">{t("common.loading")}…</p>}
          {runtimes?.map((rt) => (
            <div key={rt.id} className="runtime-row">
              <HardDrive size={15} />
              <span className="runtime-row__ver">Java {rt.major}</span>
              <span className="runtime-row__vendor">{rt.vendor}</span>
              <code className="runtime-row__path">{rt.path}</code>
            </div>
          ))}
          {runtimes?.length === 0 && <p className="panel__empty">{t("settings.javaDownload")}</p>}
        </div>

        {settings && memory && (
          <div className="mem">
            <div className="mem__row">
              <label>{t("settings.memoryMax")}</label>
              <span className="mem__val">{settings.defaultMaxMemoryMb} MB</span>
            </div>
            <input
              type="range"
              min={1024}
              max={memory.totalMb}
              step={512}
              value={Math.min(settings.defaultMaxMemoryMb, memory.totalMb)}
              onChange={(e) => patchSettings({ defaultMaxMemoryMb: Number(e.target.value) })}
            />
            <div className="mem__row">
              <label>{t("settings.memoryMin")}</label>
              <span className="mem__val">{settings.defaultMinMemoryMb} MB</span>
            </div>
            <input
              type="range"
              min={512}
              max={settings.defaultMaxMemoryMb}
              step={256}
              value={settings.defaultMinMemoryMb}
              onChange={(e) => patchSettings({ defaultMinMemoryMb: Number(e.target.value) })}
            />
            <p className="mem__hint">{t("settings.memoryAvailable", { total: memory.totalMb })}</p>
          </div>
        )}

        <div className="field">
          <label htmlFor="jvm">{t("settings.jvmArgs")}</label>
          <textarea
            id="jvm"
            className="input"
            rows={2}
            value={jvmArgs}
            onChange={(e) => setJvmArgs(e.target.value)}
            onBlur={() => patchSettings({ jvmArgs })}
          />
          <button
            className="btn btn-ghost"
            onClick={() => {
              setJvmArgs(AIKARS_FLAGS)
              patchSettings({ jvmArgs: AIKARS_FLAGS })
            }}
          >
            {t("settings.jvmPreset")}
          </button>
        </div>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings?.closeToTray ?? false}
            onChange={(e) => patchSettings({ closeToTray: e.target.checked })}
          />
          {t("settings.closeToTray")}
        </label>
      </section>

      {/* Diagnostics ------------------------------------------------- */}
      <section className="panel glass">
        <div className="panel__head">
          <h3>
            <Activity size={16} /> {t("diagnostics.title")}
          </h3>
          <button className="btn" onClick={runDiagnostics} disabled={diagBusy}>
            <RefreshCw size={16} /> {diagBusy ? t("diagnostics.running") : t("diagnostics.run")}
          </button>
        </div>
        <p className="panel__desc">{t("diagnostics.desc")}</p>
        {diagnostics ? (
          <div className="diag-list">
            {diagnostics.items.map((item) => (
              <div key={item.id} className="diag-row">
                <span className={`diag-row__dot is-${item.status}`} aria-hidden />
                <span className="diag-row__label">{t(item.labelKey)}</span>
                <span className="diag-row__value">{item.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="panel__empty">{t("diagnostics.empty")}</p>
        )}
      </section>

      {/* Backup & sync ----------------------------------------------- */}
      <section className="panel glass">
        <div className="panel__head">
          <h3>
            <HardDrive size={16} /> {t("sync.title")}
          </h3>
        </div>
        <p className="panel__desc">{t("sync.desc")}</p>
        <div className="about-links">
          <button className="btn" onClick={exportSettingsFile}>
            <Download size={16} /> {t("sync.export")}
          </button>
          <button className="btn" onClick={importSettingsFile}>
            <Upload size={16} /> {t("sync.import")}
          </button>
        </div>
      </section>

      {/* Data folder ------------------------------------------------- */}
      <section className="panel glass">
        <div className="panel__head">
          <h3>{t("settings.dataDir")}</h3>
        </div>
        <div className="kv">
          <code className="kv__path">{info?.dataDir ?? "…"}</code>
          <button className="btn" onClick={() => info && window.ordolith.app.openDataDir()}>
            <FolderOpen size={16} /> {t("settings.openDataDir")}
          </button>
        </div>
      </section>

      {/* About ------------------------------------------------------- */}
      <section className="panel glass">
        <div className="panel__head">
          <h3>{t("settings.about")}</h3>
        </div>
        {info && (
          <div className="about-grid">
            <div>
              <span className="about-grid__k">Ordolith</span>
              <span className="about-grid__v">v{info.version}</span>
            </div>
            <div>
              <span className="about-grid__k">Electron</span>
              <span className="about-grid__v">{info.electron}</span>
            </div>
            <div>
              <span className="about-grid__k">Chromium</span>
              <span className="about-grid__v">{info.chrome}</span>
            </div>
            <div>
              <span className="about-grid__k">Node</span>
              <span className="about-grid__v">{info.node}</span>
            </div>
            <div>
              <span className="about-grid__k">Platform</span>
              <span className="about-grid__v">
                {info.platform} · {info.arch}
              </span>
            </div>
          </div>
        )}
        <div className="about-links">
          <a
            className="btn support-link"
            href="https://v0-ordolith.vercel.app/"
            target="_blank"
            rel="noreferrer"
          >
            <LifeBuoy size={16} /> {t("settings.support")}
          </a>
          <a
            className="btn support-link"
            href="https://github.com/MethodRanger/Ordolith-Launcher"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 size={16} /> {t("settings.sourceCode")}
          </a>
        </div>
        <p className="panel__desc about-tagline">{t("settings.openSource")}</p>
      </section>
    </div>
  )
}
