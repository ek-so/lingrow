import { Link } from "react-router-dom"
import { collections } from "@/data/collections"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { BookOpen, Layers } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-primary">
            <Layers className="h-5 w-5" />
            <span className="text-sm font-medium tracking-wide uppercase">Lingrow</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your word collections</h1>
          <p className="mt-1 text-muted-foreground">
            Pick a collection to study, hands-free, with pronunciation.
          </p>
        </header>

        <div className="flex flex-col gap-3">
          {collections.map((c) => (
            <Link key={c.id} to={`/study/${c.id}`}>
              <Card className="transition-colors hover:border-primary/50 cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{c.name}</CardTitle>
                      <CardDescription className="mt-1">{c.description}</CardDescription>
                    </div>
                    <BookOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {c.level && (
                      <span className="rounded-full bg-accent px-2.5 py-1 text-accent-foreground font-medium">
                        {c.level}
                      </span>
                    )}
                    {c.theme && (
                      <span className="rounded-full bg-secondary px-2.5 py-1">{c.theme}</span>
                    )}
                    <span className="rounded-full bg-secondary px-2.5 py-1">
                      {c.words.length} words
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
