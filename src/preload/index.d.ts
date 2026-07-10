import type { OrdolithApi } from "../shared/ipc"

declare global {
  interface Window {
    ordolith: OrdolithApi
  }
}

export {}
