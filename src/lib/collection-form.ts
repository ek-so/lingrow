import type { LangCode, Word } from "@/types"

export interface WordPair {
  word: string
  translation: string
}

export interface CollectionInput {
  name: string
  description?: string
  wordLang: LangCode
  translationLang: LangCode
  words: WordPair[]
}

export type DraftWord = {
  key: string
  word: string
  translation: string
}

export interface CollectionFormValues {
  name: string
  description: string
  wordLang: LangCode
  translationLang: LangCode
  words: DraftWord[]
}

export function emptyDraftWord(): DraftWord {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    word: "",
    translation: "",
  }
}

export function draftFromWords(words: Word[]): DraftWord[] {
  if (words.length === 0) return [emptyDraftWord()]
  return words.map((w) => ({
    key: w.id,
    word: w.word,
    translation: w.translation,
  }))
}

export function pairsFromDraft(words: DraftWord[]): WordPair[] {
  return words
    .map((w) => ({ word: w.word.trim(), translation: w.translation.trim() }))
    .filter((w) => w.word && w.translation)
}
