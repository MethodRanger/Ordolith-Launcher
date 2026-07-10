import { store } from "../store.js"
import type { ContentProject, ContentType, FavoriteContent } from "../../shared/types.js"

/** All saved/favourited projects, newest first. */
export function listFavorites(): FavoriteContent[] {
  return store.getFavorites()
}

/**
 * Toggle a project's favourite state. Returns the updated list so the renderer
 * can update without a second round-trip.
 */
export function toggleFavorite(project: ContentProject, type: ContentType): FavoriteContent[] {
  const current = store.getFavorites()
  const key = `${project.provider}:${project.id}`
  const exists = current.some((f) => f.id === key)
  const next = exists
    ? current.filter((f) => f.id !== key)
    : [
        {
          id: key,
          provider: project.provider,
          slug: project.slug,
          title: project.title,
          iconUrl: project.iconUrl,
          author: project.author,
          type,
          addedAt: Date.now(),
        },
        ...current,
      ]
  store.saveFavorites(next)
  return next
}
