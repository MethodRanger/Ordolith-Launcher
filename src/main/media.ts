import { protocol, net } from "electron"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
import { paths } from "./paths.js"

/** Custom scheme name used to serve managed local media into the renderer. */
export const MEDIA_SCHEME = "ordolith-media"

/**
 * Register the media scheme as privileged so the sandboxed renderer can load
 * local screenshots/icons through it without enabling raw file access.
 * Must be called before `app.whenReady()`.
 */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } },
  ])
}

/**
 * Wire up the media protocol handler. Only files that live under the launcher
 * data root are served; anything else returns 403 to prevent path traversal.
 */
export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, (request) => {
    const url = new URL(request.url)
    const target = decodeURIComponent(url.searchParams.get("p") ?? "")
    if (!target) return new Response("Not found", { status: 404 })
    const resolved = resolve(target)
    if (!resolved.startsWith(resolve(paths.root))) {
      return new Response("Forbidden", { status: 403 })
    }
    return net.fetch(pathToFileURL(resolved).toString())
  })
}

/** Build a renderer-safe URL for a managed local file. */
export function mediaUrl(absolutePath: string): string {
  return `${MEDIA_SCHEME}://local/?p=${encodeURIComponent(absolutePath)}`
}
