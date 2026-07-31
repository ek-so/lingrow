import { Link, useNavigate } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { OverflowMenu } from "@/components/OverflowMenu"
import { pairLabel } from "@/lib/languages"
import { Layers, Plus, UserRound } from "lucide-react"

export default function Home() {
  const navigate = useNavigate()
  const { collections, deleteCollection } = useCollections()
  const { user, status } = useAuth()

  function onDelete(id: string, name: string) {
    if (!window.confirm(`Delete “${name}”? This can’t be undone.`)) return
    deleteCollection(id)
  }

  function goNew() {
    navigate("/new")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-3">
          <a
            href={import.meta.env.BASE_URL}
            className="flex items-center gap-2 text-primary"
          >
            <Layers className="h-5 w-5" />
            <span className="text-sm font-medium tracking-wide uppercase">Lingrow</span>
          </a>
          <button
            type="button"
            aria-label="Profile"
            onClick={() => navigate("/profile")}
            className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {user?.picture && status === "signed_in" ? (
              <img
                src={user.picture}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <UserRound className="h-5 w-5" />
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 pb-8 pt-[4.75rem]">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">My sets</h1>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="New set"
            onClick={goNew}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

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
                  <OverflowMenu
                    label={`Actions for ${c.name}`}
                    items={[
                      {
                        label: "Edit",
                        onSelect: () => navigate(`/edit/${c.id}`),
                      },
                      {
                        label: "Delete",
                        destructive: true,
                        onSelect: () => onDelete(c.id, c.name),
                      },
                    ]}
                  />
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

          <button
            type="button"
            onClick={goNew}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            New set
          </button>
        </div>
      </div>
    </div>
  )
}
