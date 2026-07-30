import { useState, type FormEvent } from "react"
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
import type { LangCode } from "@/types"
import { Info, Plus, Trash2, Upload } from "lucide-react"

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
          Optional: add 2–3 example sentences (word language) under each pair — one per line.
        </p>
        <div className="mt-3 flex flex-col gap-4">
          {words.map((w, i) => (
            <div key={w.key} className="rounded-lg border border-border p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2">
                <input
                  value={w.word}
                  onChange={(e) => updateWord(w.key, "word", e.target.value)}
                  placeholder={i === 0 ? langLabel(wordLang) : undefined}
                  aria-label={langLabel(wordLang)}
                  className={inputClassName}
                />
                <input
                  value={w.translation}
                  onChange={(e) => updateWord(w.key, "translation", e.target.value)}
                  placeholder={i === 0 ? langLabel(translationLang) : undefined}
                  aria-label={langLabel(translationLang)}
                  className={inputClassName}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove word"
                  onClick={() => removeWord(w.key)}
                  disabled={words.length <= 1}
                  className="h-10 w-10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <label className="mt-2 flex flex-col gap-1">
                <span className="sr-only">Examples for {w.word || `row ${i + 1}`}</span>
                <textarea
                  value={w.examplesText}
                  onChange={(e) => updateWord(w.key, "examplesText", e.target.value)}
                  rows={2}
                  placeholder="Example sentences (optional, one per line)"
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
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
