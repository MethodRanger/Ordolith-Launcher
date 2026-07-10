import { create } from "zustand"
import type { AppLocale } from "@shared/ipc"
import { en } from "./en"
import { ru } from "./ru"
import { es } from "./es"
import { zh } from "./zh"

const DICTS = { en, ru, es, zh } as const

export const LOCALES: { id: AppLocale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ru", label: "Русский" },
  { id: "es", label: "Español" },
  { id: "zh", label: "中文" },
]

/** Resolve a dotted key path ("mods.byAuthor") against a dictionary. */
function resolve(dict: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part]
    return undefined
  }, dict)
}

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`))
}

interface I18nState {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: "en",
  setLocale: (locale) => {
    set({ locale })
    // Persist to the backend settings so it survives restarts.
    window.ordolith.app.getSettings().then((s) => window.ordolith.app.saveSettings({ ...s, locale }))
  },
}))

export type TranslateFn = {
  (path: string, vars?: Record<string, string | number>): string
  list: (path: string) => string[]
}

/** React hook exposing the active locale and a translate function. */
export function useI18n(): { locale: AppLocale; setLocale: (l: AppLocale) => void; t: TranslateFn } {
  const locale = useI18nStore((s) => s.locale)
  const setLocale = useI18nStore((s) => s.setLocale)

  const t = ((path: string, vars?: Record<string, string | number>): string => {
    const value = resolve(DICTS[locale], path) ?? resolve(en, path)
    if (typeof value !== "string") return path
    return interpolate(value, vars)
  }) as TranslateFn

  t.list = (path: string): string[] => {
    const value = resolve(DICTS[locale], path) ?? resolve(en, path)
    return Array.isArray(value) ? (value as string[]) : []
  }

  return { locale, setLocale, t }
}
