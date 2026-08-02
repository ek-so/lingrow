import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  DuplicateImportSheet,
  type DuplicateImportChoice,
} from "@/components/DuplicateImportSheet"
import { ConfirmLeaveImportSheet } from "@/components/ConfirmLeaveImportSheet"
import { PageBody, PageTitle } from "@/components/PageTitle"
import { langLabel } from "@/lib/languages"
import { classifyImport, loadImportDraft, saveImportResult } from "@/lib/import-bridge"
import { parseImportText } from "@/lib/parse-import"
import type { WordPair } from "@/lib/collection-form"
import type { LangCode } from "@/types"
import { ArrowLeft, ClipboardPaste, Trash2 } from "lucide-react"

const PLACEHOLDER =
  "the apple — der Apfel (Ich esse einen Apfel.)\nto run — laufen (Ich laufe jeden Morgen.)"

export default function ImportText() {
  const navigate = useNavigate()
  const draft = loadImportDraft()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [text, setText] = useState("")
  const [pairs, setPairs] = useState<WordPair[]>([])
  const [detectedWordLang, setDetectedWordLang] = useState<LangCode | null>(null)
  const [detectedTranslationLang, setDetectedTranslationLang] = useState<LangCode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pasteHint, setPasteHint] = useState<string | null>(null)
  const [duplicateChoice, setDuplicateChoice] = useState<DuplicateImportChoice>("skip")
  const [pendingDuplicates, setPendingDuplicates] = useState<{
    pairs: WordPair[]
    duplicates: WordPair[]
    fresh: WordPair[]
  } | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
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
  const hasUnsaved = pairs.length > 0 || text.trim().length > 0
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

  function applyParsedText(raw: string) {
    const parsed = parseImportText(raw)
    setPairs(parsed.pairs)
    setDetectedWordLang(parsed.wordLang ?? null)
    setDetectedTranslationLang(parsed.translationLang ?? null)
    if (parsed.pairs.length === 0) {
      setError(
        "No pairs found. Use lines like “the apple — der Apfel (Ich esse einen Apfel.)”.",
      )
    } else {
      setError(null)
    }
  }

  function onParseText() {
    applyParsedText(text)
  }

  async function onPasteClipboard() {
    setPasteHint(null)
    try {
      if (!navigator.clipboard?.readText) {
        setPasteHint("Clipboard paste isn’t available here — use the text box.")
        return
      }
      const clip = await navigator.clipboard.readText()
      if (!clip.trim()) {
        setPasteHint("Clipboard is empty.")
        return
      }
      setText(clip)
      applyParsedText(clip)
      textareaRef.current?.focus()
    } catch {
      setPasteHint("Couldn’t read the clipboard. Paste into the box manually.")
    }
  }

  function clearAll() {
    setText("")
    setPairs([])
    setDetectedWordLang(null)
    setDetectedTranslationLang(null)
    setError(null)
    setPasteHint(null)
    textareaRef.current?.focus()
  }

  const canClear = text.trim().length > 0 || pairs.length > 0

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-md">
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

      <PageBody>
        <PageTitle
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Paste from clipboard"
                onClick={() => void onPasteClipboard()}
              >
                <ClipboardPaste className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Clear text and preview"
                disabled={!canClear}
                onClick={clearAll}
                className="text-destructive hover:bg-transparent hover:text-destructive disabled:text-destructive/40"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </>
          }
        >
          Paste text
        </PageTitle>

        <div className="mt-6 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">Your list</span>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder={PLACEHOLDER}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          {pasteHint ? <p className="text-xs text-muted-foreground">{pasteHint}</p> : null}
          <Button type="button" variant="outline" onClick={onParseText} disabled={!text.trim()}>
            Parse
          </Button>
        </div>

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
        ) : null}

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        <Button
          type="button"
          size="lg"
          className="mt-6 w-full"
          disabled={pairs.length === 0}
          onClick={() => {
            if (pairs.length === 0) {
              setError("Paste or parse at least one word pair first.")
              return
            }
            tryCommit(pairs)
          }}
        >
          Add {pairs.length > 0 ? `${pairs.length} ` : ""}to list
        </Button>
      </PageBody>

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
          if (pairs.length > 0) tryCommit(pairs)
          else navigate(returnTo)
        }}
      />
    </div>
  )
}
