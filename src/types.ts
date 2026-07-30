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
  words: Word[]
}

/** What speechSynthesis says first during study playback. */
export type PronounceFirst = "word" | "translation"

export interface AppSettings {
  pronounceFirst: PronounceFirst
}
