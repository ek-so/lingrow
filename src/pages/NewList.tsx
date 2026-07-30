import { Link, useNavigate } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { CollectionForm } from "@/components/CollectionForm"
import { emptyDraftWord } from "@/lib/collection-form"
import { ArrowLeft } from "lucide-react"

export default function NewList() {
  const navigate = useNavigate()
  const { addCollection } = useCollections()

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Collections
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">New list</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose languages, then add word pairs — or import from a file or bullet list.
        </p>

        <div className="mt-8">
          <CollectionForm
            initial={{
              name: "",
              description: "",
              wordLang: "de",
              translationLang: "en",
              words: [emptyDraftWord(), emptyDraftWord(), emptyDraftWord()],
            }}
            submitLabel="Save list"
            onSubmit={(values) => {
              const created = addCollection(values)
              navigate(`/study/${created.id}`)
            }}
          />
        </div>
      </div>
    </div>
  )
}
