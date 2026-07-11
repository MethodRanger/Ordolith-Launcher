import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { BarChart3, Boxes, Gamepad2, Newspaper, Play, Search, Server, Settings2, Package } from "lucide-react"
import { useI18n } from "../i18n"
import { useStore, type View } from "../store/useStore"

interface Command {
  id: string
  label: string
  hint: string
  icon: React.ComponentType<{ size?: number }>
  group: "navigate" | "actions"
  run: () => void
}

/**
 * Global command palette (Ctrl/Cmd+K). Provides fast keyboard navigation
 * between screens and quick actions like launching the last-played instance.
 */
export function CommandPalette(): React.JSX.Element {
  const { t } = useI18n()
  const setView = useStore((s) => s.setView)
  const instances = useStore((s) => s.instances)
  const selectInstance = useStore((s) => s.selectInstance)
  const pushToast = useStore((s) => s.pushToast)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Toggle with Ctrl/Cmd+K anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === "Escape") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery("")
      setActive(0)
      // Focus after the enter animation begins.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const go = (view: View): void => {
    setView(view)
    setOpen(false)
  }

  const launchLast = (): void => {
    const last = [...instances].sort(
      (a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0),
    )[0]
    if (!last) {
      setView("instances")
      setOpen(false)
      return
    }
    selectInstance(last.id)
    setView("play")
    setOpen(false)
    window.ordolith.launcher.launch(last.id).catch(() => pushToast(t("play.launchFailed"), "error"))
  }

  const commands = useMemo<Command[]>(
    () => [
      { id: "play", label: t("nav.play"), hint: t("palette.navigate"), icon: Gamepad2, group: "navigate", run: () => go("play") },
      { id: "instances", label: t("nav.instances"), hint: t("palette.navigate"), icon: Boxes, group: "navigate", run: () => go("instances") },
      { id: "mods", label: t("nav.mods"), hint: t("palette.navigate"), icon: Package, group: "navigate", run: () => go("mods") },
      { id: "servers", label: t("nav.servers"), hint: t("palette.navigate"), icon: Server, group: "navigate", run: () => go("servers") },
      { id: "news", label: t("nav.news"), hint: t("palette.navigate"), icon: Newspaper, group: "navigate", run: () => go("news") },
      { id: "stats", label: t("nav.stats"), hint: t("palette.navigate"), icon: BarChart3, group: "navigate", run: () => go("stats") },
      { id: "settings", label: t("nav.settings"), hint: t("palette.navigate"), icon: Settings2, group: "navigate", run: () => go("settings") },
      { id: "launch-last", label: t("palette.launchLast"), hint: t("palette.actions"), icon: Play, group: "actions", run: launchLast },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, instances],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [query, commands])

  useEffect(() => {
    if (active >= results.length) setActive(0)
  }, [results, active])

  const onListKey = (e: React.KeyboardEvent): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (i + 1) % Math.max(results.length, 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i - 1 + results.length) % Math.max(results.length, 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      results[active]?.run()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="palette-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="palette glass"
            role="dialog"
            aria-modal="true"
            aria-label={t("palette.open")}
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="palette__search">
              <Search size={18} />
              <input
                ref={inputRef}
                className="input"
                value={query}
                placeholder={t("palette.placeholder")}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onListKey}
              />
              <kbd className="palette__kbd">ESC</kbd>
            </div>
            <div className="palette__list" role="listbox">
              {results.length === 0 ? (
                <p className="palette__empty">{t("palette.empty")}</p>
              ) : (
                results.map((c, i) => {
                  const Icon = c.icon
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      className={`palette__item ${i === active ? "is-active" : ""}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => c.run()}
                    >
                      <Icon size={16} />
                      <span className="palette__item-label">{c.label}</span>
                      <span className="palette__item-hint">{c.hint}</span>
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
