import { useEffect, useState } from "react"
import type { AppInfo } from "@shared/ipc"

/**
 * Placeholder shell for the launcher. This exists to prove the
 * main <-> preload <-> renderer IPC round-trip works end to end.
 * The real UI/design is layered on top of this later.
 */
export function App(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.ordolith
      .getInfo()
      .then(setInfo)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [])

  return (
    <main className="shell">
      <header className="shell__header">
        <h1 className="shell__title">Ordolith</h1>
        <p className="shell__subtitle">Minecraft: Java Edition launcher</p>
      </header>

      <section className="shell__panel">
        <h2>IPC status</h2>
        {error ? (
          <p className="shell__error">Bridge error: {error}</p>
        ) : info ? (
          <dl className="shell__info">
            <div>
              <dt>App</dt>
              <dd>
                {info.name} v{info.version}
              </dd>
            </div>
            <div>
              <dt>Electron</dt>
              <dd>{info.electron}</dd>
            </div>
            <div>
              <dt>Chromium</dt>
              <dd>{info.chrome}</dd>
            </div>
            <div>
              <dt>Node</dt>
              <dd>{info.node}</dd>
            </div>
            <div>
              <dt>Platform</dt>
              <dd>
                {info.platform} ({info.arch})
              </dd>
            </div>
          </dl>
        ) : (
          <p>Connecting to main process…</p>
        )}
      </section>

      <footer className="shell__footer">
        <span>{"Scaffold ready — design & features come next."}</span>
      </footer>
    </main>
  )
}
