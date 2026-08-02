import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  DuplicateImportSheet,
  type DuplicateImportChoice,
} from "@/components/DuplicateImportSheet"
import { ConfirmLeaveImportSheet } from "@/components/ConfirmLeaveImportSheet"
import { AppHeader } from "@/components/AppHeader"
import { AppShell } from "@/components/AppShell"
import { PageBody, PageTitle } from "@/components/PageTitle"
import { langLabel } from "@/lib/languages"
import {
  classifyImport,
  clearImportStaging,
  loadImportDraft,
  loadImportStaging,
  saveImportResult,
  saveImportStaging,
} from "@/lib/import-bridge"
import { detectPairLanguages, isSpreadsheetFile, parseSpreadsheetFile } from "@/lib/parse-import"
import type { WordPair } from "@/lib/collection-form"
import type { LangCode } from "@/types"
import { Trash2, Upload } from "lucide-react"

export default function ImportFile() {
  const navigate = useNavigate()
  const draft = loadImportDraft()
  const fileRef = useRef<HTMLInputElement>(null)

  const staged = loadImportStaging()
  const [pairs, setPairs] = useState<WordPair[]>(() => staged?.pairs ?? [])
  const [detectedWordLang, setDetectedWordLang] = useState<LangCode | null>(
    () => staged?.wordLang ?? null,
  )
  const [detectedTranslationLang, setDetectedTranslationLang] = useState<LangCode | null>(
    () => staged?.translationLang ?? null,
  )
  const [fileLabel, setFileLabel] = useState<string | null>(() => staged?.fileLabel ?? null)
  const [error, setError] = useState<string | null>(() => staged?.error ?? null)
  const [busy, setBusy] = useState(false)
  const [duplicateChoice, setDuplicateChoice] = useState<DuplicateImportChoice>("skip")
  const [pendingDuplicates, setPendingDuplicates] = useState<{
    pairs: WordPair[]
    duplicates: WordPair[]
    fresh: WordPair[]
  } | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)

  useEffect(() => {
    // Staging was only needed to cross the navigation boundary.
    clearImportStaging()
  }, [])

  if (!draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="text-center">
          <p className="text-muted-foreground">Nothing to import into.</p>
          <Button className="mt-4" onClick={() => navigate("/new")}>
            Create a list
          </Button>
        </div>
      </div>
    )
  }

  const { values, returnTo } = draft
  const wordLang = detectedWordLang ?? values.wordLang
  const translationLang = detectedTranslationLang ?? values.translationLang
  const hasUnsaved = pairs.length > 0
  const langsChanged =
    (detectedWordLang != null && detectedWordLang !== values.wordLang) ||
    (detectedTranslationLang != null && detectedTranslationLang !== values.translationLang)

  function commitPairs(nextPairs: WordPair[], choice: DuplicateImportChoice | null) {
    saveImportResult({
      pairs: nextPairs,
      choice,
      wordLang: detectedWordLang ?? undefined,
      translationLang: detectedTranslationLang ?? undefined,
    })
    clearImportStaging()
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

  function requestBack() {
    if (!hasUnsaved) {
      clearImportStaging()
      navigate(returnTo)
      return
    }
    setLeaveOpen(true)
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!isSpreadsheetFile(file)) {
      setError("Use an Excel (.xlsx / .xls) or CSV file with two columns.")
      setPairs([])
      setFileLabel(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const parsed = await parseSpreadsheetFile(file)
      const langs = detectPairLanguages(parsed)
      setPairs(parsed)
      setDetectedWordLang(langs.wordLang ?? null)
      setDetectedTranslationLang(langs.translationLang ?? null)
      setFileLabel(file.name)
      saveImportStaging({
        pairs: parsed,
        fileLabel: file.name,
        wordLang: langs.wordLang,
        translationLang: langs.translationLang,
        error:
          parsed.length === 0
            ? "No word pairs found. Expect columns: word, translation, optional examples."
            : null,
      })
      if (parsed.length === 0) {
        setError("No word pairs found. Expect columns: word, translation, optional examples.")
      }
    } catch {
      setError("Could not read that file. Try exporting as .xlsx or .csv.")
      setPairs([])
      setFileLabel(null)
      setDetectedWordLang(null)
      setDetectedTranslationLang(null)
    } finally {
      setBusy(false)
    }
  }

  const backLabel = returnTo.startsWith("/edit")
    ? "Edit set"
    : returnTo.startsWith("/new")
      ? "New set"
      : "Back"

  function clearAll() {
    setPairs([])
    setDetectedWordLang(null)
    setDetectedTranslationLang(null)
    setFileLabel(null)
    setError(null)
    clearImportStaging()
  }

  return (
    <>
      <AppShell
        header={
          <AppHeader
            leading={{ kind: "back", label: backLabel, onBack: requestBack }}
            actions={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Clear import"
                disabled={pairs.length === 0 && !fileLabel}
                onClick={clearAll}
                className="text-destructive hover:bg-transparent hover:text-destructive disabled:text-destructive/40"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            }
          />
        }
      >
        <PageBody>
          <PageTitle description="Spreadsheet columns: word, translation, optional examples. Header optional.">
            Import file
          </PageTitle>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="hidden"
            onChange={(e) => void onFileChange(e)}
          />

          <Button
            type="button"
            variant="outline"
            className="mt-6"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {busy ? "Reading…" : pairs.length > 0 ? "Choose another file" : "Choose file"}
          </Button>
          {fileLabel ? <p className="mt-2 text-xs text-muted-foreground">{fileLabel}</p> : null}

          {pairs.length > 0 ? (
            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Preview · {pairs.length} pairs</span>
              </div>
              {langsChanged ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Detected language pair: {langLabel(wordLang)} → {langLabel(translationLang)}. The
                  list will switch to this when you add the words.
                </p>
              ) : null}
              <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-secondary text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{langLabel(wordLang)}</th>
                      <th className="px-3 py-2 font-medium">{langLabel(translationLang)}</th>
                      <th className="px-3 py-2 font-medium">Examples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairs.slice(0, 50).map((p, i) => (
                      <tr key={`${p.word}-${i}`} className="border-t border-border">
                        <td className="px-3 py-2">{p.word}</td>
                        <td className="px-3 py-2">{p.translation}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.examples?.length ? p.examples.join(" · ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pairs.length > 50 ? (
                  <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    Showing first 50 of {pairs.length}.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {busy ? "Reading file…" : "Choose a spreadsheet to preview pairs here."}
            </p>
          )}

          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

          <Button
            type="button"
            size="lg"
            className="mt-6 w-full"
            disabled={pairs.length === 0}
            onClick={() => {
              if (pairs.length === 0) {
                setError("Choose a file with at least one word pair first.")
                return
              }
              tryCommit(pairs)
            }}
          >
            Add {pairs.length > 0 ? `${pairs.length} ` : ""}to list
          </Button>
        </PageBody>
      </AppShell>

      <DuplicateImportSheet
        open={pendingDuplicates != null}
        duplicates={pendingDuplicates?.duplicates ?? []}
        newCount={pendingDuplicates?.fresh.length ?? 0}
        choice={duplicateChoice}
        onChoiceChange={setDuplicateChoice}
        onCancel={() => {
          setPendingDuplicates(null)
          setDuplicateChoice("skip")
        }}
        onContinue={() => {
          if (!pendingDuplicates) return
          commitPairs(pendingDuplicates.pairs, duplicateChoice)
        }}
      />

      <ConfirmLeaveImportSheet
        open={leaveOpen}
        pairCount={pairs.length}
        onCancel={() => setLeaveOpen(false)}
        onDiscard={() => {
          setLeaveOpen(false)
          clearImportStaging()
          navigate(returnTo)
        }}
        onSave={() => {
          setLeaveOpen(false)
          tryCommit(pairs)
        }}
      />
    </>
  )
}
