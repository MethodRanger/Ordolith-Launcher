/**
 * Minimal typings for the parts of Mojang's piston-meta we consume.
 * Only fields the launcher actually reads are modelled.
 */

export interface RawManifestVersion {
  id: string
  type: "release" | "snapshot" | "old_beta" | "old_alpha"
  url: string
  time: string
  releaseTime: string
}

export interface RawVersionManifest {
  latest: { release: string; snapshot: string }
  versions: RawManifestVersion[]
}

export interface Artifact {
  path?: string
  sha1: string
  size: number
  url: string
}

export interface Library {
  name: string
  downloads?: {
    artifact?: Artifact
    classifiers?: Record<string, Artifact>
  }
  rules?: Rule[]
  natives?: Record<string, string>
  extract?: { exclude?: string[] }
}

export interface Rule {
  action: "allow" | "disallow"
  os?: { name?: string; arch?: string; version?: string }
  features?: Record<string, boolean>
}

export interface AssetIndexRef {
  id: string
  sha1: string
  size: number
  totalSize: number
  url: string
}

export interface AssetIndex {
  objects: Record<string, { hash: string; size: number }>
}

export type ArgValue = string | { rules?: Rule[]; value: string | string[] }

export interface VersionDetail {
  id: string
  mainClass: string
  assetIndex: AssetIndexRef
  assets: string
  downloads: {
    client: Artifact
    server?: Artifact
  }
  libraries: Library[]
  minecraftArguments?: string
  arguments?: {
    game: ArgValue[]
    jvm: ArgValue[]
  }
  javaVersion?: { component: string; majorVersion: number }
}
