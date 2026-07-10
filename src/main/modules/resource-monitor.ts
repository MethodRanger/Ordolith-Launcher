import pidusage from "pidusage"
import type { ResourceSample } from "../../shared/types.js"

type Emit = (sample: ResourceSample) => void

const monitors = new Map<string, NodeJS.Timeout>()

/**
 * Poll CPU/RAM usage for a running instance every couple of seconds and stream
 * samples back to the renderer. Cross-platform sampling is delegated to
 * `pidusage` (reads /proc on Linux, `ps` on macOS, WMIC on Windows).
 */
export function startMonitor(instanceId: string, pid: number, startedAt: number, emit: Emit): void {
  stopMonitor(instanceId)
  const timer = setInterval(async () => {
    try {
      const stat = await pidusage(pid)
      emit({
        instanceId,
        pid,
        cpu: Math.max(0, Math.round(stat.cpu)),
        memoryMb: Math.round(stat.memory / 1_048_576),
        uptimeMs: Date.now() - startedAt,
      })
    } catch {
      // Process gone — stop sampling.
      stopMonitor(instanceId)
    }
  }, 2000)
  monitors.set(instanceId, timer)
}

export function stopMonitor(instanceId: string): void {
  const timer = monitors.get(instanceId)
  if (timer) {
    clearInterval(timer)
    monitors.delete(instanceId)
  }
}
