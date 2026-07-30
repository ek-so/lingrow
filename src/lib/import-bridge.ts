import type { DuplicateImportChoice } from "@/components/DuplicateImportSheet"
import {
  emptyDraftWord,
  type CollectionFormValues,
  type DraftWord,
  type WordPair,
} from "@/lib/collection-form"
import { normalizeExamples } from "@/lib/examples"

const DRAFT_KEY = "lingrow.import.draft.v1"
const RESULT_KEY = "lingrow.import.result.v1"

export interface ImportDraft {
  returnTo: string
  values: CollectionFormValues
}

export interface ImportResult {
  pairs: WordPair[]
  choice: DuplicateImportChoice | null
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined"
}

export function saveImportDraft(draft: ImportDraft) {
  if (!canUseStorage()) return
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export function loadImportDraft(): ImportDraft | null {
  if (!canUseStorage()) return null
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ImportDraft
  } catch {
    return null
  }
}

export function clearImportDraft() {
  if (!canUseStorage()) return
  sessionStorage.removeItem(DRAFT_KEY)
}

export function saveImportResult(result: ImportResult) {
  if (!canUseStorage()) return
  sessionStorage.setItem(RESULT_KEY, JSON.stringify(result))
}

export function consumeImportResult(): ImportResult | null {
  if (!canUseStorage()) return null
  try {
    const raw = sessionStorage.getItem(RESULT_KEY)
    if (!raw) return null
    sessionStorage.removeItem(RESULT_KEY)
    return JSON.parse(raw) as ImportResult
  } catch {
    sessionStorage.removeItem(RESULT_KEY)
    return null
  }
}

export function wordKey(word: string) {
  return word.trim().toLowerCase()
}

export function normalizePairs(pairs: WordPair[]): WordPair[] {
  const seen = new Set<string>()
  const out: WordPair[] = []
  for (const pair of pairs) {
    const word = pair.word.trim()
    const translation = pair.translation.trim()
    if (!word || !translation) continue
    const key = wordKey(word)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: pair.id,
      word,
      translation,
      examples: normalizeExamples(pair.examples),
    })
  }
  return out
}

export function classifyImport(existing: DraftWord[], pairs: WordPair[]) {
  const filled = existing.filter((w) => w.word.trim())
  const existingKeys = new Set(filled.map((w) => wordKey(w.word)))
  const normalized = normalizePairs(pairs)
  const duplicates: WordPair[] = []
  const fresh: WordPair[] = []
  for (const pair of normalized) {
    if (existingKeys.has(wordKey(pair.word))) duplicates.push(pair)
    else fresh.push(pair)
  }
  return { filled, duplicates, fresh, normalized }
}

export function applyImport(
  existing: DraftWord[],
  pairs: WordPair[],
  choice: DuplicateImportChoice | null,
): DraftWord[] {
  const { filled, duplicates, fresh } = classifyImport(existing, pairs)

  let next = filled.length > 0 ? [...filled] : []

  if (choice === "rewrite" && duplicates.length > 0) {
    const byWord = new Map(duplicates.map((d) => [wordKey(d.word), d]))
    next = next.map((row) => {
      const hit = byWord.get(wordKey(row.word))
      if (!hit) return row
      return {
        ...row,
        translation: hit.translation,
        examplesText: hit.examples?.length ? hit.examples.join("\n") : row.examplesText,
      }
    })
  }

  const stamp = Date.now()
  const additions = fresh.map((pair, i) => ({
    key: `${stamp}-${Math.random().toString(36).slice(2, 7)}-${i}`,
    word: pair.word,
    translation: pair.translation,
    examplesText: pair.examples?.length ? pair.examples.join("\n") : "",
  }))

  next = [...next, ...additions]
  return next.length > 0 ? next : [emptyDraftWord()]
}
