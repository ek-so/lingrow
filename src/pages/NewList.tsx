import { useCallback, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { AppHeader } from "@/components/AppHeader"
import { AppShell } from "@/components/AppShell"
import { CollectionForm } from "@/components/CollectionForm"
import { ConfirmSaveProgressSheet } from "@/components/ConfirmSaveProgressSheet"
import { PageBody, PageTitle } from "@/components/PageTitle"
import { emptyDraftWord } from "@/lib/collection-form"
import { folderTrailUp } from "@/lib/folders"
import { clearNewSetDraft, newSetDraftKey } from "@/lib/new-set-draft"
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes"

export default function NewList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addCollection, getFolder, folders } = useCollections()
  const folderParam = searchParams.get("folder")
  const folder = folderParam ? getFolder(folderParam) : undefined
  const folderId = folder?.id ?? null
  const backTo = folderId ? `/folder/${folderId}` : "/"
  const backTrail = folderTrailUp(folders, folderId)
  const draftKey = newSetDraftKey(folderId)

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
    onDiscard: () => clearNewSetDraft(draftKey),
    onSave: () => submitRef.current?.() ?? false,
  })

  return (
    <>
      <AppShell
        header={
          <AppHeader
            leading={{
              kind: "back",
              label: folder ? folder.name : "My sets",
              onBack: () => requestLeave(backTo),
              trail: backTrail,
              onTrailSelect: (to) => requestLeave(to),
            }}
          />
        }
      >
        <PageBody>
          <PageTitle
            description={
              <>
                Choose languages, then add word pairs — or import from a file or bullet list.
                {folder ? (
                  <>
                    {" "}
                    Saving into <span className="font-medium text-foreground">{folder.name}</span>.
                  </>
                ) : null}
              </>
            }
          >
            New set
          </PageTitle>

          <div className="mt-8">
            <CollectionForm
              initial={{
                name: "",
                description: "",
                wordLang: "de",
                translationLang: "en",
                words: [emptyDraftWord(), emptyDraftWord(), emptyDraftWord()],
              }}
              submitLabel="Save set"
              persistDraftKey={draftKey}
              onDirtyChange={onDirtyChange}
              submitRef={submitRef}
              onSubmit={(values) => {
                clearNewSetDraft(draftKey)
                allowNextNavigation()
                const created = addCollection({ ...values, folderId })
                navigate(`/study/${created.id}`)
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
