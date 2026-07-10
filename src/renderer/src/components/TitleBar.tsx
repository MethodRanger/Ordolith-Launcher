import { Minus, Square, X } from "lucide-react"
import logo from "../assets/logo"

/**
 * Custom frameless title bar. The whole strip is a drag region except the
 * interactive controls. On macOS the OS still draws the traffic-light buttons
 * (titleBarStyle: "hidden"), so our own window buttons are hidden there and we
 * add left padding to make room for them.
 */
export function TitleBar({ platform }: { platform: NodeJS.Platform }): React.JSX.Element {
  const isMac = platform === "darwin"

  return (
    <header className="titlebar drag" style={{ paddingLeft: isMac ? 84 : 16 }}>
      <div className="titlebar__brand">
        <img className="titlebar__logo" src={logo} alt="" aria-hidden />
        <span className="titlebar__name">Ordolith</span>
      </div>

      {!isMac && (
        <div className="titlebar__controls no-drag">
          <button
            className="titlebar__btn"
            aria-label="Minimize window"
            onClick={() => window.ordolith.window.minimize()}
          >
            <Minus size={15} />
          </button>
          <button
            className="titlebar__btn"
            aria-label="Toggle maximize window"
            onClick={() => window.ordolith.window.maximizeToggle()}
          >
            <Square size={12} />
          </button>
          <button
            className="titlebar__btn titlebar__btn--close"
            aria-label="Close window"
            onClick={() => window.ordolith.window.close()}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </header>
  )
}
