import type { AppSettings, Collection, Folder, LangCode, Library, PronounceFirst, Word } from "@/types"
import { seedCollections } from "@/data/collections"
import { normalizeExamples } from "@/lib/examples"
import { isLangCode } from "@/lib/languages"

const LIBRARY_KEY = "lingrow.library.v3"
const COLLECTIONS_KEY_V2 = "lingrow.collections.v2"
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
    return {
      id: raw.id,
      word: raw.word,
      translation: raw.translation,
      examples: normalizeExamples(raw.examples),
    }
  }
  // v1 shape: { id, de, en }
  if (typeof raw.id === "string" && typeof raw.de === "string" && typeof raw.en === "string") {
    return {
      id: raw.id,
      word: raw.de,
      translation: raw.en,
      examples: normalizeExamples(raw.examples),
    }
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

  const folderId =
    typeof c.folderId === "string" && c.folderId.length > 0 ? c.folderId : null

  return {
    id: c.id,
    name: c.name,
    description: typeof c.description === "string" ? c.description : "",
    wordLang,
    translationLang,
    level: c.level as Collection["level"],
    theme: typeof c.theme === "string" ? c.theme : undefined,
    folderId,
    words,
  }
}

function migrateFolder(raw: unknown): Folder | null {
  if (!raw || typeof raw !== "object") return null
  const f = raw as Record<string, unknown>
  if (typeof f.id !== "string" || typeof f.name !== "string") return null
  const parentId =
    typeof f.parentId === "string" && f.parentId.length > 0 ? f.parentId : null
  return { id: f.id, name: f.name, parentId }
}

function migrateCollectionsList(raw: unknown): Collection[] {
  if (!Array.isArray(raw)) return structuredClone(seedCollections)
  const migrated = raw.map(migrateCollection).filter((c): c is Collection => c != null)
  return migrated.length > 0 ? migrated : structuredClone(seedCollections)
}

function migrateFoldersList(raw: unknown): Folder[] {
  if (!Array.isArray(raw)) return []
  return raw.map(migrateFolder).filter((f): f is Folder => f != null)
}

function sanitizeLibrary(library: Library): Library {
  const folderIds = new Set(library.folders.map((f) => f.id))
  const folders = library.folders.map((f) => ({
    ...f,
    parentId: f.parentId && folderIds.has(f.parentId) ? f.parentId : null,
  }))
  const validFolderIds = new Set(folders.map((f) => f.id))
  const collections = library.collections.map((c) => ({
    ...c,
    folderId: c.folderId && validFolderIds.has(c.folderId) ? c.folderId : null,
  }))
  return { collections, folders }
}

function emptySeedLibrary(): Library {
  return {
    collections: structuredClone(seedCollections).map((c) => ({ ...c, folderId: null })),
    folders: [],
  }
}

function parseLibraryJson(raw: string): Library | null {
  const parsed = JSON.parse(raw) as unknown
  if (Array.isArray(parsed)) {
    return sanitizeLibrary({
      collections: migrateCollectionsList(parsed),
      folders: [],
    })
  }
  if (!parsed || typeof parsed !== "object") return null
  const obj = parsed as Record<string, unknown>
  return sanitizeLibrary({
    collections: migrateCollectionsList(obj.collections),
    folders: migrateFoldersList(obj.folders),
  })
}

function libraryKeyForUser(userId?: string | null) {
  return userId ? `${LIBRARY_KEY}.${userId}` : LIBRARY_KEY
}

function readLegacyCollections(): Library | null {
  const rawV2 = localStorage.getItem(COLLECTIONS_KEY_V2)
  if (rawV2) {
    return sanitizeLibrary({
      collections: migrateCollectionsList(JSON.parse(rawV2)),
      folders: [],
    })
  }
  const rawV1 = localStorage.getItem(COLLECTIONS_KEY_V1)
  if (rawV1) {
    return sanitizeLibrary({
      collections: migrateCollectionsList(JSON.parse(rawV1)),
      folders: [],
    })
  }
  return null
}

/** Load library for a signed-in user (or the anonymous local profile). */
export function loadLibrary(userId?: string | null): Library {
  if (!canUseStorage()) return emptySeedLibrary()
  try {
    const keyed = localStorage.getItem(libraryKeyForUser(userId))
    if (keyed) {
      const library = parseLibraryJson(keyed)
      if (library) {
        saveLibrary(library, userId)
        return library
      }
    }

    // Fall back to anonymous library when a user first signs in.
    if (userId) {
      const anon = localStorage.getItem(LIBRARY_KEY)
      if (anon) {
        const library = parseLibraryJson(anon)
        if (library) {
          saveLibrary(library, userId)
          return library
        }
      }
    }

    const legacy = readLegacyCollections()
    if (legacy) {
      saveLibrary(legacy, userId)
      return legacy
    }

    const seed = emptySeedLibrary()
    saveLibrary(seed, userId)
    return seed
  } catch {
    return emptySeedLibrary()
  }
}

export function saveLibrary(library: Library, userId?: string | null) {
  if (!canUseStorage()) return
  const clean = sanitizeLibrary(library)
  localStorage.setItem(libraryKeyForUser(userId), JSON.stringify(clean))
}

/** @deprecated Prefer loadLibrary — kept for any external callers. */
export function loadCollections(): Collection[] {
  return loadLibrary().collections
}

/** @deprecated Prefer saveLibrary — kept for any external callers. */
export function saveCollections(collections: Collection[]) {
  const existing = canUseStorage() ? loadLibrary() : emptySeedLibrary()
  saveLibrary({ ...existing, collections })
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

/** Load settings for a signed-in user (or the anonymous local profile). */
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
