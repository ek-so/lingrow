import { useEffect } from "react"
import { Button } from "@/components/ui/button"

interface ConfirmLeaveImportSheetProps {
  open: boolean
  pairCount: number
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function ConfirmLeaveImportSheet({
  open,
  pairCount,
  onSave,
  onDiscard,
  onCancel,
}: ConfirmLeaveImportSheetProps) {
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
      <button type="button" aria-label="Dismiss" className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-import-title"
        className="relative z-10 w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
        style={{ animation: "lingrow-sheet-up 280ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
        <h2 id="leave-import-title" className="text-lg font-semibold tracking-tight">
          Save import?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You have {pairCount} parsed {pairCount === 1 ? "pair" : "pairs"} that aren’t in the list yet.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <Button type="button" size="lg" onClick={onSave}>
            Save import
          </Button>
          <Button type="button" variant="outline" onClick={onDiscard}>
            Discard
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Keep editing
          </Button>
        </div>
      </div>
    </div>
  )
}
