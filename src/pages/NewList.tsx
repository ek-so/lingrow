import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"

interface DraftWord {
  key: string
  de: string
  en: string
}

function emptyWord(): DraftWord {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    de: "",
    en: "",
  }
}

export default function NewList() {
  const navigate = useNavigate()
  const { addCollection } = useCollections()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [words, setWords] = useState<DraftWord[]>([emptyWord(), emptyWord(), emptyWord()])
  const [error, setError] = useState<string | null>(null)

  function updateWord(key: string, field: "de" | "en", value: string) {
    setWords((prev) => prev.map((w) => (w.key === key ? { ...w, [field]: value } : w)))
  }

  function removeWord(key: string) {
    setWords((prev) => (prev.length <= 1 ? prev : prev.filter((w) => w.key !== key)))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const validWords = words.filter((w) => w.de.trim() && w.en.trim())
    if (!trimmedName) {
      setError("Give your list a name.")
      return
    }
    if (validWords.length === 0) {
      setError("Add at least one word with both German and English.")
      return
    }
    const created = addCollection({
      name: trimmedName,
      description,
      words: validWords.map((w) => ({ de: w.de, en: w.en })),
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
        <p className="mt-1 text-sm text-muted-foreground">Add German words and their English translations.</p>

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
                    value={w.de}
                    onChange={(e) => updateWord(w.key, "de", e.target.value)}
                    placeholder={i === 0 ? "German" : undefined}
                    aria-label="German"
                    className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={w.en}
                    onChange={(e) => updateWord(w.key, "en", e.target.value)}
                    placeholder={i === 0 ? "English" : undefined}
                    aria-label="English"
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
