import { useRef, useState, type ChangeEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { Button } from "@/components/ui/button"
import { LANG_CODES, LANGS, langLabel } from "@/lib/languages"
import { isSpreadsheetFile, parseBulletText, parseSpreadsheetFile } from "@/lib/parse-import"
import type { WordPair } from "@/lib/collection-form"
import type { LangCode } from "@/types"
import { ArrowLeft, FileSpreadsheet, Info, List, Upload } from "lucide-react"

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
const inputClassName =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"

type ImportMode = "file" | "text"

export default function ImportList() {
  const navigate = useNavigate()
  const { addCollection } = useCollections()
  const fileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<ImportMode>("file")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [wordLang, setWordLang] = useState<LangCode>("de")
  const [translationLang, setTranslationLang] = useState<LangCode>("en")
  const [text, setText] = useState("")
  const [pairs, setPairs] = useState<WordPair[]>([])
  const [fileLabel, setFileLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const sameLanguage = wordLang === translationLang

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
      if (!name.trim()) {
        setName(file.name.replace(/\.(xlsx|xls|csv)$/i, ""))
      }
      if (parsed.length === 0) {
        setError("No word pairs found. Expect two columns: word and translation.")
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
      setError("No pairs found. Use lines like “- apple — der Apfel” or “word - translation”.")
    } else {
      setError(null)
    }
  }

  function onCreate() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Give your list a name.")
      return
    }
    if (pairs.length === 0) {
      setError("Import or paste at least one word pair first.")
      return
    }
    const created = addCollection({
      name: trimmedName,
      description,
      wordLang,
      translationLang,
      words: pairs,
    })
    navigate(`/study/${created.id}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Collections
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Import list</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a two-column spreadsheet, or paste a bullet list of word pairs.
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

        <div className="mt-6 flex flex-col gap-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Imported vocab"
              className={inputClassName}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Description (optional)</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short note for yourself"
              className={inputClassName}
            />
          </label>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Translates from</span>
              <select
                value={wordLang}
                onChange={(e) => setWordLang(e.target.value as LangCode)}
                className={selectClassName}
              >
                {LANG_CODES.map((code) => (
                  <option key={code} value={code}>
                    {LANGS[code].name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Into</span>
              <select
                value={translationLang}
                onChange={(e) => setTranslationLang(e.target.value as LangCode)}
                className={selectClassName}
              >
                {LANG_CODES.map((code) => (
                  <option key={code} value={code}>
                    {LANGS[code].name}
                  </option>
                ))}
              </select>
            </label>
            {sameLanguage ? (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Same language chosen — cards will still flip between the two sides.</span>
              </p>
            ) : null}
          </div>

          {mode === "file" ? (
            <div className="rounded-xl border border-dashed border-border p-5">
              <p className="text-sm font-medium">Spreadsheet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Two columns: word ({langLabel(wordLang)}) then translation ({langLabel(translationLang)}).
                Header row optional. .xlsx, .xls, or .csv.
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
                  placeholder={"- the apple — der Apfel\n- to run — laufen\n- fast - schnell"}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <p className="mt-2 text-xs text-muted-foreground">
                One pair per line. Bullets optional. Separators: —, –, -, :, =, or tab.
              </p>
              <Button type="button" variant="outline" className="mt-3" onClick={onParseText}>
                Parse text
              </Button>
            </div>
          )}

          {pairs.length > 0 ? (
            <div>
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
                    </tr>
                  </thead>
                  <tbody>
                    {pairs.slice(0, 50).map((p, i) => (
                      <tr key={`${p.word}-${i}`} className="border-t border-border">
                        <td className="px-3 py-2">{p.word}</td>
                        <td className="px-3 py-2">{p.translation}</td>
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

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="button" size="lg" onClick={onCreate} disabled={pairs.length === 0}>
            Create list
          </Button>
        </div>
      </div>
    </div>
  )
}
