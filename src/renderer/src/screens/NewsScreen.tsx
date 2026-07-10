import { motion } from "framer-motion"
import { CalendarDays, Sparkles } from "lucide-react"

const RELEASES = [
  { version: "1.21.5", date: "2025-03-25", title: "Spring to Life", body: "New warm and cold biome variants, ambient features, improved spawn eggs and quality-of-life updates." },
  { version: "1.21.4", date: "2024-12-03", title: "The Garden Awakens", body: "The Pale Garden biome, Creaking mob, resin blocks and expanded exploration content." },
  { version: "1.21.2", date: "2024-10-22", title: "Bundles of Bravery", body: "Bundles return with polished controls, Hardcore mode reaches Bedrock parity, and Realms gets improvements." },
  { version: "1.21", date: "2024-06-13", title: "Tricky Trials", body: "Trial Chambers, the Breeze, vaults, the mace, crafter automation and new copper and tuff blocks." },
]

export function NewsScreen(): React.JSX.Element {
  return <div className="content"><div className="page-head"><h2>What&apos;s new</h2><p>Highlights from recent Minecraft Java releases.</p></div><div className="release-list">{RELEASES.map((release, index) => <motion.article key={release.version} className="release glass" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}><div className="release__mark"><Sparkles size={18}/></div><div><div className="release__title"><h3>Minecraft {release.version} · {release.title}</h3><span><CalendarDays size={13}/>{new Date(release.date).toLocaleDateString()}</span></div><p>{release.body}</p></div></motion.article>)}</div></div>
}
