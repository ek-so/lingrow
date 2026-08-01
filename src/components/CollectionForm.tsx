import { useEffect, useRef, useState, type FormEvent } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { LANG_CODES, LANGS, langLabel } from "@/lib/languages"
import {
  emptyDraftWord,
  pairsFromDraft,
  type CollectionFormValues,
  type DraftWord,
} from "@/lib/collection-form"
import {
  applyImport,
  clearImportDraft,
  consumeImportResult,
  loadImportDraft,
  saveImportDraft,
} from "@/lib/import-bridge"
import { examplesFromTextarea } from "@/lib/examples"
import { useWordSuggest } from "@/lib/use-word-suggest"
import type { LangCode } from "@/types"
import { Info, Loader2, Plus, Sparkles, Trash2, Upload } from "lucide-react"

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-base outline-none focus:ring-2 focus:ring-ring"
const inputClassName =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-base outline-none focus:ring-2 focus:ring-ring"

function LangSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: LangCode
  onChange: (code: LangCode) => void
}) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      <span className="text-sm font-medium">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as LangCode)}
        className={selectClassName}
      >
        {LANG_CODES.map((code) => (
          <option key={code} value={code}>
            {LANGS[code].name}
          </option>
        ))}
      </select>
    </label>
  )
}

function Chip({
  label,
  onClick,
  active,
}: {
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md bg-accent px-2.5 py-1 text-left text-xs font-medium text-accent-foreground"
          : "rounded-md border border-border bg-card px-2.5 py-1 text-left text-xs text-foreground hover:bg-secondary"
      }
    >
      {label}
    </button>
  )
}

function WordRow({
  draft,
  wordLang,
  translationLang,
  canRemove,
  onChange,
  onRemove,
}: {
  draft: DraftWord
  wordLang: LangCode
  translationLang: LangCode
  canRemove: boolean
  onChange: (field: "word" | "translation" | "examplesText", value: string) => void
  onRemove: () => void
}) {
  const { status, suggestion } = useWordSuggest(draft.word, wordLang, translationLang)
  const sameLanguage = wordLang === translationLang

  // Values we last auto-filled — kept so a new lookup can replace them without
  // overwriting anything the user typed by hand.
  const autoTranslation = useRef<string | null>(null)
  const autoExamples = useRef<string | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!suggestion) return
    const currentDraft = draftRef.current
    const change = onChangeRef.current

    if (!sameLanguage && suggestion.translation) {
      const current = currentDraft.translation.trim()
      const canFill = !current || current === autoTranslation.current
      if (canFill && current !== suggestion.translation) {
        autoTranslation.current = suggestion.translation
        change("translation", suggestion.translation)
      }
    }

    if (suggestion.examples.length > 0) {
      const current = currentDraft.examplesText
      const canFill = !current.trim() || current === autoExamples.current
      if (canFill) {
        const next = suggestion.examples.join("\n")
        if (next !== current) {
          autoExamples.current = next
          change("examplesText", next)
        }
      }
    }
  }, [suggestion, sameLanguage])

  function applyTranslation(value: string) {
    // Still treat chip picks as auto-sourced so a later word edit can replace them.
    autoTranslation.current = value
    onChange("translation", value)
  }

  function addExample(example: string) {
    const existing = examplesFromTextarea(draft.examplesText) ?? []
    if (existing.some((e) => e.toLowerCase() === example.toLowerCase())) return
    const next = [...existing, example].join("\n")
    autoExamples.current = null
    onChange("examplesText", next)
  }

  function applyAllExamples() {
    if (!suggestion?.examples.length) return
    autoExamples.current = suggestion.examples.join("\n")
    onChange("examplesText", autoExamples.current)
  }

  const unusedExamples =
    suggestion?.examples.filter((ex) => {
      const have = examplesFromTextarea(draft.examplesText) ?? []
      return !have.some((h) => h.toLowerCase() === ex.toLowerCase())
    }) ?? []

  const showSuggestChrome =
    status === "loading" ||
    status === "error" ||
    (suggestion &&
      ((suggestion.translation && !sameLanguage) ||
        suggestion.alternatives.length > 0 ||
        suggestion.examples.length > 0))

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            value={draft.word}
            onChange={(e) => onChange("word", e.target.value)}
            placeholder={langLabel(wordLang)}
            aria-label={langLabel(wordLang)}
            className={inputClassName}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <input
            value={draft.translation}
            onChange={(e) => {
              autoTranslation.current = null
              onChange("translation", e.target.value)
            }}
            placeholder={langLabel(translationLang)}
            aria-label={langLabel(translationLang)}
            className={inputClassName}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remove word"
          onClick={onRemove}
          disabled={!canRemove}
          className="mt-0 h-10 w-10 shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {showSuggestChrome ? (
        <div className="mt-2 flex flex-col gap-2 rounded-md bg-secondary/60 px-2.5 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {status === "loading" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Looking up translation…</span>
              </>
            ) : status === "error" ? (
              <span>Couldn’t fetch suggestions — type them in yourself.</span>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Suggestions</span>
              </>
            )}
          </div>

          {suggestion && !sameLanguage && (suggestion.translation || suggestion.alternatives.length) ? (
            <div className="flex flex-wrap gap-1.5">
              {suggestion.translation ? (
                <Chip
                  label={suggestion.translation}
                  active={draft.translation.trim() === suggestion.translation}
                  onClick={() => applyTranslation(suggestion.translation)}
                />
              ) : null}
              {suggestion.alternatives.map((alt) => (
                <Chip
                  key={alt}
                  label={alt}
                  active={draft.translation.trim() === alt}
                  onClick={() => applyTranslation(alt)}
                />
              ))}
            </div>
          ) : null}

          {suggestion && unusedExamples.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Examples</span>
                <button
                  type="button"
                  onClick={applyAllExamples}
                  className="text-xs font-medium text-primary"
                >
                  Use all
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {unusedExamples.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => addExample(ex)}
                    className="rounded-md border border-border bg-card px-2.5 py-1.5 text-left text-xs leading-snug text-foreground hover:bg-accent"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="mt-2 flex flex-col gap-1">
        <span className="sr-only">Examples for {draft.word || "word"}</span>
        <textarea
          value={draft.examplesText}
          onChange={(e) => {
            autoExamples.current = null
            onChange("examplesText", e.target.value)
          }}
          rows={2}
          placeholder="Example sentences (optional, one per line)"
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
    </div>
  )
}

