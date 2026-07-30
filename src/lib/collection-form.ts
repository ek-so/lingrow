import type { LangCode, Word } from "@/types"
import { examplesFromTextarea, examplesTextareaValue, normalizeExamples } from "@/lib/examples"

export interface WordPair {
  /** Existing word id when editing; omitted for brand-new rows. */
  id?: string
  word: string
  translation: string
  examples?: string[]
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
  /** One example sentence per line while editing. */
  examplesText: string
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
    examplesText: "",
  }
}

export function draftFromWords(words: Word[]): DraftWord[] {
  if (words.length === 0) return [emptyDraftWord()]
  return words.map((w) => ({
    key: w.id,
    word: w.word,
    translation: w.translation,
    examplesText: examplesTextareaValue(w.examples),
  }))
}

export function pairsFromDraft(words: DraftWord[]): WordPair[] {
  return words
    .map((w) => ({
      id: w.key,
      word: w.word.trim(),
      translation: w.translation.trim(),
      examples: examplesFromTextarea(w.examplesText),
    }))
    .filter((w) => w.word && w.translation)
}

export function pairFromParts(
  word: string,
  translation: string,
  examples?: string[] | string,
): WordPair | null {
  const w = word.trim()
  const t = translation.trim()
  if (!w || !t) return null
  return {
    word: w,
    translation: t,
    examples: normalizeExamples(examples),
  }
}
