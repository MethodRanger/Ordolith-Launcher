import { Boxes, Gamepad2, Newspaper, PackageSearch, Server, Settings } from "lucide-react"
import { activeAccount, useStore, type View } from "../store/useStore"

const NAV: { id: View; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "play", label: "Play", icon: Gamepad2 },
  { id: "instances", label: "Instances", icon: Boxes },
  { id: "mods", label: "Content", icon: PackageSearch },
  { id: "servers", label: "Servers", icon: Server },
  { id: "news", label: "News", icon: Newspaper },
  { id: "settings", label: "Settings", icon: Settings },
]

export function Sidebar(): React.JSX.Element {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const accounts = useStore((s) => s.accounts)
  const account = activeAccount(accounts)

  return (
    <nav className="sidebar glass" aria-label="Primary">
      <ul className="sidebar__nav">
        {NAV.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button
              className={`sidebar__item ${view === id ? "is-active" : ""}`}
              onClick={() => setView(id)}
              aria-current={view === id ? "page" : undefined}
            >
              <span className="sidebar__icon">
                <Icon size={20} />
              </span>
              <span className="sidebar__label">{label}</span>
            </button>
          </li>
        ))}
      </ul>

      <button className="sidebar__account no-drag" onClick={() => setView("settings")}>
        <span
          className="sidebar__avatar"
          style={{
            backgroundImage: account?.avatarUrl ? `url(${account.avatarUrl})` : undefined,
          }}
          aria-hidden
        >
          {!account?.avatarUrl && (account?.username?.[0]?.toUpperCase() ?? "?")}
        </span>
        <span className="sidebar__account-meta">
          <span className="sidebar__account-name">{account?.username ?? "No account"}</span>
          <span className="sidebar__account-kind">
            {account ? (account.kind === "microsoft" ? "Microsoft" : "Offline") : "Sign in"}
          </span>
        </span>
      </button>
    </nav>
  )
}
