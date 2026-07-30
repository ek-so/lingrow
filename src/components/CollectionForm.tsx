import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { ImportWordsPanel } from "@/components/ImportWordsPanel"
import {
  DuplicateImportSheet,
  type DuplicateImportChoice,
} from "@/components/DuplicateImportSheet"
import { LANG_CODES, LANGS, langLabel } from "@/lib/languages"
import {
  emptyDraftWord,
  pairsFromDraft,
  type DraftWord,
  type WordPair,
} from "@/lib/collection-form"
import type { LangCode } from "@/types"
import { Info, Plus, Trash2, Upload } from "lucide-react"

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
}

interface PendingImport {
  pairs: WordPair[]
  duplicates: WordPair[]
  fresh: WordPair[]
}

function wordKey(word: string) {
  return word.trim().toLowerCase()
}

function normalizePairs(pairs: WordPair[]): WordPair[] {
  const seen = new Set<string>()
  const out: WordPair[] = []
  for (const pair of pairs) {
    const word = pair.word.trim()
    const translation = pair.translation.trim()
    if (!word || !translation) continue
    const key = wordKey(word)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ word, translation })
  }
  return out
}

function classifyImport(existing: DraftWord[], pairs: WordPair[]) {
  const filled = existing.filter((w) => w.word.trim())
  const existingKeys = new Set(filled.map((w) => wordKey(w.word)))
  const normalized = normalizePairs(pairs)
  const duplicates: WordPair[] = []
  const fresh: WordPair[] = []
  for (const pair of normalized) {
    if (existingKeys.has(wordKey(pair.word))) duplicates.push(pair)
    else fresh.push(pair)
  }
  return { filled, duplicates, fresh, normalized }
}

function applyImport(
  existing: DraftWord[],
  pairs: WordPair[],
  choice: DuplicateImportChoice | null,
): DraftWord[] {
  const { filled, duplicates, fresh } = classifyImport(existing, pairs)

  let next = filled.length > 0 ? [...filled] : []

  if (choice === "rewrite" && duplicates.length > 0) {
    const byWord = new Map(duplicates.map((d) => [wordKey(d.word), d]))
    next = next.map((row) => {
      const hit = byWord.get(wordKey(row.word))
      if (!hit) return row
      return { ...row, translation: hit.translation }
    })
  }

  const stamp = Date.now()
  const additions = fresh.map((pair, i) => ({
    key: `${stamp}-${Math.random().toString(36).slice(2, 7)}-${i}`,
    word: pair.word,
    translation: pair.translation,
  }))

  next = [...next, ...additions]
  return next.length > 0 ? next : [emptyDraftWord()]
}

export function CollectionForm({ initial, submitLabel, onSubmit }: CollectionFormProps) {
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [wordLang, setWordLang] = useState<LangCode>(initial.wordLang)
  const [translationLang, setTranslationLang] = useState<LangCode>(initial.translationLang)
  const [words, setWords] = useState<DraftWord[]>(initial.words)
  const [error, setError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [duplicateChoice, setDuplicateChoice] = useState<DuplicateImportChoice>("skip")

  const sameLanguage = wordLang === translationLang

  function updateWord(key: string, field: "word" | "translation", value: string) {
    setWords((prev) => prev.map((w) => (w.key === key ? { ...w, [field]: value } : w)))
  }

  function removeWord(key: string) {
    setWords((prev) => (prev.length <= 1 ? prev : prev.filter((w) => w.key !== key)))
  }

  function finishImport(pairs: WordPair[], choice: DuplicateImportChoice | null) {
    setWords((prev) => applyImport(prev, pairs, choice))
    setPendingImport(null)
    setShowImport(false)
    setError(null)
    setDuplicateChoice("skip")
  }

  function handleImportedPairs(pairs: WordPair[]) {
    const { duplicates, fresh, normalized } = classifyImport(words, pairs)
    if (duplicates.length === 0) {
      finishImport(normalized, null)
      return
    }
    setPendingImport({ pairs: normalized, duplicates, fresh })
    setDuplicateChoice("skip")
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
    <>
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

          {showImport ? (
            <ImportWordsPanel
              wordLang={wordLang}
              translationLang={translationLang}
              onClose={() => setShowImport(false)}
              onImport={handleImportedPairs}
            />
          ) : (
            <Button type="button" variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4" />
              Import
            </Button>
          )}

          <Button type="submit" size="lg">
            {submitLabel}
          </Button>
        </div>
      </form>

      <DuplicateImportSheet
        open={pendingImport != null}
        duplicates={pendingImport?.duplicates ?? []}
        newCount={pendingImport?.fresh.length ?? 0}
        choice={duplicateChoice}
        onChoiceChange={setDuplicateChoice}
        onCancel={() => {
          setPendingImport(null)
          setDuplicateChoice("skip")
        }}
        onContinue={() => {
          if (!pendingImport) return
          finishImport(pendingImport.pairs, duplicateChoice)
        }}
      />
    </>
  )
}
