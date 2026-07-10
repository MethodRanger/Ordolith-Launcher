import { createWriteStream, existsSync, mkdirSync, statSync, createReadStream } from "node:fs"
import { dirname } from "node:path"
import { createHash } from "node:crypto"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"

/** Fetch and parse JSON with a clear error on failure. */
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${url}`)
  }
  return (await res.json()) as T
}

/** Compute a file's SHA-1 hex digest. */
export function sha1File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha1")
    const stream = createReadStream(path)
    stream.on("error", reject)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("end", () => resolve(hash.digest("hex")))
  })
}

/**
 * Download a file to `dest`. If the file already exists and its SHA-1 matches
 * the expected digest (when provided), the download is skipped — this is what
 * makes re-launching an installed version essentially free.
 *
 * Returns the number of bytes downloaded (0 when served from cache).
 */
export async function downloadFile(
  url: string,
  dest: string,
  opts: { sha1?: string; size?: number } = {},
): Promise<number> {
  if (existsSync(dest)) {
    if (opts.sha1) {
      const actual = await sha1File(dest)
      if (actual === opts.sha1) return 0
    } else if (typeof opts.size === "number") {
      if (statSync(dest).size === opts.size) return 0
    } else {
      return 0
    }
  }

  mkdirSync(dirname(dest), { recursive: true })

  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status}) for ${url}`)
  }

  const nodeStream = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
  await pipeline(nodeStream, createWriteStream(dest))

  if (opts.sha1) {
    const actual = await sha1File(dest)
    if (actual !== opts.sha1) {
      throw new Error(`Checksum mismatch for ${dest} (expected ${opts.sha1}, got ${actual})`)
    }
  }

  return typeof opts.size === "number" ? opts.size : statSync(dest).size
}

/** Run async tasks with a bounded concurrency pool. */
export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index], index)
    }
  })
  await Promise.all(runners)
}
