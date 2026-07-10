import { useState } from "react"
import { motion } from "framer-motion"
import { LogIn, User, Loader2 } from "lucide-react"
import { useStore } from "../store/useStore"
import { useI18n } from "../i18n"

type Mode = "microsoft" | "offline"

export function LoginScreen(): React.JSX.Element {
  const refreshAccounts = useStore((s) => s.refreshAccounts)
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>("microsoft")
  const [username, setUsername] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signInMicrosoft(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await window.ordolith.accounts.loginMicrosoft()
      await refreshAccounts()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microsoft sign-in failed.")
    } finally {
      setBusy(false)
    }
  }

  async function signInOffline(): Promise<void> {
    const name = username.trim()
    if (name.length < 3) {
      setError("Username must be at least 3 characters.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await window.ordolith.accounts.loginOffline(name)
      await refreshAccounts()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create offline account.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="app-backdrop" />
      <div className="titlebar drag" />

      <motion.div
        className="login__card glass"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="login__brand">
          <img className="login__logo" src="/ordolith-logo.svg" alt="" aria-hidden />
          <h1 className="login__title">Ordolith</h1>
          <p className="login__subtitle">{t("login.subtitle")}</p>
        </div>

        <div className="segmented no-drag" role="tablist" aria-label="Sign-in method">
          <button
            role="tab"
            aria-selected={mode === "microsoft"}
            className={`segmented__opt ${mode === "microsoft" ? "is-active" : ""}`}
            onClick={() => setMode("microsoft")}
          >
            {t("login.modeMicrosoft")}
          </button>
          <button
            role="tab"
            aria-selected={mode === "offline"}
            className={`segmented__opt ${mode === "offline" ? "is-active" : ""}`}
            onClick={() => setMode("offline")}
          >
            {t("login.modeOffline")}
          </button>
        </div>

        {mode === "microsoft" ? (
          <div className="login__panel">
            <p className="login__hint">{t("login.hintMicrosoft")}</p>
            <button className="btn btn-accent login__cta" onClick={signInMicrosoft} disabled={busy}>
              {busy ? <Loader2 className="spin" size={18} /> : <LogIn size={18} />}
              {t("login.microsoft")}
            </button>
          </div>
        ) : (
          <div className="login__panel">
            <div className="field">
              <label htmlFor="offline-name">{t("login.offlineName")}</label>
              <input
                id="offline-name"
                className="input"
                placeholder="Steve"
                value={username}
                maxLength={16}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                    signInOffline()
                  }
                }}
              />
            </div>
            <p className="login__hint">{t("login.hintOffline")}</p>
            <button className="btn btn-accent login__cta" onClick={signInOffline} disabled={busy}>
              {busy ? <Loader2 className="spin" size={18} /> : <User size={18} />}
              {t("login.offlinePlay")}
            </button>
          </div>
        )}

        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}
      </motion.div>
    </div>
  )
}
