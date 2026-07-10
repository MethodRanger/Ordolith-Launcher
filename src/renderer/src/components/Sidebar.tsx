import { motion } from "framer-motion"
import { Boxes, Gamepad2, Newspaper, PackageSearch, Server, Settings } from "lucide-react"
import { accountAvatar, activeAccount, useStore, type View } from "../store/useStore"
import { useI18n } from "../i18n"

const NAV: { id: View; key: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "play", key: "nav.play", icon: Gamepad2 },
  { id: "instances", key: "nav.instances", icon: Boxes },
  { id: "mods", key: "nav.mods", icon: PackageSearch },
  { id: "servers", key: "nav.servers", icon: Server },
  { id: "news", key: "nav.news", icon: Newspaper },
  { id: "settings", key: "nav.settings", icon: Settings },
]

export function Sidebar(): React.JSX.Element {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const accounts = useStore((s) => s.accounts)
  const account = activeAccount(accounts)
  const { t } = useI18n()

  return (
    <nav className="sidebar glass" aria-label="Primary">
      <ul className="sidebar__nav">
        {NAV.map(({ id, key, icon: Icon }) => (
          <li key={id}>
            <button
              className={`sidebar__item ${view === id ? "is-active" : ""}`}
              onClick={() => setView(id)}
              aria-current={view === id ? "page" : undefined}
            >
              {view === id && (
                <motion.span
                  className="sidebar__active"
                  layoutId="sidebar-active"
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
              <span className="sidebar__icon">
                <Icon size={20} />
              </span>
              <span className="sidebar__label">{t(key)}</span>
            </button>
          </li>
        ))}
      </ul>

      <button className="sidebar__account no-drag" onClick={() => setView("settings")}>
        <span
          className="sidebar__avatar"
          style={{
            backgroundImage: accountAvatar(account) ? `url(${accountAvatar(account)})` : undefined,
          }}
          aria-hidden
        >
          {!accountAvatar(account) && (account?.username?.[0]?.toUpperCase() ?? "?")}
        </span>
        <span className="sidebar__account-meta">
          <span className="sidebar__account-name">{account?.username ?? t("login.modeOffline")}</span>
          <span className="sidebar__account-kind">
            {account ? (account.kind === "microsoft" ? "Microsoft" : t("common.offline")) : t("login.microsoft")}
          </span>
        </span>
      </button>
    </nav>
  )
}
