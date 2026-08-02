import type { LangCode, Word } from "@/types"
import { examplesFromTextarea, examplesTextareaValue, normalizeExamples } from "@/lib/examples"

export interface WordPair {
  /** Existing word id when editing; omitted for brand-new rows. */
  id?: string
  word: string
  translation: string
  examples?: string[]
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

/** True when the user typed something on the set form (langs alone don’t count). */
export function hasEnteredProgress(values: {
  name: string
  description: string
  words: Array<{ word: string; translation: string; examplesText: string }>
}): boolean {
  if (values.name.trim() || values.description.trim()) return true
  return values.words.some(
    (w) => w.word.trim() || w.translation.trim() || w.examplesText.trim(),
  )
}

function normalizeWordsForCompare(
  words: Array<{ word: string; translation: string; examplesText: string }>,
) {
  return words
    .map((w) => ({
      word: w.word.trim(),
      translation: w.translation.trim(),
      examplesText: w.examplesText.trim(),
    }))
    .filter((w) => w.word || w.translation || w.examplesText)
}

/** True when the form differs from a baseline (new-set empty baseline or loaded edit). */
export function isFormDirty(
  current: {
    name: string
    description: string
    wordLang: LangCode
    translationLang: LangCode
    words: Array<{ word: string; translation: string; examplesText: string }>
  },
  baseline: {
    name: string
    description: string
    wordLang: LangCode
    translationLang: LangCode
    words: Array<{ word: string; translation: string; examplesText: string }>
  },
): boolean {
  if (current.name.trim() !== baseline.name.trim()) return true
  if (current.description.trim() !== baseline.description.trim()) return true
  if (current.wordLang !== baseline.wordLang) return true
  if (current.translationLang !== baseline.translationLang) return true
  return (
    JSON.stringify(normalizeWordsForCompare(current.words)) !==
    JSON.stringify(normalizeWordsForCompare(baseline.words))
  )
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
