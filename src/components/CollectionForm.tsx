import { useState, type FormEvent, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { LANG_CODES, LANGS, langLabel } from "@/lib/languages"
import {
  emptyDraftWord,
  pairsFromDraft,
  type DraftWord,
} from "@/lib/collection-form"
import type { LangCode } from "@/types"
import { Info, Plus, Trash2 } from "lucide-react"

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
const inputClassName =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"

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

export interface CollectionFormValues {
  name: string
  description: string
  wordLang: LangCode
  translationLang: LangCode
  words: DraftWord[]
}

interface CollectionFormProps {
  initial: CollectionFormValues
  submitLabel: string
  onSubmit: (values: {
    name: string
    description: string
    wordLang: LangCode
    translationLang: LangCode
    words: Array<{ word: string; translation: string }>
  }) => void
  footerNote?: ReactNode
}

export function CollectionForm({ initial, submitLabel, onSubmit, footerNote }: CollectionFormProps) {
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [wordLang, setWordLang] = useState<LangCode>(initial.wordLang)
  const [translationLang, setTranslationLang] = useState<LangCode>(initial.translationLang)
  const [words, setWords] = useState<DraftWord[]>(initial.words)
  const [error, setError] = useState<string | null>(null)

  const sameLanguage = wordLang === translationLang

  function updateWord(key: string, field: "word" | "translation", value: string) {
    setWords((prev) => prev.map((w) => (w.key === key ? { ...w, [field]: value } : w)))
  }

  function removeWord(key: string) {
    setWords((prev) => (prev.length <= 1 ? prev : prev.filter((w) => w.key !== key)))
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
        <div className="mt-3 flex flex-col gap-2">
          {words.map((w, i) => (
            <div key={w.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2">
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
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col gap-3">
        <Button type="button" variant="outline" onClick={() => setWords((w) => [...w, emptyDraftWord()])}>
          <Plus className="h-4 w-4" />
          Add row
        </Button>
        {footerNote}
        <Button type="submit" size="lg">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
