import { arch, platform } from "node:os"
import type { Library, Rule } from "./mojang-types.js"

/** Mojang's OS name for the current platform. */
export function currentOsName(): "windows" | "osx" | "linux" {
  switch (platform()) {
    case "win32":
      return "windows"
    case "darwin":
      return "osx"
    default:
      return "linux"
  }
}

/** Mojang's arch token, e.g. "x64" / "x86" / "arm64". */
export function currentArch(): string {
  const a = arch()
  if (a === "ia32") return "x86"
  return a // x64, arm64, ...
}

/**
 * Evaluate a Mojang rule list against the current OS. Feature-gated rules
 * (e.g. demo mode, custom resolution) default to disabled.
 */
export function rulesAllow(rules: Rule[] | undefined, features: Record<string, boolean> = {}): boolean {
  if (!rules || rules.length === 0) return true

  let allowed = false
  for (const rule of rules) {
    let matches = true

    if (rule.os) {
      if (rule.os.name && rule.os.name !== currentOsName()) matches = false
      if (rule.os.arch && rule.os.arch !== currentArch()) matches = false
    }

    if (rule.features) {
      for (const [key, want] of Object.entries(rule.features)) {
        if (Boolean(features[key]) !== want) matches = false
      }
    }

    if (matches) allowed = rule.action === "allow"
  }

  return allowed
}

/** Whether a library should be included on this platform. */
export function libraryApplies(lib: Library): boolean {
  return rulesAllow(lib.rules)
}

/** The natives classifier key for the current platform, if any. */
export function nativesClassifier(lib: Library): string | undefined {
  if (!lib.natives) return undefined
  const key = lib.natives[currentOsName()]
  if (!key) return undefined
  return key.replace("${arch}", currentArch() === "x86" ? "32" : "64")
}
