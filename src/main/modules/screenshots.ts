import { existsSync, readdirSync, rmSync, statSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { shell } from "electron"
import { paths } from "../paths.js"
import { mediaUrl } from "../media.js"
import { getInstance } from "./instances.js"
import type { Instance, Screenshot } from "../../shared/types.js"

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i

function screenshotsDir(instance: Instance): string {
  const game = instance.settings.gameDirectory || instance.gameDirectory || paths.gameDir(instance.dirName)
  return join(game, "screenshots")
}

/** List an instance's screenshots, newest first, as renderer-safe media URLs. */
export function listScreenshots(instanceId: string): Screenshot[] {
  const instance = getInstance(instanceId)
  if (!instance) return []
  const dir = screenshotsDir(instance)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => IMAGE_EXT.test(name))
    .flatMap((name) => {
      try {
        const path = join(dir, name)
        const st = statSync(path)
        return [{ instanceId, name, path, url: mediaUrl(path), size: st.size, takenAt: st.mtimeMs }]
      } catch {
        return []
      }
    })
    .sort((a, b) => b.takenAt - a.takenAt)
}

export function revealScreenshot(path: string): void {
  const resolved = resolve(path)
  if (resolved.startsWith(resolve(paths.root))) shell.showItemInFolder(resolved)
}

export function removeScreenshot(instanceId: string, name: string): void {
  const instance = getInstance(instanceId)
  if (!instance) return
  rmSync(join(screenshotsDir(instance), basename(name)), { force: true })
}
