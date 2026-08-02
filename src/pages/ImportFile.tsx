import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { DuplicateImportSheet } from "@/components/DuplicateImportSheet"
import { ConfirmLeaveImportSheet } from "@/components/ConfirmLeaveImportSheet"
import { AppHeader } from "@/components/AppHeader"
import { AppShell } from "@/components/AppShell"
import { PageBody, PageTitle } from "@/components/PageTitle"
import { ImportPreview } from "@/components/ImportPreview"
import {
  clearImportStaging,
  loadImportDraft,
  loadImportStaging,
  saveImportStaging,
  type ImportDraft,
} from "@/lib/import-bridge"
import { detectPairLanguages, isSpreadsheetFile, parseSpreadsheetFile } from "@/lib/parse-import"
import { importBackLabel, useImportReview } from "@/lib/use-import-review"
import type { WordPair } from "@/lib/collection-form"
import type { LangCode } from "@/types"
import { Trash2, Upload } from "lucide-react"

export default function ImportFile() {
  const navigate = useNavigate()
  const draft = loadImportDraft()

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

  return <ImportFileLoaded draft={draft} />
}

function ImportFileLoaded({ draft }: { draft: ImportDraft }) {
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

  const {
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
  } = useImportReview({
    draft,
    detectedWordLang,
    detectedTranslationLang,
    clearStagingOnLeave: true,
  })

  useEffect(() => {
    // Staging was only needed to cross the navigation boundary.
    clearImportStaging()
  }, [])

  const hasUnsaved = pairs.length > 0

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
            leading={{
              kind: "back",
              label: importBackLabel(returnTo),
              onBack: () => requestBack(hasUnsaved),
            }}
          />
        }
      >
        <PageBody>
          <PageTitle
            description="Spreadsheet columns: word, translation, optional examples. Header optional."
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
          >
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
            <ImportPreview
              pairs={pairs}
              wordLang={wordLang}
              translationLang={translationLang}
              langsChanged={langsChanged}
            />
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
          leaveClean()
        }}
        onSave={() => {
          setLeaveOpen(false)
          tryCommit(pairs)
        }}
      />
    </>
  )
}
