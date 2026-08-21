import { useCallback, useRef, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { AppHeader } from "@/components/AppHeader"
import { AppShell } from "@/components/AppShell"
import { CollectionForm } from "@/components/CollectionForm"
import { ConfirmSaveProgressSheet } from "@/components/ConfirmSaveProgressSheet"
import { PageBody, PageTitle } from "@/components/PageTitle"
import { draftFromWords } from "@/lib/collection-form"
import { folderTrailUp } from "@/lib/folders"
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes"

export default function EditList() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { getCollection, folders, updateCollection } = useCollections()
  const collection = id ? getCollection(id) : undefined
  const scrollToParam = searchParams.get("scrollTo")
  const scrollToWordIndex = scrollToParam != null ? parseInt(scrollToParam, 10) : undefined
  // Edit is a subpage of the set (study), not of the containing folder.
  const backTo = collection ? `/study/${collection.id}` : "/"
  const backLabel = collection?.name ?? "Back"
  const backTrail = collection
    ? [
        {
          id: collection.id,
          label: collection.name,
          to: `/study/${collection.id}`,
          kind: "set" as const,
        },
        ...folderTrailUp(folders, collection.folderId ?? null),
      ]
    : []

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
      <div className="flex h-dvh items-center justify-center bg-background">
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
    <>
      <AppShell
        header={
          <AppHeader
            leading={{
              kind: "back",
              label: backLabel,
              onBack: () => requestLeave(backTo),
              trail: backTrail,
              onTrailSelect: (to) => requestLeave(to),
            }}
          />
        }
      >
        <PageBody>
          <PageTitle>Edit set</PageTitle>

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
              scrollToWordIndex={scrollToWordIndex}
              onSubmit={(values) => {
                allowNextNavigation()
                updateCollection(collection.id, values)
                navigate(`/study/${collection.id}`)
              }}
            />
          </div>
        </PageBody>
      </AppShell>

      <ConfirmSaveProgressSheet
        open={leaveOpen}
        onCancel={cancelLeave}
        onNo={discardAndLeave}
        onYes={saveAndLeave}
      />
    </>
  )
}
