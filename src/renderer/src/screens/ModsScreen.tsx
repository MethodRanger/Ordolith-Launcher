import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Download, Loader2, PackageOpen, Search, Trash2, ToggleLeft, ToggleRight } from "lucide-react"
import type { ContentProject, ContentType, InstalledContent } from "@shared/ipc"
import { useStore } from "../store/useStore"

const TYPES: { id: ContentType; label: string }[] = [
  { id: "mod", label: "Mods" },
  { id: "resourcepack", label: "Resource packs" },
  { id: "shader", label: "Shaders" },
]

export function ModsScreen(): React.JSX.Element {
  const instances = useStore((s) => s.instances)
  const selectedId = useStore((s) => s.selectedInstanceId)
  const selectInstance = useStore((s) => s.selectInstance)
  const instance = instances.find((item) => item.id === selectedId) ?? instances[0]
  const [type, setType] = useState<ContentType>("mod")
  const [tab, setTab] = useState<"browse" | "installed">("browse")
  const [query, setQuery] = useState("")
  const [projects, setProjects] = useState<ContentProject[]>([])
  const [installed, setInstalled] = useState<InstalledContent[]>([])
  const [health, setHealth] = useState("Modrinth online")
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canBrowse = Boolean(instance)
  const loader = instance?.loader ?? "vanilla"

  async function loadInstalled(): Promise<void> {
    if (!instance) return
    setInstalled(await window.ordolith.content.listInstalled(instance.id, type))
  }

  async function search(): Promise<void> {
    if (!instance) return
    setLoading(true)
    try {
      const result = await window.ordolith.content.search({
        query,
        instanceId: instance.id,
        type,
        sort: "relevance",
        limit: 24,
      })
      setProjects(result.projects)
      const curse = result.providerHealth.curseforge
      setHealth(curse === "unavailable" ? "Modrinth online · CurseForge needs API key" : "Modrinth + CurseForge online")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === "installed") void loadInstalled()
    else void search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance?.id, type, tab])

  async function install(project: ContentProject): Promise<void> {
    if (!instance) return
    setBusy(project.id)
    try {
      await window.ordolith.content.install(instance.id, type, project)
      await loadInstalled()
    } finally {
      setBusy(null)
    }
  }

  const cards = useMemo(() => projects.filter((project) => project.types.includes(type)), [projects, type])

  return (
    <div className="content">
      <div className="page-head page-head--row">
        <div><h2>Content</h2><p>Install compatible mods, resource packs and shaders from trusted providers.</p></div>
        <span className="badge badge-muted">{health}</span>
      </div>

      <div className="toolbar glass">
        <select className="input" value={instance?.id ?? ""} onChange={(e) => selectInstance(e.target.value)} aria-label="Instance">
          {instances.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.versionId} · {item.loader}</option>)}
        </select>
        <div className="segmented">
          {TYPES.map((item) => <button key={item.id} className={`segmented__opt ${type === item.id ? "is-active" : ""}`} onClick={() => setType(item.id)}>{item.label}</button>)}
        </div>
        <div className="segmented">
          <button className={`segmented__opt ${tab === "browse" ? "is-active" : ""}`} onClick={() => setTab("browse")}>Browse</button>
          <button className={`segmented__opt ${tab === "installed" ? "is-active" : ""}`} onClick={() => setTab("installed")}>Installed</button>
        </div>
      </div>

      {!canBrowse ? <div className="empty glass"><PackageOpen size={28}/><p>Create an instance before browsing content.</p></div> : tab === "browse" ? (
        <>
          <div className="searchbar glass"><Search size={18}/><input className="input" value={query} placeholder={`Search ${type}s for ${loader} ${instance.versionId}`} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) void search() }}/><button className="btn btn-accent" onClick={search}>Search</button></div>
          {loading ? <div className="grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card glass skeleton-card" />)}</div> : <div className="grid">{cards.map((project) => (
            <motion.article key={`${project.provider}-${project.id}`} className="card glass" whileHover={{ y: -3 }}>
              <div className="card__top">{project.iconUrl ? <img className="content-icon" src={project.iconUrl} alt=""/> : <span className="card__icon"/>}<div className="card__heading"><h3>{project.title}</h3><span className="badge badge-muted">{project.provider}</span></div></div>
              <p className="card__meta">{project.description}</p><p className="card__sub">By {project.author} · {project.downloads.toLocaleString()} downloads</p>
              <button className="btn btn-accent" disabled={busy === project.id} onClick={() => install(project)}>{busy === project.id ? <Loader2 className="spin" size={16}/> : <Download size={16}/>} Install</button>
            </motion.article>
          ))}</div>}
        </>
      ) : <div className="server-list">{installed.length === 0 ? <div className="empty glass"><p>No installed content in this category.</p></div> : installed.map((item) => (
        <div className="server glass" key={item.id}><PackageOpen size={22}/><div className="server__info"><h3>{item.title}</h3><p className="server__addr">{item.versionName} · {item.provider}</p></div><button className="btn btn-icon" aria-label={item.enabled ? "Disable" : "Enable"} onClick={async () => { await window.ordolith.content.toggle(instance.id, type, item.fileName, !item.enabled); await loadInstalled() }}>{item.enabled ? <ToggleRight size={20}/> : <ToggleLeft size={20}/>}</button><button className="btn btn-icon" aria-label="Remove" onClick={async () => { await window.ordolith.content.remove(instance.id, type, item.fileName); await loadInstalled() }}><Trash2 size={17}/></button></div>
      ))}</div>}
    </div>
  )
}
