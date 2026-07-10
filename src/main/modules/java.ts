import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { platform } from "node:os"

const JAVA_BIN = platform() === "win32" ? "java.exe" : "java"

function tryJava(bin: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(bin, ["-version"], (err) => {
      resolve(err ? null : bin)
    })
  })
}

/**
 * Resolve a usable Java executable. Preference order:
 *   1. An explicit path configured on the instance.
 *   2. $JAVA_HOME/bin/java.
 *   3. `java` on the system PATH.
 * Returns null when no working Java is found (the UI then prompts to install one).
 */
export async function detectJava(preferredPath?: string): Promise<string | null> {
  if (preferredPath && existsSync(preferredPath)) {
    const ok = await tryJava(preferredPath)
    if (ok) return ok
  }

  const javaHome = process.env.JAVA_HOME
  if (javaHome) {
    const candidate = join(javaHome, "bin", JAVA_BIN)
    if (existsSync(candidate)) {
      const ok = await tryJava(candidate)
      if (ok) return ok
    }
  }

  return tryJava(JAVA_BIN)
}
