import type { AppSettings, Collection, PronounceFirst } from "@/types"
import { seedCollections } from "@/data/collections"

const COLLECTIONS_KEY = "lingrow.collections.v1"
const SETTINGS_KEY = "lingrow.settings.v1"

const defaultSettings: AppSettings = {
  pronounceFirst: "translation",
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function loadCollections(): Collection[] {
  if (!canUseStorage()) return structuredClone(seedCollections)
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY)
    if (!raw) {
      const seed = structuredClone(seedCollections)
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(seed))
      return seed
    }
    const parsed = JSON.parse(raw) as Collection[]
    if (!Array.isArray(parsed)) return structuredClone(seedCollections)
    return parsed
  } catch {
    return structuredClone(seedCollections)
  }
}

export function saveCollections(collections: Collection[]) {
  if (!canUseStorage()) return
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections))
}

export function loadSettings(): AppSettings {
  if (!canUseStorage()) return { ...defaultSettings }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...defaultSettings }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    const pronounceFirst: PronounceFirst =
      parsed.pronounceFirst === "translation" ? "translation" : "word"
    return { pronounceFirst }
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(settings: AppSettings) {
  if (!canUseStorage()) return
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function newId(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
