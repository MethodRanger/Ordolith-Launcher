import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { TitleBar } from "./components/TitleBar"
import { Sidebar } from "./components/Sidebar"
import { LoginScreen } from "./screens/LoginScreen"
import { PlayScreen } from "./screens/PlayScreen"
import { InstancesScreen } from "./screens/InstancesScreen"
import { ServersScreen } from "./screens/ServersScreen"
import { ModsScreen } from "./screens/ModsScreen"
import { NewsScreen } from "./screens/NewsScreen"
import { StatsScreen } from "./screens/StatsScreen"
import { SettingsScreen } from "./screens/SettingsScreen"
import { CrashScreen } from "./screens/CrashScreen"
import { Splash } from "./components/Splash"
import { ToastHost } from "./components/ToastHost"
import { CommandPalette } from "./components/CommandPalette"
import { useStore } from "./store/useStore"

/** True when this window was opened as the standalone crash assistant. */
const IS_CRASH_WINDOW = new URLSearchParams(window.location.search).get("view") === "crash"

export function App(): React.JSX.Element {
  const ready = useStore((s) => s.ready)
  const view = useStore((s) => s.view)
  const accounts = useStore((s) => s.accounts)
  const theme = useStore((s) => s.settings?.theme ?? "ordolith")
  const bootstrap = useStore((s) => s.bootstrap)
  const [platform, setPlatform] = useState<NodeJS.Platform>("linux")

  useEffect(() => {
    window.ordolith.app.getInfo().then((i) => setPlatform(i.platform))
    if (IS_CRASH_WINDOW) return
    bootstrap()
  }, [bootstrap])

  // Apply the active theme to the document root so CSS token overrides kick in.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // The crash assistant is a self-contained window with its own chrome.
  if (IS_CRASH_WINDOW) {
    return (
      <div className="shell shell--crash">
        <div className="app-backdrop" />
        <TitleBar platform={platform} crashMode />
        <main className="shell__main">
          <CrashScreen />
        </main>
      </div>
    )
  }

  if (!ready) {
    return <Splash />
  }

  if (accounts.length === 0) {
    return (
      <>
        <LoginScreen />
        <ToastHost />
      </>
    )
  }

  return (
    <div className="shell">
      <div className="app-backdrop" />
      <TitleBar platform={platform} />
      <div className="shell__body">
        <Sidebar />
        <main className="shell__main">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              className="view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              {view === "play" && <PlayScreen />}
              {view === "instances" && <InstancesScreen />}
              {view === "mods" && <ModsScreen />}
              {view === "servers" && <ServersScreen />}
              {view === "news" && <NewsScreen />}
              {view === "stats" && <StatsScreen />}
              {view === "settings" && <SettingsScreen />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <CommandPalette />
      <ToastHost />
    </div>
  )
}
