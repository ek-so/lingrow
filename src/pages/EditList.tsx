import { Link, useNavigate, useParams } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { CollectionForm } from "@/components/CollectionForm"
import { draftFromWords } from "@/lib/collection-form"
import { ArrowLeft } from "lucide-react"

export default function EditList() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getCollection, updateCollection } = useCollections()
  const collection = id ? getCollection(id) : undefined

  if (!collection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Set not found.</p>
          <Link to="/" className="text-primary underline mt-2 inline-block">
            Back home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center px-5 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            My sets
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 pb-6 pt-[4.75rem]">
        <h1 className="text-2xl font-semibold tracking-tight">Edit set</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update languages, name, or word pairs.</p>

        <div className="mt-8">
          <CollectionForm
            key={collection.id}
            initial={{
              name: collection.name,
              description: collection.description,
              wordLang: collection.wordLang,
              translationLang: collection.translationLang,
              words: draftFromWords(collection.words),
            }}
            submitLabel="Save changes"
            onSubmit={(values) => {
              updateCollection(collection.id, values)
              navigate(`/study/${collection.id}`)
            }}
          />
        </div>
      </div>
    </div>
  )
}
