import { execFile, spawn } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { promisify } from "node:util"
import AdmZip from "adm-zip"
import type { JavaRuntime } from "../../shared/types.js"
import { paths } from "../paths.js"
import { downloadFile } from "./net.js"

const exec = promisify(execFile)

function candidates(): string[] {
  const executable = process.platform === "win32" ? "java.exe" : "java"
  const values = new Set<string>()
  if (process.env.JAVA_HOME) values.add(join(process.env.JAVA_HOME, "bin", executable))
  values.add(executable)
  const roots = process.platform === "win32"
    ? ["C:\\Program Files\\Java", "C:\\Program Files\\Eclipse Adoptium"]
    : process.platform === "darwin"
      ? ["/Library/Java/JavaVirtualMachines"]
      : ["/usr/lib/jvm", join(homedir(), ".jdks")]
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const child of readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
      values.add(join(root, child.name, process.platform === "darwin" ? "Contents/Home/bin" : "bin", executable))
    }
  }
  return [...values]
}

async function inspectJava(path: string): Promise<JavaRuntime | null> {
  try {
    const { stderr, stdout } = await exec(path, ["-version"], { timeout: 5000 })
    const text = `${stderr}\n${stdout}`
    const version = text.match(/version "([^"]+)"/)?.[1] ?? "unknown"
    const majorRaw = version.startsWith("1.") ? version.split(".")[1] : version.split(/[.+_-]/)[0]
    const vendor = /temurin|adoptium/i.test(text) ? "Eclipse Temurin" : /openjdk/i.test(text) ? "OpenJDK" : "Java"
    return { id: path, path, version, major: Number(majorRaw) || 0, vendor, managed: path.startsWith(paths.root), compatible: true }
  } catch { return null }
}

export async function discoverJava(): Promise<JavaRuntime[]> {
  return (await Promise.all(candidates().map(inspectJava))).filter((runtime): runtime is JavaRuntime => Boolean(runtime))
}

export function recommendedJavaMajor(minecraftVersion: string): number {
  const [major, minor, patch = 0] = minecraftVersion.split(".").map(Number)
  if (major === 1 && (minor > 20 || (minor === 20 && patch >= 5))) return 21
  if (major === 1 && minor >= 17) return 17
  return 8
}

export async function downloadRecommendedJava(minecraftVersion: string, onProgress: (fraction: number, detail: string) => void): Promise<JavaRuntime> {
  const major = recommendedJavaMajor(minecraftVersion)
  const os = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "mac" : "linux"
  const arch = process.arch === "arm64" ? "aarch64" : "x64"
  const extension = os === "windows" ? "zip" : "tar.gz"
  const url = `https://api.adoptium.net/v3/binary/latest/${major}/ga/${os}/${arch}/jre/hotspot/normal/eclipse?project=jdk`
  const target = join(paths.root, "java", `temurin-${major}-${os}-${arch}`)
  const archive = join(tmpdir(), `ordolith-temurin-${Date.now()}.${extension}`)
  mkdirSync(dirname(target), { recursive: true })
  onProgress(0.1, `Downloading Temurin ${major}`)
  await downloadFile(url, archive)
  onProgress(0.75, "Extracting Java runtime")
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  if (extension === "zip") new AdmZip(archive).extractAllTo(target, true)
  else await new Promise<void>((resolve, reject) => {
    const child = spawn("tar", ["-xzf", archive, "-C", target, "--strip-components=1"])
    child.on("error", reject)
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`tar exited with ${code}`)))
  })
  rmSync(archive, { force: true })
  const executable = join(target, "bin", process.platform === "win32" ? "java.exe" : "java")
  const nested = existsSync(executable) ? executable : join(target, readdirSync(target)[0] ?? "", "bin", process.platform === "win32" ? "java.exe" : "java")
  const runtime = await inspectJava(nested)
  if (!runtime) throw new Error("Downloaded Java runtime failed validation")
  onProgress(1, `Temurin ${runtime.version} is ready`)
  return { ...runtime, managed: true }
}
