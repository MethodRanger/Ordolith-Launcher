import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, Info, XCircle } from "lucide-react"
import { useStore } from "../store/useStore"

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const

export function ToastHost(): React.JSX.Element {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)

  return (
    <div className="toast-host" role="region" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind]
          return (
            <motion.button
              key={toast.id}
              className={`toast toast--${toast.kind}`}
              onClick={() => dismiss(toast.id)}
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              layout
            >
              <Icon size={18} />
              <span>{toast.message}</span>
            </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
