import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"

interface ConfirmSaveProgressSheetProps {
  open: boolean
  onYes: () => void
  onNo: () => void
  onCancel: () => void
}

export function ConfirmSaveProgressSheet({
  open,
  onYes,
  onNo,
  onCancel,
}: ConfirmSaveProgressSheetProps) {
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-hidden sm:items-center">
      <button type="button" aria-label="Dismiss" className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-progress-title"
        className="relative z-10 w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
        style={{ animation: "lingrow-sheet-up 280ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
        <h2 id="save-progress-title" className="text-lg font-semibold tracking-tight">
          Do you want to save progress?
        </h2>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="lg" onClick={onNo}>
            No
          </Button>
          <Button type="button" size="lg" onClick={onYes}>
            Yes
          </Button>
        </div>
      </div>
    </div>
  )
}
