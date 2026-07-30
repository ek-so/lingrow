import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { Button } from "@/components/ui/button"
import { LANG_CODES, LANGS, langLabel, otherLangs } from "@/lib/languages"
import type { LangCode } from "@/types"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"

interface DraftWord {
  key: string
  word: string
  translation: string
}

function emptyWord(): DraftWord {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    word: "",
    translation: "",
  }
}

function LangPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: LangCode
  options: LangCode[]
  onChange: (code: LangCode) => void
}) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <div
        className={`mt-2 grid gap-2 ${options.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
      >
        {options.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            className={`rounded-lg border px-2 py-2.5 text-center text-sm transition-colors ${
              value === code
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border hover:bg-secondary"
            }`}
          >
            <span className="font-medium">{LANGS[code].short}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{LANGS[code].name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function NewList() {
  const navigate = useNavigate()
  const { addCollection } = useCollections()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [wordLang, setWordLang] = useState<LangCode>("de")
  const [translationLang, setTranslationLang] = useState<LangCode>("en")
  const [words, setWords] = useState<DraftWord[]>([emptyWord(), emptyWord(), emptyWord()])
  const [error, setError] = useState<string | null>(null)

  const translationOptions = otherLangs(wordLang)

  function onWordLangChange(code: LangCode) {
    setWordLang(code)
    if (code === translationLang) {
      setTranslationLang(otherLangs(code)[0])
    }
  }

  function updateWord(key: string, field: "word" | "translation", value: string) {
    setWords((prev) => prev.map((w) => (w.key === key ? { ...w, [field]: value } : w)))
  }

  function removeWord(key: string) {
    setWords((prev) => (prev.length <= 1 ? prev : prev.filter((w) => w.key !== key)))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const validWords = words.filter((w) => w.word.trim() && w.translation.trim())
    if (!trimmedName) {
      setError("Give your list a name.")
      return
    }
    if (wordLang === translationLang) {
      setError("Pick two different languages.")
      return
    }
    if (validWords.length === 0) {
      setError(`Add at least one pair with both ${langLabel(wordLang)} and ${langLabel(translationLang)}.`)
      return
    }
    const created = addCollection({
      name: trimmedName,
      description,
      wordLang,
      translationLang,
      words: validWords.map((w) => ({ word: w.word, translation: w.translation })),
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

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">New list</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the word language and what it translates into, then add pairs.
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kitchen verbs"
              className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Description (optional)</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short note for yourself"
              className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <section className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
            <LangPicker
              label="Word language"
              value={wordLang}
              options={LANG_CODES}
              onChange={onWordLangChange}
            />
            <LangPicker
              label="Translates into"
              value={translationLang}
              options={translationOptions}
              onChange={setTranslationLang}
            />
          </section>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">Words</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setWords((w) => [...w, emptyWord()])}>
                <Plus className="h-4 w-4" />
                Add row
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {words.map((w, i) => (
                <div key={w.key} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    value={w.word}
                    onChange={(e) => updateWord(w.key, "word", e.target.value)}
                    placeholder={i === 0 ? langLabel(wordLang) : undefined}
                    aria-label={langLabel(wordLang)}
                    className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={w.translation}
                    onChange={(e) => updateWord(w.key, "translation", e.target.value)}
                    placeholder={i === 0 ? langLabel(translationLang) : undefined}
                    aria-label={langLabel(translationLang)}
                    className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove word"
                    onClick={() => removeWord(w.key)}
                    disabled={words.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" size="lg">
            Save list
          </Button>
        </form>
      </div>
    </div>
  )
}
