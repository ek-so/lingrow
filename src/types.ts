export type LangCode = "de" | "en" | "ru"

export interface Word {
  id: string
  word: string
  translation: string
  /** Short usage sentences in the word language (shown on the word side). */
  examples?: string[]
}

export type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2"

export interface Collection {
  id: string
  name: string
  description: string
  /** Language of the “word” side of each card. */
  wordLang: LangCode
  /** Language of the “translation” side (may match wordLang for same-language drills). */
  translationLang: LangCode
  level?: Level
  theme?: string
  /** Folder containing this set; null/undefined means Home (root). */
  folderId?: string | null
  words: Word[]
  /** ISO timestamp when the set was created. */
  createdAt: string
  /** ISO timestamp when the set was last edited (content or placement). */
  updatedAt: string
}

/** Nested folder for organizing sets. `parentId` null means Home (root). */
export interface Folder {
  id: string
  name: string
  parentId: string | null
  /** ISO timestamp when the folder was created. */
  createdAt: string
  /** ISO timestamp when the folder was last edited (name or placement). */
  updatedAt: string
}

/** Local + cloud library bundle (sets and folders). */
export interface Library {
  collections: Collection[]
  folders: Folder[]
}

/** Which side is spoken first during study playback. */
export type PronounceFirst = "word" | "translation"

export interface AppSettings {
  pronounceFirst: PronounceFirst
}
