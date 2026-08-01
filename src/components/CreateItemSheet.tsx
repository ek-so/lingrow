import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { FolderInput, FolderPlus, Plus } from "lucide-react"

interface CreateItemSheetProps {
  open: boolean
  onNewSet: () => void
  onNewFolder: () => void
  onMoveHere: () => void
  onCancel: () => void
}

export function CreateItemSheet({
  open,
  onNewSet,
  onNewFolder,
  onMoveHere,
  onCancel,
}: CreateItemSheetProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-item-title"
        className="relative z-10 w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
        style={{ animation: "lingrow-sheet-up 280ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
        <h2 id="create-item-title" className="text-lg font-semibold tracking-tight">
          Add
        </h2>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onNewSet}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-secondary"
          >
            <Plus className="h-4 w-4 shrink-0" />
            New set
          </button>
          <button
            type="button"
            onClick={onNewFolder}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-secondary"
          >
            <FolderPlus className="h-4 w-4 shrink-0" />
            New folder
          </button>
          <button
            type="button"
            onClick={onMoveHere}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-secondary"
          >
            <FolderInput className="h-4 w-4 shrink-0" />
            Move here
          </button>
        </div>

        <div className="mt-5">
          <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
