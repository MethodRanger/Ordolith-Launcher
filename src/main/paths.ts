import { join } from "node:path"
import { mkdirSync } from "node:fs"
import { app } from "electron"

/**
 * Centralised, lazily-created directory layout for all launcher data.
 *
 * Shared assets (version jars, libraries, asset objects) live at the root so
 * they are downloaded once and reused, while each instance keeps its own
 * isolated `.minecraft` game directory.
 */
class LauncherPaths {
  /** Root data directory, e.g. ~/.config/Ordolith/data on Linux. */
  get root(): string {
    return join(app.getPath("userData"), "data")
  }

  get versions(): string {
    return join(this.root, "versions")
  }

  get libraries(): string {
    return join(this.root, "libraries")
  }

  get assets(): string {
    return join(this.root, "assets")
  }

  get assetObjects(): string {
    return join(this.assets, "objects")
  }

  get assetIndexes(): string {
    return join(this.assets, "indexes")
  }

  get instances(): string {
    return join(this.root, "instances")
  }

  get configFile(): string {
    return join(this.root, "config.json")
  }

  /** Directory for a specific version's files. */
  versionDir(versionId: string): string {
    return join(this.versions, versionId)
  }

  versionJar(versionId: string): string {
    return join(this.versionDir(versionId), `${versionId}.jar`)
  }

  versionJson(versionId: string): string {
    return join(this.versionDir(versionId), `${versionId}.json`)
  }

  /** Root of a single isolated instance. */
  instanceDir(dirName: string): string {
    return join(this.instances, dirName)
  }

  /** The `.minecraft` game directory for an instance. */
  gameDir(dirName: string): string {
    return join(this.instanceDir(dirName), ".minecraft")
  }

  /** Where per-launch extracted native libraries go. */
  nativesDir(dirName: string, versionId: string): string {
    return join(this.instanceDir(dirName), "natives", versionId)
  }

  /** Ensure the base directory tree exists. Safe to call repeatedly. */
  ensureBase(): void {
    for (const dir of [
      this.root,
      this.versions,
      this.libraries,
      this.assetObjects,
      this.assetIndexes,
      this.instances,
    ]) {
      mkdirSync(dir, { recursive: true })
    }
  }
}

export const paths = new LauncherPaths()
