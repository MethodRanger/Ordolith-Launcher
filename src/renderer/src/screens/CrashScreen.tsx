import { useEffect, useRef, useState } from "react"
import { AlertTriangle, ClipboardCopy, Lightbulb, ScrollText } from "lucide-react"
import type { CrashReport } from "@shared/ipc"
import { useI18n } from "../i18n"

/**
 * Standalone crash-assistant view. Rendered in its own window (opened by the
 * main process when a game process exits abnormally). It shows likely causes
 * translated from the analysed log plus the raw tail for debugging.
 */
export function CrashScreen(): React.JSX.Element {
  const { t } = useI18n()
  const [report, setReport] = useState<CrashReport | null>(null)
  const [copied, setCopied] = useState(false)
  const logRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    window.ordolith.crash.getData().then((r) => r && setReport(r))
    const off = window.ordolith.crash.onOpen((r) => setReport(r))
    return off
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [report])

  async function copyLog(): Promise<void> {
    if (!report) return
    await navigator.clipboard.writeText(report.log)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!report) {
    return (
      <div className="content">
        <div className="empty glass">
          <p>{t("crash.waiting")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="content crash">
      <div className="crash__banner glass glass-strong">
        <span className="crash__icon" aria-hidden>
          <AlertTriangle size={26} />
        </span>
        <div>
          <h2>{t("crash.title")}</h2>
          <p className="crash__sub">
            {t("crash.subtitle", {
              name: report.instanceName,
              code: report.exitCode ?? "?",
            })}
          </p>
        </div>
      </div>

      <section className="panel glass">
        <div className="panel__head">
          <h3>
            <Lightbulb size={16} /> {t("crash.likely")}
          </h3>
        </div>
        <ul className="crash__hints">
          {report.hints.map((key) => (
            <li key={key} className="crash__hint">
              <span className="crash__hint-dot" aria-hidden />
              {t(key)}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel glass">
        <div className="panel__head">
          <h3>
            <ScrollText size={16} /> {t("crash.log")}
          </h3>
          <button className="btn" onClick={copyLog}>
            <ClipboardCopy size={15} /> {copied ? t("crash.copied") : t("crash.copy")}
          </button>
        </div>
        <pre ref={logRef} className="crash__log">
          {report.log || t("crash.noLog")}
        </pre>
      </section>
    </div>
  )
}
