import { Link, useNavigate } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SettingsMenu } from "@/components/SettingsMenu"
import { pairLabel } from "@/lib/languages"
import { Layers, Pencil, Plus, Trash2, Upload } from "lucide-react"

export default function Home() {
  const navigate = useNavigate()
  const { collections, deleteCollection } = useCollections()

  function onDelete(id: string, name: string) {
    if (!window.confirm(`Delete “${name}”? This can’t be undone.`)) return
    deleteCollection(id)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <header className="mb-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-primary">
              <Layers className="h-5 w-5" />
              <span className="text-sm font-medium tracking-wide uppercase">Lingrow</span>
            </div>
            <SettingsMenu />
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Your word collections</h1>
              <p className="mt-1 text-muted-foreground">
                Create lists, flip cards, and study with pronunciation.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => navigate("/import")}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <Button onClick={() => navigate("/new")}>
                <Plus className="h-4 w-4" />
                New list
              </Button>
            </div>
          </div>
        </header>

        {collections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
            <p className="text-muted-foreground">No lists yet.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => navigate("/new")}>
                <Plus className="h-4 w-4" />
                Create your first list
              </Button>
              <Button variant="outline" onClick={() => navigate("/import")}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </div>
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${c.name}`}
                        onClick={() => navigate(`/edit/${c.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
                    <span className="rounded-full bg-accent px-2.5 py-1 text-accent-foreground font-medium">
                      {pairLabel(c.wordLang, c.translationLang)}
                    </span>
                    {c.level && (
                      <span className="rounded-full bg-secondary px-2.5 py-1 font-medium">{c.level}</span>
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
