import { useCallback, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { CollectionForm } from "@/components/CollectionForm"
import { ConfirmSaveProgressSheet } from "@/components/ConfirmSaveProgressSheet"
import { draftFromWords } from "@/lib/collection-form"
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes"
import { ArrowLeft } from "lucide-react"

export default function EditList() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getCollection, getFolder, updateCollection } = useCollections()
  const collection = id ? getCollection(id) : undefined
  const parentFolder = collection?.folderId ? getFolder(collection.folderId) : undefined
  const backTo = parentFolder ? `/folder/${parentFolder.id}` : "/"
  const backLabel = parentFolder?.name ?? "My sets"

  const [dirty, setDirty] = useState(false)
  const submitRef = useRef<(() => boolean) | null>(null)
  const onDirtyChange = useCallback((next: boolean) => setDirty(next), [])

  const {
    leaveOpen,
    requestLeave,
    allowNextNavigation,
    cancelLeave,
    discardAndLeave,
    saveAndLeave,
  } = useUnsavedChangesGuard({
    dirty,
    allowPathPrefixes: ["/import/"],
    onSave: () => submitRef.current?.() ?? false,
  })

  if (!collection) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Set not found.</p>
          <Link to="/" className="mt-2 inline-block text-primary underline">
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
          <button
            type="button"
            onClick={() => requestLeave(backTo)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>
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
            onDirtyChange={onDirtyChange}
            submitRef={submitRef}
            onSubmit={(values) => {
              allowNextNavigation()
              updateCollection(collection.id, values)
              navigate(`/study/${collection.id}`)
            }}
          />
        </div>
      </div>

      <ConfirmSaveProgressSheet
        open={leaveOpen}
        onCancel={cancelLeave}
        onNo={discardAndLeave}
        onYes={saveAndLeave}
      />
    </div>
  )
}