export type { CollectionFormValues }

interface CollectionFormProps {
  initial: CollectionFormValues
  submitLabel: string
  onSubmit: (values: {
    name: string
    description: string
    wordLang: LangCode
    translationLang: LangCode
    words: Array<{ word: string; translation: string; examples?: string[] }>
  }) => void
}

function resolveInitial(fallback: CollectionFormValues, pathname: string): CollectionFormValues {
  const draft = loadImportDraft()
  const result = consumeImportResult()

  if (draft && draft.returnTo === pathname) {
    const base = draft.values
    clearImportDraft()
    if (result) {
      return {
        ...base,
        words: applyImport(base.words, result.pairs, result.choice),
      }
    }
    return base
  }

  // Orphan result without matching draft — ignore
  return fallback
}

export function CollectionForm({ initial, submitLabel, onSubmit }: CollectionFormProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [boot] = useState(() => resolveInitial(initial, location.pathname))

  const [name, setName] = useState(boot.name)
  const [description, setDescription] = useState(boot.description)
  const [wordLang, setWordLang] = useState<LangCode>(boot.wordLang)
  const [translationLang, setTranslationLang] = useState<LangCode>(boot.translationLang)
  const [words, setWords] = useState<DraftWord[]>(() =>
    boot.words.map((w) => ({
      key: w.key || emptyDraftWord().key,
      word: w.word ?? "",
      translation: w.translation ?? "",
      examplesText: w.examplesText ?? "",
    })),
  )
  const [error, setError] = useState<string | null>(null)

  const sameLanguage = wordLang === translationLang

  function updateWord(key: string, field: "word" | "translation" | "examplesText", value: string) {
    setWords((prev) => prev.map((w) => (w.key === key ? { ...w, [field]: value } : w)))
  }

  function removeWord(key: string) {
    setWords((prev) => (prev.length <= 1 ? prev : prev.filter((w) => w.key !== key)))
  }

  function openImport() {
    saveImportDraft({
      returnTo: location.pathname,
      values: { name, description, wordLang, translationLang, words },
    })
    navigate("/import")
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const validWords = pairsFromDraft(words)
    if (!trimmedName) {
      setError("Give your list a name.")
      return
    }
    if (validWords.length === 0) {
      setError(
        sameLanguage
          ? `Add at least one pair with both sides filled in (${langLabel(wordLang)}).`
          : `Add at least one pair with both ${langLabel(wordLang)} and ${langLabel(translationLang)}.`,
      )
      return
    }
    setError(null)
    onSubmit({
      name: trimmedName,
      description,
      wordLang,
      translationLang,
      words: validWords,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Kitchen verbs"
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
        <LangSelect id="from-lang" label="Translates from" value={wordLang} onChange={setWordLang} />
        <LangSelect id="into-lang" label="Into" value={translationLang} onChange={setTranslationLang} />
        {sameLanguage ? (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Same language chosen — cards will still flip between the two sides.</span>
          </p>
        ) : null}
      </div>

      <div>
        <span className="text-sm font-medium">Words</span>
        <p className="mt-1 text-xs text-muted-foreground">
          Type a word and we’ll suggest a translation and example sentences. Edit anything before
          saving.
        </p>
        <div className="mt-3 flex flex-col gap-4">
          {words.map((w) => (
            <WordRow
              key={w.key}
              draft={w}
              wordLang={wordLang}
              translationLang={translationLang}
              canRemove={words.length > 1}
              onChange={(field, value) => updateWord(w.key, field, value)}
              onRemove={() => removeWord(w.key)}
            />
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col gap-3">
        <Button type="button" variant="outline" onClick={() => setWords((w) => [...w, emptyDraftWord()])}>
          <Plus className="h-4 w-4" />
          Add row
        </Button>
        <Button type="button" variant="outline" onClick={openImport}>
          <Upload className="h-4 w-4" />
          Import
        </Button>
        <Button type="submit" size="lg">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
