import { store } from "../store.js"
import type { PlaySession } from "../../shared/types.js"

/** All recorded play sessions, newest first. */
export function listSessions(): PlaySession[] {
  return store.getSessions()
}

/** Persist a finished play session. */
export function recordSession(session: PlaySession): void {
  store.addSession(session)
}

/** Wipe the play-session history. */
export function clearSessions(): void {
  store.clearSessions()
}
