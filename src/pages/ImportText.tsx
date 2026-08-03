import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { DuplicateImportSheet } from "@/components/DuplicateImportSheet"
import { ConfirmLeaveImportSheet } from "@/components/ConfirmLeaveImportSheet"
import { AppHeader } from "@/components/AppHeader"
import { AppShell } from "@/components/AppShell"
import { PageBody, PageTitle } from "@/components/PageTitle"
import { TitleActions, titleAction } from "@/components/TitleActions"
import { ImportPreview } from "@/components/ImportPreview"
import { loadImportDraft, type ImportDraft } from "@/lib/import-bridge"
import { parseImportText } from "@/lib/parse-import"
import { importBackLabel, useImportReview } from "@/lib/use-import-review"
import type { WordPair } from "@/lib/collection-form"
import type { LangCode } from "@/types"

const PLACEHOLDER =
  "the apple — der Apfel (Ich esse einen Apfel.)\nto run — laufen (Ich laufe jeden Morgen.)"

export default function ImportText() {
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

  return <ImportTextLoaded draft={draft} />
}

function ImportTextLoaded({ draft }: { draft: ImportDraft }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState("")
  const [pairs, setPairs] = useState<WordPair[]>([])
  const [detectedWordLang, setDetectedWordLang] = useState<LangCode | null>(null)
  const [detectedTranslationLang, setDetectedTranslationLang] = useState<LangCode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pasteHint, setPasteHint] = useState<string | null>(null)

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
  })

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [])

  const hasUnsaved = pairs.length > 0 || text.trim().length > 0

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
            actions={
              <TitleActions
                actions={[
                  titleAction.paste(() => void onPasteClipboard()),
                  titleAction.clear(clearAll, {
                    disabled: !canClear,
                    label: "Clear text and preview",
                  }),
                ]}
              />
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
            <Button
              type="button"
              variant="outline"
              onClick={() => applyParsedText(text)}
              disabled={!text.trim()}
            >
              Parse
            </Button>
          </div>

          <ImportPreview
            pairs={pairs}
            wordLang={wordLang}
            translationLang={translationLang}
            langsChanged={langsChanged}
          />

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
          if (pairs.length > 0) tryCommit(pairs)
          else leaveClean()
        }}
      />
    </>
  )
}
