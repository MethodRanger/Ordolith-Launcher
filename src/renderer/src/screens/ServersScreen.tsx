import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Plus, RefreshCw, Signal, Trash2, Users } from "lucide-react"
import type { ServerStatus } from "@shared/ipc"
import { useStore } from "../store/useStore"

export function ServersScreen(): React.JSX.Element {
  const servers = useStore((s) => s.servers)
  const refreshServers = useStore((s) => s.refreshServers)
  const [statuses, setStatuses] = useState<Record<string, ServerStatus | "loading">>({})
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")

  async function ping(id: string, host: string, port: number): Promise<void> {
    setStatuses((s) => ({ ...s, [id]: "loading" }))
    const status = await window.ordolith.servers.ping(host, port)
    setStatuses((s) => ({ ...s, [id]: status }))
  }

  function pingAll(): void {
    for (const srv of servers) ping(srv.id, srv.host, srv.port)
  }

  useEffect(() => {
    pingAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers.length])

  async function add(): Promise<void> {
    const trimmedName = name.trim()
    const trimmedAddr = address.trim()
    if (!trimmedName || !trimmedAddr) return
    const [host, portStr] = trimmedAddr.split(":")
    const port = portStr ? Number.parseInt(portStr, 10) : 25565
    await window.ordolith.servers.add({ name: trimmedName, host, port })
    setName("")
    setAddress("")
    setAdding(false)
    await refreshServers()
  }

  async function remove(id: string): Promise<void> {
    await window.ordolith.servers.remove(id)
    await refreshServers()
  }

  return (
    <div className="content">
      <div className="page-head page-head--row">
        <div>
          <h2>Servers</h2>
          <p>Save your favorite servers and see who is online at a glance.</p>
        </div>
        <div className="page-head__tools">
          <button className="btn btn-icon" aria-label="Refresh all" onClick={pingAll}>
            <RefreshCw size={17} />
          </button>
          <button className="btn btn-accent" onClick={() => setAdding((v) => !v)}>
            <Plus size={18} /> Add server
          </button>
        </div>
      </div>

      {adding && (
        <motion.div
          className="inline-form glass"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
        >
          <input
            className="input"
            placeholder="Server name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder="play.example.com:25565"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) add()
            }}
          />
          <button className="btn btn-accent" onClick={add}>
            Save
          </button>
        </motion.div>
      )}

      <div className="server-list">
        {servers.length === 0 && (
          <div className="empty glass">
            <p>No saved servers yet.</p>
          </div>
        )}
        {servers.map((srv) => {
          const status = statuses[srv.id]
          const online = status && status !== "loading" && status.online
          return (
            <motion.div key={srv.id} layout className="server glass">
              <span
                className={`server__status ${
                  status === "loading" ? "is-loading" : online ? "is-online" : "is-offline"
                }`}
                aria-hidden
              />
              <div className="server__info">
                <h3>{srv.name}</h3>
                <p className="server__addr">
                  {srv.host}
                  {srv.port !== 25565 ? `:${srv.port}` : ""}
                </p>
                {status && status !== "loading" && status.online && status.motd && (
                  <p className="server__motd">{status.motd}</p>
                )}
                {status && status !== "loading" && !status.online && (
                  <p className="server__motd server__motd--off">
                    {status.error ?? "Offline"}
                  </p>
                )}
              </div>
              <div className="server__stats">
                {status === "loading" && <span className="server__stat">Pinging…</span>}
                {status && status !== "loading" && status.online && (
                  <>
                    <span className="server__stat">
                      <Users size={14} /> {status.playersOnline}/{status.playersMax}
                    </span>
                    <span className="server__stat">
                      <Signal size={14} /> {status.latencyMs}ms
                    </span>
                  </>
                )}
              </div>
              <button
                className="btn btn-icon"
                aria-label={`Remove ${srv.name}`}
                onClick={() => remove(srv.id)}
              >
                <Trash2 size={16} />
              </button>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
