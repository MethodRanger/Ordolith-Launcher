import { motion } from "framer-motion"

/** Boot splash: the logo appears with a fade + scale, then the shell mounts. */
export function Splash(): React.JSX.Element {
  return (
    <>
      <div className="app-backdrop" />
      <div className="splash">
        <motion.img
          className="splash__logo"
          src="/ordolith-logo.svg"
          alt="Ordolith"
          initial={{ opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 20 }}
        />
        <motion.span
          className="splash__name"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          Ordolith
        </motion.span>
        <motion.span
          className="splash__bar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        />
      </div>
    </>
  )
}
