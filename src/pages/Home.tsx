import { Link, useNavigate } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Layers, Plus, Trash2 } from "lucide-react"
import type { PronounceFirst } from "@/types"

export default function Home() {
  const navigate = useNavigate()
  const { collections, settings, deleteCollection, setPronounceFirst } = useCollections()

  function onDelete(id: string, name: string) {
    if (!window.confirm(`Delete “${name}”? This can’t be undone.`)) return
    deleteCollection(id)
  }

  function onPronounceChange(value: PronounceFirst) {
    setPronounceFirst(value)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-primary">
            <Layers className="h-5 w-5" />
            <span className="text-sm font-medium tracking-wide uppercase">Lingrow</span>
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Your word collections</h1>
              <p className="mt-1 text-muted-foreground">
                Create lists, flip cards, and study with pronunciation.
              </p>
            </div>
            <Button onClick={() => navigate("/new")} className="shrink-0">
              <Plus className="h-4 w-4" />
              New list
            </Button>
          </div>
        </header>

        <section className="mb-8 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Pronounce first</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose what the voice says first when you hit Play.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onPronounceChange("word")}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                settings.pronounceFirst === "word"
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <span className="font-medium">Word</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">German → English</span>
            </button>
            <button
              type="button"
              onClick={() => onPronounceChange("translation")}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                settings.pronounceFirst === "translation"
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <span className="font-medium">Translation</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">English → German</span>
            </button>
          </div>
        </section>

        {collections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
            <p className="text-muted-foreground">No lists yet.</p>
            <Button className="mt-4" onClick={() => navigate("/new")}>
              <Plus className="h-4 w-4" />
              Create your first list
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {collections.map((c) => (
              <Card key={c.id} className="transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/study/${c.id}`} className="min-w-0 flex-1">
                      <CardTitle>{c.name}</CardTitle>
                      {c.description ? (
                        <CardDescription className="mt-1">{c.description}</CardDescription>
                      ) : null}
                    </Link>
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${c.name}`}
                        onClick={() => onDelete(c.id, c.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Link to={`/study/${c.id}`} className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {c.level && (
                      <span className="rounded-full bg-accent px-2.5 py-1 text-accent-foreground font-medium">
                        {c.level}
                      </span>
                    )}
                    {c.theme && <span className="rounded-full bg-secondary px-2.5 py-1">{c.theme}</span>}
                    <span className="rounded-full bg-secondary px-2.5 py-1">{c.words.length} words</span>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
