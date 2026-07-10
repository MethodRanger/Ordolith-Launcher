import { Socket } from "node:net"
import { randomUUID } from "node:crypto"
import { store } from "../store.js"
import type { SavedServer, ServerStatus } from "../../shared/types.js"

/* ---- VarInt helpers (Minecraft protocol) ------------------------- */

function writeVarInt(value: number): Buffer {
  const bytes: number[] = []
  let v = value >>> 0
  do {
    let temp = v & 0b01111111
    v >>>= 7
    if (v !== 0) temp |= 0b10000000
    bytes.push(temp)
  } while (v !== 0)
  return Buffer.from(bytes)
}

function writeString(str: string): Buffer {
  const body = Buffer.from(str, "utf8")
  return Buffer.concat([writeVarInt(body.length), body])
}

/** Incrementally reads VarInts / strings out of a growing buffer. */
class Reader {
  private offset = 0
  constructor(private buf: Buffer) {}

  readVarInt(): number {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = this.buf[this.offset++]
      result |= (byte & 0x7f) << shift
      shift += 7
    } while (byte & 0x80)
    return result
  }

  readString(): string {
    const len = this.readVarInt()
    const str = this.buf.toString("utf8", this.offset, this.offset + len)
    this.offset += len
    return str
  }
}

interface RawStatus {
  version?: { name?: string }
  players?: { online?: number; max?: number }
  description?: unknown
}

/** Flatten Minecraft's chat-component MOTD into plain text. */
function flattenMotd(desc: unknown): string {
  if (typeof desc === "string") return desc
  if (!desc || typeof desc !== "object") return ""
  const node = desc as { text?: string; extra?: unknown[] }
  let out = node.text ?? ""
  if (Array.isArray(node.extra)) {
    for (const child of node.extra) out += flattenMotd(child)
  }
  return out.replace(/\u00a7./g, "").trim()
}

/**
 * Ping a server using the modern (1.7+) Server List Ping protocol and return
 * its MOTD, player counts, version and round-trip latency.
 */
export function pingServer(host: string, port = 25565, timeoutMs = 4000): Promise<ServerStatus> {
  return new Promise((resolve) => {
    const socket = new Socket()
    const chunks: Buffer[] = []
    const started = Date.now()
    let done = false

    const settle = (status: ServerStatus): void => {
      if (done) return
      done = true
      socket.destroy()
      resolve(status)
    }

    socket.setTimeout(timeoutMs)
    socket.on("timeout", () => settle({ online: false, error: "Timed out" }))
    socket.on("error", (err) => settle({ online: false, error: err.message }))

    socket.connect(port, host, () => {
      const handshake = Buffer.concat([
        writeVarInt(0x00),
        writeVarInt(47), // protocol version (any value works for a status ping)
        writeString(host),
        Buffer.from([(port >> 8) & 0xff, port & 0xff]),
        writeVarInt(1),
      ])
      socket.write(Buffer.concat([writeVarInt(handshake.length), handshake]))

      const request = writeVarInt(0x00)
      socket.write(Buffer.concat([writeVarInt(request.length), request]))
    })

    socket.on("data", (chunk) => {
      chunks.push(chunk)
      const buf = Buffer.concat(chunks)
      try {
        const reader = new Reader(buf)
        reader.readVarInt() // packet length
        reader.readVarInt() // packet id (0x00)
        const json = reader.readString()
        const parsed = JSON.parse(json) as RawStatus
        settle({
          online: true,
          motd: flattenMotd(parsed.description),
          playersOnline: parsed.players?.online ?? 0,
          playersMax: parsed.players?.max ?? 0,
          version: parsed.version?.name ?? "unknown",
          latencyMs: Date.now() - started,
        })
      } catch {
        // Response not fully received yet — wait for more data.
      }
    })
  })
}

/* ---- Saved server CRUD ------------------------------------------- */

export function listServers(): SavedServer[] {
  return store.getServers()
}

export function addServer(input: Omit<SavedServer, "id">): SavedServer {
  const server: SavedServer = { ...input, id: randomUUID() }
  store.saveServers([...store.getServers(), server])
  return server
}

export function removeServer(id: string): void {
  store.saveServers(store.getServers().filter((s) => s.id !== id))
}
