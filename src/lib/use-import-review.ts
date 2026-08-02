import { useState } from "react"
import { useNavigate } from "react-router-dom"
import type { DuplicateImportChoice } from "@/components/DuplicateImportSheet"
import {
  classifyImport,
  clearImportStaging,
  saveImportResult,
  type ImportDraft,
} from "@/lib/import-bridge"
import type { WordPair } from "@/lib/collection-form"
import type { LangCode } from "@/types"

interface UseImportReviewOptions {
  draft: ImportDraft
  detectedWordLang: LangCode | null
  detectedTranslationLang: LangCode | null
  /** Clear file-import staging when leaving or committing. */
  clearStagingOnLeave?: boolean
}

export function importBackLabel(returnTo: string): string {
  if (returnTo.startsWith("/edit")) return "Edit set"
  if (returnTo.startsWith("/new")) return "New set"
  return "Back"
}

/** Shared commit / duplicate / leave flow for import screens. */
export function useImportReview({
  draft,
  detectedWordLang,
  detectedTranslationLang,
  clearStagingOnLeave = false,
}: UseImportReviewOptions) {
  const navigate = useNavigate()
  const { values, returnTo } = draft
  const [duplicateChoice, setDuplicateChoice] = useState<DuplicateImportChoice>("skip")
  const [pendingDuplicates, setPendingDuplicates] = useState<{
    pairs: WordPair[]
    duplicates: WordPair[]
    fresh: WordPair[]
  } | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const wordLang = detectedWordLang ?? values.wordLang
  const translationLang = detectedTranslationLang ?? values.translationLang
  const langsChanged =
    (detectedWordLang != null && detectedWordLang !== values.wordLang) ||
    (detectedTranslationLang != null && detectedTranslationLang !== values.translationLang)

  function leaveClean() {
    if (clearStagingOnLeave) clearImportStaging()
    navigate(returnTo)
  }

  function commitPairs(nextPairs: WordPair[], choice: DuplicateImportChoice | null) {
    saveImportResult({
      pairs: nextPairs,
      choice,
      wordLang: detectedWordLang ?? undefined,
      translationLang: detectedTranslationLang ?? undefined,
    })
    if (clearStagingOnLeave) clearImportStaging()
    navigate(returnTo)
  }

  function tryCommit(nextPairs: WordPair[]) {
    const { duplicates, fresh, normalized } = classifyImport(values.words, nextPairs)
    if (duplicates.length === 0) {
      commitPairs(normalized, null)
      return
    }
    setPendingDuplicates({ pairs: normalized, duplicates, fresh })
    setDuplicateChoice("skip")
  }

  function requestBack(hasUnsaved: boolean) {
    if (!hasUnsaved) {
      leaveClean()
      return
    }
    setLeaveOpen(true)
  }

  return {
    returnTo,
    wordLang,
    translationLang,
    langsChanged,
    duplicateChoice,
    setDuplicateChoice,
    pendingDuplicates,
    setPendingDuplicates,
    leaveOpen,
    setLeaveOpen,
    commitPairs,
    tryCommit,
    requestBack,
    leaveClean,
  }
}
