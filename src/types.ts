export interface Word {
  id: string
  de: string
  en: string
}

export type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2"

export interface Collection {
  id: string
  name: string
  description: string
  level?: Level
  theme?: string
  words: Word[]
}

/** What speechSynthesis says first during study playback. */
export type PronounceFirst = "word" | "translation"

export interface AppSettings {
  pronounceFirst: PronounceFirst
}
