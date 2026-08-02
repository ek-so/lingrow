import { useCallback, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { CollectionForm } from "@/components/CollectionForm"
import { ConfirmSaveProgressSheet } from "@/components/ConfirmSaveProgressSheet"
import { emptyDraftWord } from "@/lib/collection-form"
import { ArrowLeft } from "lucide-react"

export default function NewList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addCollection, getFolder } = useCollections()
  const folderParam = searchParams.get("folder")
  const folder = folderParam ? getFolder(folderParam) : undefined
  const folderId = folder?.id ?? null
  const backTo = folderId ? `/folder/${folderId}` : "/"

  const [dirty, setDirty] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const submitRef = useRef<(() => boolean) | null>(null)
  const onDirtyChange = useCallback((next: boolean) => setDirty(next), [])

  function requestBack() {
    if (!dirty) {
      navigate(backTo)
      return
    }
    setLeaveOpen(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center px-5 py-3">
          <button
            type="button"
            onClick={requestBack}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {folder ? folder.name : "My sets"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 pb-6 pt-[4.75rem]">
        <h1 className="text-2xl font-semibold tracking-tight">New set</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose languages, then add word pairs — or import from a file or bullet list.
          {folder ? (
            <>
              {" "}
              Saving into <span className="font-medium text-foreground">{folder.name}</span>.
            </>
          ) : null}
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
            submitLabel="Save set"
            onDirtyChange={onDirtyChange}
            submitRef={submitRef}
            onSubmit={(values) => {
              const created = addCollection({ ...values, folderId })
              navigate(`/study/${created.id}`)
            }}
          />
        </div>
      </div>

      <ConfirmSaveProgressSheet
        open={leaveOpen}
        onCancel={() => setLeaveOpen(false)}
        onNo={() => {
          setLeaveOpen(false)
          navigate(backTo)
        }}
        onYes={() => {
          setLeaveOpen(false)
          submitRef.current?.()
        }}
      />
    </div>
  )
}
