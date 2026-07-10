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
import { SettingsScreen } from "./screens/SettingsScreen"
import { Splash } from "./components/Splash"
import { ToastHost } from "./components/ToastHost"
import { useStore } from "./store/useStore"

export function App(): React.JSX.Element {
  const ready = useStore((s) => s.ready)
  const view = useStore((s) => s.view)
  const accounts = useStore((s) => s.accounts)
  const bootstrap = useStore((s) => s.bootstrap)
  const [platform, setPlatform] = useState<NodeJS.Platform>("linux")

  useEffect(() => {
    bootstrap()
    window.ordolith.app.getInfo().then((i) => setPlatform(i.platform))
  }, [bootstrap])

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
              {view === "settings" && <SettingsScreen />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <ToastHost />
    </div>
  )
}
