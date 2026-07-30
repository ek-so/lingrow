import type { AppSettings, Collection, LangCode, PronounceFirst, Word } from "@/types"
import { seedCollections } from "@/data/collections"
import { isLangCode } from "@/lib/languages"

const COLLECTIONS_KEY = "lingrow.collections.v2"
const COLLECTIONS_KEY_V1 = "lingrow.collections.v1"
const SETTINGS_KEY = "lingrow.settings.v1"

const defaultSettings: AppSettings = {
  pronounceFirst: "translation",
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function migrateWord(raw: Record<string, unknown>): Word | null {
  if (typeof raw.id === "string" && typeof raw.word === "string" && typeof raw.translation === "string") {
    return { id: raw.id, word: raw.word, translation: raw.translation }
  }
  // v1 shape: { id, de, en }
  if (typeof raw.id === "string" && typeof raw.de === "string" && typeof raw.en === "string") {
    return { id: raw.id, word: raw.de, translation: raw.en }
  }
  return null
}

function migrateCollection(raw: unknown): Collection | null {
  if (!raw || typeof raw !== "object") return null
  const c = raw as Record<string, unknown>
  if (typeof c.id !== "string" || typeof c.name !== "string" || !Array.isArray(c.words)) return null

  const words = c.words
    .map((w) => (w && typeof w === "object" ? migrateWord(w as Record<string, unknown>) : null))
    .filter((w): w is Word => w != null)

  let wordLang: LangCode = "de"
  let translationLang: LangCode = "en"
  if (isLangCode(c.wordLang) && isLangCode(c.translationLang)) {
    wordLang = c.wordLang
    translationLang = c.translationLang
  }

  return {
    id: c.id,
    name: c.name,
    description: typeof c.description === "string" ? c.description : "",
    wordLang,
    translationLang,
    level: c.level as Collection["level"],
    theme: typeof c.theme === "string" ? c.theme : undefined,
    words,
  }
}

function migrateList(raw: unknown): Collection[] {
  if (!Array.isArray(raw)) return structuredClone(seedCollections)
  const migrated = raw.map(migrateCollection).filter((c): c is Collection => c != null)
  return migrated.length > 0 ? migrated : structuredClone(seedCollections)
}

export function loadCollections(): Collection[] {
  if (!canUseStorage()) return structuredClone(seedCollections)
  try {
    const rawV2 = localStorage.getItem(COLLECTIONS_KEY)
    if (rawV2) {
      const collections = migrateList(JSON.parse(rawV2))
      saveCollections(collections)
      return collections
    }

    const rawV1 = localStorage.getItem(COLLECTIONS_KEY_V1)
    if (rawV1) {
      const collections = migrateList(JSON.parse(rawV1))
      saveCollections(collections)
      return collections
    }

    const seed = structuredClone(seedCollections)
    saveCollections(seed)
    return seed
  } catch {
    return structuredClone(seedCollections)
  }
}

export function saveCollections(collections: Collection[]) {
  if (!canUseStorage()) return
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections))
}

function settingsKeyForUser(userId?: string | null) {
  return userId ? `${SETTINGS_KEY}.${userId}` : SETTINGS_KEY
}

function parseSettings(raw: string | null): AppSettings {
  if (!raw) return { ...defaultSettings }
  const parsed = JSON.parse(raw) as Partial<AppSettings>
  const pronounceFirst: PronounceFirst =
    parsed.pronounceFirst === "word" ? "word" : "translation"
  return { pronounceFirst }
}

/** Load settings for a Google user (or the anonymous local profile). */
export function loadSettings(userId?: string | null): AppSettings {
  if (!canUseStorage()) return { ...defaultSettings }
  try {
    const keyed = localStorage.getItem(settingsKeyForUser(userId))
    if (keyed) return parseSettings(keyed)
    // Fall back to anonymous settings when a user first signs in.
    if (userId) {
      const anon = localStorage.getItem(SETTINGS_KEY)
      if (anon) return parseSettings(anon)
    }
    return { ...defaultSettings }
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(settings: AppSettings, userId?: string | null) {
  if (!canUseStorage()) return
  localStorage.setItem(settingsKeyForUser(userId), JSON.stringify(settings))
}

export function newId(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
