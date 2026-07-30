import { useRef, useState, type ChangeEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  DuplicateImportSheet,
  type DuplicateImportChoice,
} from "@/components/DuplicateImportSheet"
import { ConfirmLeaveImportSheet } from "@/components/ConfirmLeaveImportSheet"
import { langLabel } from "@/lib/languages"
import {
  classifyImport,
  loadImportDraft,
  saveImportResult,
} from "@/lib/import-bridge"
import { isSpreadsheetFile, parseBulletText, parseSpreadsheetFile } from "@/lib/parse-import"
import type { WordPair } from "@/lib/collection-form"
import { ArrowLeft, FileSpreadsheet, List, Upload } from "lucide-react"

type ImportMode = "file" | "text"

export default function ImportWords() {
  const navigate = useNavigate()
  const draft = loadImportDraft()
  const fileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<ImportMode>("file")
  const [text, setText] = useState("")
  const [pairs, setPairs] = useState<WordPair[]>([])
  const [fileLabel, setFileLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [duplicateChoice, setDuplicateChoice] = useState<DuplicateImportChoice>("skip")
  const [pendingDuplicates, setPendingDuplicates] = useState<{
    pairs: WordPair[]
    duplicates: WordPair[]
    fresh: WordPair[]
  } | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)

  if (!draft) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-5">
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
  const wordLang = values.wordLang
  const translationLang = values.translationLang
  const hasUnsaved = pairs.length > 0

  function commitPairs(nextPairs: WordPair[], choice: DuplicateImportChoice | null) {
    saveImportResult({ pairs: nextPairs, choice })
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
      return
    }
    setBusy(true)
    setError(null)
    try {
      const parsed = await parseSpreadsheetFile(file)
      setPairs(parsed)
      setFileLabel(file.name)
      if (parsed.length === 0) {
        setError("No word pairs found. Expect columns: word, translation, optional examples.")
      }
    } catch {
      setError("Could not read that file. Try exporting as .xlsx or .csv.")
      setPairs([])
      setFileLabel(null)
    } finally {
      setBusy(false)
    }
  }

  function onParseText() {
    const parsed = parseBulletText(text)
    setPairs(parsed)
    setFileLabel(null)
    if (parsed.length === 0) {
      setError(
        "No pairs found. Use lines like “- apple — der Apfel || Ich esse einen Apfel.” or “word - translation”.",
      )
    } else {
      setError(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center px-5 py-3">
          <button
            type="button"
            onClick={requestBack}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Import words</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a spreadsheet or paste a bullet list. Imported pairs are added to your list.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              mode === "file"
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border hover:bg-secondary"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel / CSV
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              mode === "text"
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border hover:bg-secondary"
            }`}
          >
            <List className="h-4 w-4" />
            Bullet text
          </button>
        </div>

        <div className="mt-6">
          {mode === "file" ? (
            <div className="rounded-xl border border-dashed border-border p-5">
              <p className="text-sm font-medium">Spreadsheet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Columns: {langLabel(wordLang)}, {langLabel(translationLang)}, optional examples
                (separate sentences with || or newlines). Header optional.
              </p>
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
                className="mt-4"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {busy ? "Reading…" : "Choose file"}
              </Button>
              {fileLabel ? <p className="mt-2 text-xs text-muted-foreground">{fileLabel}</p> : null}
            </div>
          ) : (
            <div>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Paste bullet list</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={10}
                  placeholder={
                    "- the apple — der Apfel || Ich esse einen Apfel. || Der Apfel ist rot.\n- to run — laufen || Ich laufe jeden Morgen."
                  }
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <p className="mt-2 text-xs text-muted-foreground">
                One pair per line. Bullets optional. Separators: —, –, -, :, =, or tab. Add examples
                after the translation with || (up to three).
              </p>
              <Button type="button" variant="outline" className="mt-3" onClick={onParseText}>
                Parse text
              </Button>
            </div>
          )}
        </div>

        {pairs.length > 0 ? (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Preview · {pairs.length} pairs</span>
              <button
                type="button"
                className="text-xs text-muted-foreground underline hover:text-foreground"
                onClick={() => {
                  setPairs([])
                  setFileLabel(null)
                }}
              >
                Clear
              </button>
            </div>
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
        ) : null}

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        <Button
          type="button"
          size="lg"
          className="mt-6 w-full"
          disabled={pairs.length === 0}
          onClick={() => {
            if (pairs.length === 0) {
              setError("Import or paste at least one word pair first.")
              return
            }
            tryCommit(pairs)
          }}
        >
          Add {pairs.length > 0 ? `${pairs.length} ` : ""}to list
        </Button>
      </div>

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
          navigate(returnTo)
        }}
        onSave={() => {
          setLeaveOpen(false)
          tryCommit(pairs)
        }}
      />
    </div>
  )
}
