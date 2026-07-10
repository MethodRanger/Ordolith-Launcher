import { useEffect, useState } from "react"
import { Check, FolderOpen, LogOut, UserPlus } from "lucide-react"
import type { AppInfo } from "@shared/ipc"
import { useStore } from "../store/useStore"

export function SettingsScreen(): React.JSX.Element {
  const accounts = useStore((s) => s.accounts)
  const refreshAccounts = useStore((s) => s.refreshAccounts)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.ordolith.app.getInfo().then(setInfo)
  }, [])

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
    } catch {
      /* surfaced elsewhere; ignore here */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <h2>Settings</h2>
        <p>Manage accounts and view launcher information.</p>
      </div>

      <section className="panel glass">
        <div className="panel__head">
          <h3>Accounts</h3>
          <button className="btn" onClick={addMicrosoft} disabled={busy}>
            <UserPlus size={16} /> Add Microsoft
          </button>
        </div>
        <div className="account-list">
          {accounts.map((a) => (
            <div key={a.id} className={`account-row ${a.active ? "is-active" : ""}`}>
              <span
                className="account-row__avatar"
                style={{ backgroundImage: a.avatarUrl ? `url(${a.avatarUrl})` : undefined }}
                aria-hidden
              >
                {!a.avatarUrl && a.username[0]?.toUpperCase()}
              </span>
              <div className="account-row__meta">
                <span className="account-row__name">{a.username}</span>
                <span className="account-row__kind">
                  {a.kind === "microsoft" ? "Microsoft" : "Offline"}
                </span>
              </div>
              {a.active ? (
                <span className="badge">
                  <Check size={13} /> Active
                </span>
              ) : (
                <button className="btn btn-ghost" onClick={() => setActive(a.id)}>
                  Use
                </button>
              )}
              <button
                className="btn btn-icon"
                aria-label={`Sign out ${a.username}`}
                onClick={() => logout(a.id)}
              >
                <LogOut size={16} />
              </button>
            </div>
          ))}
          {accounts.length === 0 && <p className="panel__empty">No accounts signed in.</p>}
        </div>
      </section>

      <section className="panel glass">
        <div className="panel__head">
          <h3>Data folder</h3>
        </div>
        <div className="kv">
          <code className="kv__path">{info?.dataDir ?? "…"}</code>
          <button
            className="btn"
            onClick={() => info && window.ordolith.app.openDataDir()}
          >
            <FolderOpen size={16} /> Open
          </button>
        </div>
      </section>

      <section className="panel glass">
        <div className="panel__head">
          <h3>About</h3>
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
      </section>
    </div>
  )
}
